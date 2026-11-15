// Extract a company's design system: tokens, fonts, components and every asset, merged across
// several pages of their site. Code only. Files are downloaded only when asked (with the company's permission).
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFunnel } from './read.ts';
import { readCompany, type RawExtract } from './extract-read.ts';
import { blockedReason } from './classify.ts';
import { checkUrl, viewports, type ViewportName } from './run.ts';

export const SCHEMA = 'design-system/1';

export interface ExtractOptions {
  outDir: string;
  pages?: number;
  viewport?: ViewportName;
  download?: boolean;
  maxDownloadBytes?: number;
  timeoutMs?: number;
  log?: (line: string) => void;
}

type AssetType = 'logo' | 'icon' | 'favicon' | 'share-image' | 'image' | 'video' | 'video-embed' | 'font' | 'manifest';
const typeRank: AssetType[] = ['logo', 'favicon', 'icon', 'share-image', 'image', 'video', 'video-embed', 'font', 'manifest'];

export interface AssetRecord {
  id: string;
  type: AssetType;
  url: string;
  pages: string[];
  contexts: string[];
  alt?: string;
  w?: number;
  h?: number;
  natural_w?: number;
  natural_h?: number;
  mime?: string;
  bytes?: number;
  source: 'page' | 'network' | 'both';
  local?: string;
  sha1?: string;
  skipped?: string;
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex');
const slug = (s: string, max = 40) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'file';

// Visit the start page, then one page per kind of path (/products/…, /about, /collections/…), so templates differ.
function pickNext(links: string[], visited: Set<string>, want: number, start: URL) {
  const byKind = new Map<string, string>();
  for (const l of links) {
    const u = new URL(l);
    if (visited.has(u.href) || u.href === start.href || /\/(cart|account|login|search|checkout|cdn-cgi)/i.test(u.pathname)) continue;
    const kind = u.pathname.split('/').filter(Boolean)[0] ?? '/';
    if (!byKind.has(kind)) byKind.set(kind, u.href);
  }
  return [...byKind.values()].slice(0, want);
}

async function settle(page: Page) {
  // Scroll to the bottom in steps so lazy images and videos load, then come back up.
  await page.evaluate(async () => {
    const step = innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight && y < 40_000; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

export async function extractCompany(startUrl: string, options: ExtractOptions) {
  const opts = { pages: 6, viewport: 'desktop' as ViewportName, download: false, maxDownloadBytes: 50 * 1024 * 1024, timeoutMs: 30_000, log: () => {}, ...options };
  const start = new URL(checkUrl(startUrl));
  const outDir = opts.outDir;
  await mkdir(path.join(outDir, 'components'), { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: viewports[opts.viewport] });
  const assets = new Map<string, AssetRecord>();
  const icons = new Map<string, { id: string; label: string; w: number; h: number; html: string; count: number; pages: string[] }>();
  const components = new Map<string, { id: string; kind: string; style: Record<string, string>; count: number; examples: string[]; html: string; pages: string[]; screenshot: string | null; w: number; h: number }>();
  const tokenPages: ReturnType<typeof readFunnel>[] = [];
  let logo: RawExtract['logo'] = null;
  const pagesRead: { url: string; title: string; status: string; reason?: string }[] = [];
  const visited = new Set<string>();
  let queue = [start.href];

  // A stream requested with quality settings is the same video as the bare stream URL.
  const assetKey = (url: string) => (/\.(m3u8|mpd)(\?|$)/i.test(url) ? url.split('?')[0] : url);
  const addAsset = (page: string, a: Partial<AssetRecord> & { type: AssetType; url: string }, source: 'page' | 'network', context?: string) => {
    const key = assetKey(a.url);
    if (key !== a.url) a = { ...a, url: key };
    const existing = assets.get(key);
    if (existing) {
      if (!existing.pages.includes(page)) existing.pages.push(page);
      if (context && !existing.contexts.includes(context)) existing.contexts.push(context);
      if (typeRank.indexOf(a.type) < typeRank.indexOf(existing.type)) existing.type = a.type;
      if (existing.source !== source) existing.source = 'both';
      existing.alt ||= a.alt;
      existing.w ??= a.w;
      existing.h ??= a.h;
      existing.natural_w ||= a.natural_w;
      existing.natural_h ||= a.natural_h;
      existing.mime ??= a.mime;
      existing.bytes ??= a.bytes;
      return;
    }
    assets.set(a.url, { id: `${a.type}-${hash(a.url).slice(0, 8)}`, pages: [page], contexts: context ? [context] : [], source, ...a });
  };

  try {
    while (queue.length && pagesRead.length < opts.pages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      const page = await context.newPage();
      const network: { url: string; type: string; mime?: string; bytes?: number }[] = [];
      page.on('request', (req) => {
        if (/\.(m3u8|mpd)(\?|$)/i.test(req.url())) network.push({ url: req.url(), type: 'media', mime: 'stream' });
      });
      page.on('response', (res) => {
        const t = res.request().resourceType();
        if (t === 'image' || t === 'media' || t === 'font') {
          const len = Number(res.headers()['content-length']);
          network.push({ url: res.url(), type: t, mime: res.headers()['content-type']?.split(';')[0], bytes: Number.isFinite(len) ? len : undefined });
        }
      });
      try {
        await page.goto(url, { waitUntil: 'load', timeout: opts.timeoutMs });
        await page.waitForTimeout(800);
        const blocked = blockedReason(await page.title(), await page.evaluate(() => document.body?.innerText ?? ''));
        if (blocked) {
          pagesRead.push({ url, title: await page.title(), status: 'blocked', reason: blocked });
          opts.log(`blocked  ${url}  ${blocked}`);
          continue;
        }
        await settle(page);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        tokenPages.push(await page.evaluate(readFunnel));
        const raw: RawExtract = await page.evaluate(readCompany, 12);
        pagesRead.push({ url, title: raw.title, status: 'ok' });
        logo ??= raw.logo;

        for (const a of raw.assets) addAsset(url, { ...a, type: a.type as AssetType }, 'page', a.context);
        for (const n of network) {
          if (n.url.startsWith('data:')) continue;
          const type: AssetType = n.type === 'font' ? 'font' : n.type === 'media' ? 'video' : /\.svg(\?|$)/i.test(n.url) || n.mime === 'image/svg+xml' ? 'icon' : 'image';
          addAsset(url, { type, url: n.url, mime: n.mime, bytes: n.bytes }, 'network', `loaded as ${n.type}`);
        }
        for (const ic of raw.inline_icons) {
          const key = hash(ic.html);
          const existing = icons.get(key);
          if (existing) {
            existing.count += ic.count;
            if (!existing.pages.includes(url)) existing.pages.push(url);
          } else icons.set(key, { id: `icon-inline-${key.slice(0, 8)}`, label: ic.label, w: ic.w, h: ic.h, html: ic.html, count: ic.count, pages: [url] });
        }
        for (const c of raw.components) {
          const key = hash(`${c.kind}|${JSON.stringify(c.style)}`);
          const existing = components.get(key);
          if (existing) {
            existing.count += c.count;
            if (!existing.pages.includes(url)) existing.pages.push(url);
            for (const e of c.examples) if (existing.examples.length < 4 && !existing.examples.includes(e)) existing.examples.push(e);
            continue;
          }
          const id = `${c.kind}-${key.slice(0, 6)}`;
          let screenshot: string | null = null;
          try {
            const shot = path.join('components', `${id}.png`);
            await page.locator(`[data-cs-mark="${c.mark}"]`).first().screenshot({ path: path.join(outDir, shot), timeout: 3000 });
            screenshot = shot;
          } catch {
            /* off-screen or animated away: keep the record without a crop */
          }
          components.set(key, { id, kind: c.kind, style: c.style, count: c.count, examples: c.examples, html: c.html, pages: [url], screenshot, w: c.w, h: c.h });
        }
        opts.log(`ok       ${url}  ${raw.assets.length} page assets, ${network.length} files loaded, ${raw.components.length} component variants`);
        if (pagesRead.filter((p) => p.status === 'ok').length === 1) queue.push(...pickNext(raw.links, visited, opts.pages - 1, start));
      } catch (error) {
        pagesRead.push({ url, title: '', status: 'error', reason: (error as Error).message.split('\n')[0] });
        opts.log(`error    ${url}  ${(error as Error).message.split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }

    const assetList = [...assets.values()].sort((a, b) => typeRank.indexOf(a.type) - typeRank.indexOf(b.type) || b.pages.length - a.pages.length);
    if (opts.download) await downloadAll(context, assetList, outDir, opts.maxDownloadBytes, opts.log);
    if (opts.download && logo?.kind === 'inline-svg' && logo.html) {
      await mkdir(path.join(outDir, 'assets', 'logo'), { recursive: true });
      const svg = logo.html.includes('xmlns') ? logo.html : logo.html.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      await writeFile(path.join(outDir, 'assets', 'logo', 'logo.svg'), svg);
      (logo as typeof logo & { file?: string }).file = 'assets/logo/logo.svg';
    }
    if (opts.download) {
      await mkdir(path.join(outDir, 'assets', 'icon'), { recursive: true });
      for (const ic of icons.values()) {
        const file = path.join('assets', 'icon', `${ic.id}.svg`);
        const svg = ic.html.startsWith('<symbol') ? ic.html.replace(/^<symbol/, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/<\/symbol>$/, '</svg>') : ic.html;
        await writeFile(path.join(outDir, file), svg);
        (ic as typeof ic & { file?: string }).file = file;
      }
    }

    const record = {
      schema: SCHEMA,
      company: { host: start.host, start_url: start.href },
      extracted_at: new Date().toISOString(),
      viewport: { name: opts.viewport, ...viewports[opts.viewport] },
      pages: pagesRead,
      logo,
      tokens: mergeTokens(tokenPages),
      components: [...components.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.count - a.count),
      icons: [...icons.values()].sort((a, b) => b.count - a.count),
      assets: {
        file: 'assets.json',
        counts: Object.fromEntries(typeRank.map((t) => [t, assetList.filter((a) => a.type === t).length]).filter(([, n]) => n)),
        total: assetList.length,
        downloaded: opts.download ? assetList.filter((a) => a.local).length : 0,
      },
      limitations: [
        'Components are grouped by exact computed style from the pages visited. Hover, focus and other states are not captured.',
        'Assets loaded only after a click or a form step are not seen.',
        opts.download ? 'Files were downloaded. Use them only with the company\'s permission.' : 'Assets are listed as URLs. Run with --download, with the company\'s permission, to save the files.',
      ],
    };
    await writeFile(path.join(outDir, 'design-system.json'), JSON.stringify(record, null, 2));
    await writeFile(path.join(outDir, 'assets.json'), JSON.stringify(assetList, null, 2));
    await writeFile(path.join(outDir, 'assets.csv'), toCsv(assetList));
    await writeFile(path.join(outDir, 'README.md'), summaryMarkdown(record, assetList));
    return { record, assets: assetList };
  } finally {
    await browser.close();
  }
}

function mergeTokens(pages: ReturnType<typeof readFunnel>[]) {
  const colours = new Map<string, { hex: string; roles: Set<string>; count: number }>();
  const type = new Map<string, ReturnType<typeof readFunnel>['type'][number]>();
  const radius = new Map<string, number>();
  const shadow = new Map<string, number>();
  const padding = new Map<string, number>();
  const gaps = new Map<string, number>();
  const declared: Record<string, string> = {};
  const fonts = new Map<string, { family: string; weights: Set<string> }>();
  const bump = (m: Map<string, number>, rows: { value: string; count: number }[]) => rows.forEach((r) => m.set(r.value, (m.get(r.value) ?? 0) + r.count));
  for (const p of pages) {
    for (const c of p.colours) {
      const e = colours.get(c.hex) ?? { hex: c.hex, roles: new Set<string>(), count: 0 };
      c.roles.forEach((r) => e.roles.add(r));
      e.count += c.count;
      colours.set(c.hex, e);
    }
    for (const t of p.type) {
      const key = [t.role, t.family, t.size, t.weight, t.line_height, t.letter_spacing, t.transform].join('|');
      const e = type.get(key);
      if (e) e.count += t.count;
      else type.set(key, { ...t });
    }
    bump(radius, p.radius);
    bump(shadow, p.shadow);
    bump(padding, p.section_padding);
    bump(gaps, p.gaps);
    Object.assign(declared, p.declared);
    for (const f of p.assets.fonts_loaded) {
      const e = fonts.get(f.family) ?? { family: f.family, weights: new Set<string>() };
      e.weights.add(f.weight);
      fonts.set(f.family, e);
    }
  }
  const ranked = (m: Map<string, number>, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
  const first = pages[0];
  return {
    page: first?.page ?? null,
    display: first?.display ?? null,
    colors: [...colours.values()].sort((a, b) => b.count - a.count).slice(0, 40).map((c) => ({ hex: c.hex, roles: [...c.roles], count: c.count })),
    type: [...type.values()].sort((a, b) => b.count - a.count).slice(0, 40),
    radius: ranked(radius),
    shadow: ranked(shadow, 10),
    spacing: { section_padding: ranked(padding), gap: ranked(gaps) },
    declared,
    fonts: [...fonts.values()].map((f) => ({ family: f.family, weights: [...f.weights].sort() })),
  };
}

const extFromMime: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'video/mp4': 'mp4', 'video/webm': 'webm', 'font/woff2': 'woff2', 'font/woff': 'woff',
  'font/ttf': 'ttf', 'font/otf': 'otf', 'application/font-woff2': 'woff2', 'application/manifest+json': 'json',
};

async function downloadAll(context: BrowserContext, list: AssetRecord[], outDir: string, maxBytes: number, log: (l: string) => void) {
  const queue = list.filter((a) => a.type !== 'video-embed');
  const worker = async () => {
    while (queue.length) {
      const a = queue.shift()!;
      try {
        const res = await context.request.get(a.url, { timeout: 30_000 });
        if (!res.ok()) {
          a.skipped = `HTTP ${res.status()}`;
          continue;
        }
        const body = await res.body();
        if (body.length > maxBytes) {
          a.skipped = `larger than ${Math.round(maxBytes / 1024 / 1024)} MB`;
          continue;
        }
        const mime = res.headers()['content-type']?.split(';')[0] ?? a.mime ?? '';
        const urlExt = path.extname(new URL(a.url).pathname).slice(1).toLowerCase();
        const ext = extFromMime[mime] ?? (urlExt.length <= 5 && urlExt ? urlExt : 'bin');
        const base = slug(path.basename(new URL(a.url).pathname, path.extname(new URL(a.url).pathname)));
        const file = path.join('assets', a.type, `${base}-${a.id.split('-').pop()}.${ext}`);
        await mkdir(path.join(outDir, 'assets', a.type), { recursive: true });
        await writeFile(path.join(outDir, file), body);
        Object.assign(a, { local: file, bytes: body.length, sha1: createHash('sha1').update(body).digest('hex'), mime: mime || a.mime });
      } catch (error) {
        a.skipped = (error as Error).message.split('\n')[0].slice(0, 120);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  log(`downloaded ${list.filter((a) => a.local).length} of ${list.length} assets`);
}

function toCsv(list: AssetRecord[]) {
  const cols = ['id', 'type', 'url', 'alt', 'w', 'h', 'natural_w', 'natural_h', 'mime', 'bytes', 'pages', 'contexts', 'source', 'local', 'skipped'] as const;
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join(' ') : v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...list.map((a) => cols.map((c) => cell(a[c])).join(','))].join('\n') + '\n';
}

function summaryMarkdown(record: { company: { host: string }; pages: { url: string; status: string }[]; components: { kind: string }[]; icons: unknown[]; assets: { counts: Record<string, number>; total: number; downloaded: number }; extracted_at: string }, list: AssetRecord[]) {
  const kinds = new Map<string, number>();
  for (const c of record.components) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
  return [
    `# Design system extract: ${record.company.host}`,
    ``,
    `Extracted ${record.extracted_at.slice(0, 10)} from ${record.pages.filter((p) => p.status === 'ok').length} of ${record.pages.length} pages. Code only, no AI.`,
    ``,
    `| File | What it holds |`,
    `| --- | --- |`,
    `| \`design-system.json\` | Tokens, fonts, component variants with styles and HTML, inline icons, asset counts |`,
    `| \`assets.json\`, \`assets.csv\` | Every asset: ${record.assets.total} in total |`,
    `| \`components/\` | A cropped screenshot of each component variant |`,
    record.assets.downloaded ? `| \`assets/\` | ${record.assets.downloaded} downloaded files, by type |` : `| \`assets/\` | Not downloaded. Run with \`--download\`, with the company's permission |`,
    ``,
    `Assets: ${Object.entries(record.assets.counts).map(([t, n]) => `${t} ${n}`).join(', ')}. Inline SVG icons: ${record.icons.length}.`,
    ``,
    `Component variants: ${[...kinds.entries()].map(([k, n]) => `${k} ${n}`).join(', ')}.`,
    ``,
    `Pages:`,
    ...record.pages.map((p) => `- ${p.status}: ${p.url}`),
    ``,
    `Not downloaded: ${list.filter((a) => a.skipped).length ? list.filter((a) => a.skipped).map((a) => `${a.url} (${a.skipped})`).slice(0, 10).join('; ') : 'none'}`,
  ].join('\n');
}
