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
import { scanUrls, summary } from '../scan/run.ts';
import { loadScans, report } from '../scan/report.ts';
import { extractCompany } from '../scan/extract.ts';
import { readdir } from 'node:fs/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4410);
const HOST = '127.0.0.1';
const store = fileStore(process.env.CONVERSION_DATA_DIR ?? path.resolve(HERE, '../src/data'));
const SCANS = path.resolve(process.env.SCANS_DIR ?? path.resolve(HERE, '../scans'));
const EXTRACTS = path.resolve(process.env.EXTRACTS_DIR ?? path.resolve(HERE, '../extracts'));
const hostDir = /^[a-z0-9][a-z0-9.-]{0,120}$/i;
const fileTypes: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.json': 'application/json', '.csv': 'text/csv; charset=utf-8',
};

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

  // Scan up to 10 funnels from the viewer. Bigger batches belong on the command line.
  async '/api/scan'(body) {
    const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '').map((u) => u.trim()) : [];
    if (!urls.length || urls.length > 10) throw new HttpError(400, 'Send 1 to 10 URLs. Use npm run scan for more.');
    try {
      const viewport = body.viewport === 'desktop' ? 'desktop' : 'mobile';
      return { scans: (await scanUrls(urls, { outDir: SCANS, viewport, concurrency: 3 })).map(summary) };
    } catch (error) {
      throw new HttpError(422, (error as Error).message);
    }
  },

  // Extract a company's design system from the viewer.
  async '/api/extract'(body) {
    if (typeof body.url !== 'string') throw new HttpError(400, 'Send a URL.');
    const pages = Math.min(12, Math.max(1, Number(body.pages) || 6));
    let host: string;
    try {
      host = new URL(body.url).host.replace(/^www\./, '');
    } catch {
      throw new HttpError(400, 'That is not a URL.');
    }
    try {
      const { record } = await extractCompany(body.url, { outDir: path.join(EXTRACTS, host), pages, download: body.download === true });
      return { host, assets: record.assets, components: record.components.length };
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
    if (req.method === 'GET' && (url.pathname === '/scans' || url.pathname === '/scans/')) {
      // Scans show other sites' text and images, so the page may load images from anywhere but run only its own script.
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; img-src * data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'",
        'Referrer-Policy': 'no-referrer',
      });
      res.end(await readFile(path.join(HERE, 'scans.html')));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/scans') {
      const scans = await loadScans(SCANS);
      scans.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));
      send(res, 200, { dir: SCANS, scans: scans.map(summary), report: report(scans) });
      return;
    }
    const scanMatch = url.pathname.match(/^\/api\/scans\/([a-z0-9-]{1,80})$/);
    if (req.method === 'GET' && scanMatch) {
      const file = path.join(SCANS, `${scanMatch[1]}.json`);
      const data = await readFile(file, 'utf8').catch(() => null);
      if (!data) throw new HttpError(404, 'No scan with that id.');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(data);
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/extracts' || url.pathname === '/extracts/')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; img-src * data:; media-src *; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'",
        'Referrer-Policy': 'no-referrer',
      });
      res.end(await readFile(path.join(HERE, 'extracts.html')));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/extracts') {
      const dirs = (await readdir(EXTRACTS, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && hostDir.test(d.name));
      const list = [];
      for (const d of dirs) {
        const raw = await readFile(path.join(EXTRACTS, d.name, 'design-system.json'), 'utf8').catch(() => null);
        if (!raw) continue;
        const ds = JSON.parse(raw);
        list.push({ host: d.name, extracted_at: ds.extracted_at, pages: ds.pages.length, assets: ds.assets.total, components: ds.components.length });
      }
      send(res, 200, { dir: EXTRACTS, extracts: list.sort((a, b) => b.extracted_at.localeCompare(a.extracted_at)) });
      return;
    }
    // Files inside one extract: its JSON, CSV, component crops and downloaded assets. Nothing outside it.
    const extractFile = url.pathname.match(/^\/extracts\/([a-z0-9][a-z0-9.-]{0,120})\/((?:components|assets)\/[a-zA-Z0-9@._/-]{1,200}|design-system\.json|assets\.json|assets\.csv)$/i);
    if (req.method === 'GET' && extractFile) {
      const base = path.join(EXTRACTS, extractFile[1]);
      const file = path.resolve(base, extractFile[2]);
      if (!file.startsWith(base + path.sep) || extractFile[2].includes('..')) throw new HttpError(404, 'Not found.');
      const data = await readFile(file).catch(() => null);
      if (!data) throw new HttpError(404, 'Not found.');
      res.writeHead(200, { 'Content-Type': fileTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" });
      res.end(data);
      return;
    }
    const shotMatch = url.pathname.match(/^\/scans\/shots\/([a-z0-9-]{1,80}\.jpg)$/);
    if (req.method === 'GET' && shotMatch) {
      const img = await readFile(path.join(SCANS, 'shots', shotMatch[1])).catch(() => null);
      if (!img) throw new HttpError(404, 'No screenshot.');
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
      res.end(img);
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

server.listen(PORT, HOST, () => console.log(`Brand capture: http://${HOST}:${PORT}\nFunnel scans:  http://${HOST}:${PORT}/scans\nExtracts:      http://${HOST}:${PORT}/extracts`));
