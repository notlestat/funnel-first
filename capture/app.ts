// The clickable front door to brand capture: paste a URL, review the tokens, save.
// Usage: npm run app, then open http://127.0.0.1:4410
// Local only. Every route reuses the same capture, contrast and validation code as the MCP server.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture } from './index.ts';
import { palette, type Proposal } from './propose.ts';
import { fileStore } from '../mcp/store.ts';
import { brandSchema, type Brand } from '../src/system/schema.ts';
import { tokenNames, type TokenName } from '../src/system/tokens.ts';
import { contrastErrors } from '../src/system/rules.ts';
import { slug, validateBrand } from '../src/system/validate.ts';
import { toCss, toDtcg } from '../src/system/export.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4410);
const HOST = '127.0.0.1';
const store = fileStore(process.env.CONVERSION_DATA_DIR ?? path.resolve(HERE, '../src/data'));

type Tokens = Record<TokenName, string>;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

// Another website open in the same browser could post to localhost. Requiring our own
// Origin and a JSON body (which forces a CORS preflight we never answer) blocks that.
function assertSameOrigin(req: IncomingMessage) {
  const allowed = [`http://${HOST}:${PORT}`, `http://localhost:${PORT}`];
  if (!allowed.includes(req.headers.origin ?? '')) throw new HttpError(403, 'Requests must come from the capture page.');
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body is not valid JSON.');
  }
}

const id = (value: unknown) => {
  if (typeof value !== 'string' || !slug.test(value)) throw new HttpError(400, 'Client id must be a lowercase slug, like "acme-dental".');
  return value;
};

// Edited values end up inside CSS, so refuse anything that could close a declaration or a tag.
function tokens(value: unknown): Tokens {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Missing tokens.');
  const input = value as Record<string, unknown>;
  const out = {} as Tokens;
  for (const name of tokenNames) {
    const v = input[name];
    if (typeof v !== 'string' || !v.trim() || v.length > 200 || /[;{}<>]/.test(v)) throw new HttpError(400, `${name} needs a plain CSS value.`);
    out[name] = v.trim();
  }
  return out;
}

const fontsHref = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.startsWith('https://fonts.googleapis.com/')) throw new HttpError(400, 'fontsHref must be a Google Fonts URL.');
  return value;
};

const titleCase = (s: string) => s.replace(/(^|-)([a-z0-9])/g, (_, dash, c) => (dash ? ' ' : '') + c.toUpperCase());

async function brandOthers(except: string) {
  return (await store.list('brands')).flatMap((b) => {
    const parsed = brandSchema.safeParse(b.data);
    return b.id !== except && parsed.success ? [{ id: b.id, data: parsed.data as Brand }] : [];
  });
}

const routes: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
  // Open the pages in Chrome, store the evidence, return the proposal plus every colour seen.
  async '/api/capture'(body) {
    const clientId = id(body.id);
    const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '').map((u) => u.trim()) : [];
    try {
      const { file, record } = await capture(store, clientId, urls);
      const brand = (await store.get('brands', clientId)) as Partial<Brand> | undefined;
      return {
        file: path.relative(process.cwd(), file),
        urls: record.urls,
        limitations: record.limitations,
        customPropertyCount: Object.keys(record.customProperties).length,
        palette: palette(record),
        ...record.proposal,
        brand: brand ? { name: brand.name } : null,
        name: brand?.name ?? titleCase(clientId),
      };
    } catch (error) {
      throw new HttpError(422, (error as Error).message);
    }
  },

  // Re-run the contrast rules after an edit.
  async '/api/check'(body) {
    return { contrastErrors: contrastErrors(tokens(body.tokens)) };
  },

  // Record the approved tokens on the capture, and optionally apply them to an existing brand.
  async '/api/save'(body) {
    const clientId = id(body.id);
    const approved = tokens(body.tokens);
    const fonts = fontsHref(body.fontsHref);
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.replace(/\*\/|[<>]/g, '').trim().slice(0, 80) : titleCase(clientId);
    const errors = contrastErrors(approved);
    if (errors.length) throw new HttpError(422, `Not saved. Fix contrast first:\n${errors.join('\n')}`);

    const record = (await store.get('captures', clientId)) as Record<string, unknown> | undefined;
    if (!record) throw new HttpError(404, `No capture for "${clientId}". Capture the site first.`);
    const edited = tokenNames.filter((n) => (record.proposal as Proposal).tokens[n]?.value !== approved[n]);
    await store.put('captures', clientId, {
      ...record,
      approved: { tokens: approved, fontsHref: fonts, edited, approved_at: new Date().toISOString().slice(0, 10) },
    });

    let applied: { file: string; warnings: string[]; review: string[] } | null = null;
    if (body.applyToBrand === true) {
      const existing = await store.get('brands', clientId);
      if (!existing) throw new HttpError(404, `No brand "${clientId}" to apply to. Draft the brand with the agent first.`);
      const check = validateBrand({ ...(existing as object), tokens: approved, fontsHref: fonts }, await brandOthers(clientId));
      if (!check.ok) throw new HttpError(422, `Brand not updated:\n${check.errors.join('\n')}`);
      const file = await store.put('brands', clientId, check.brand);
      applied = { file: path.relative(process.cwd(), file), warnings: check.warnings, review: [`/${clientId}/system`, `/${clientId}/`] };
    }

    return { edited, applied, css: toCss(name, approved), json: toDtcg(clientId, name, approved) };
  },
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}`);
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(await readFile(path.join(HERE, 'app.html')));
      return;
    }
    const route = routes[url.pathname];
    if (req.method !== 'POST' || !route) throw new HttpError(404, 'Not found.');
    assertSameOrigin(req);
    send(res, 200, await route(await readJson(req)));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(error);
    send(res, status, { message: status === 500 ? 'Something went wrong. See the terminal.' : (error as Error).message });
  }
});

server.listen(PORT, HOST, () => console.log(`Brand capture: http://${HOST}:${PORT}`));
