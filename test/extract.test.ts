// Design-system extraction against a small fixture company site with known assets and components.
// Needs Google Chrome; the fixture is served locally, so no network is used.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCompany, type AssetRecord } from '../scan/extract.ts';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/company');
const types: Record<string, string> = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
let server: Server;
let origin = '';
let out = '';
let result: Awaited<ReturnType<typeof extractCompany>>;

before(async () => {
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = path.join(SITE, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(SITE) || !existsSync(file) || statSync(file).isDirectory()) return void res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const a = server.address();
  origin = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
  out = mkdtempSync(path.join(tmpdir(), 'extract-'));
  result = await extractCompany(`${origin}/`, { outDir: out, pages: 2, download: true });
});

after(() => {
  server?.close();
  if (out) rmSync(out, { recursive: true, force: true });
});

const find = (pred: (a: AssetRecord) => boolean) => result.assets.find(pred);
const byFile = (name: string) => find((a) => a.url.endsWith(`/${name}`));

test('crawls the start page and one more page from its navigation', () => {
  const ok = result.record.pages.filter((p) => p.status === 'ok').map((p) => new URL(p.url).pathname);
  assert.deepEqual(ok, ['/', '/about.html']);
});

test('finds every kind of asset, including lazy, srcset, background and network-only files', () => {
  assert.equal(byFile('logo.svg')?.type, 'logo');
  assert.equal(byFile('favicon.png')?.type, 'favicon');
  assert.equal(byFile('share.png')?.type, 'share-image');
  assert.equal(byFile('hero-bg.png')?.type, 'image', 'CSS background image');
  assert.ok(byFile('one@2x.png'), 'largest srcset candidate');
  assert.equal(byFile('star.svg')?.type, 'icon', 'small SVG image is an icon');
  assert.equal(byFile('clip.mp4')?.type, 'video');
  assert.equal(byFile('poster.png')?.type, 'image');
  assert.equal(byFile('acme.woff2')?.type, 'font', 'font file seen on the network');
  assert.deepEqual(byFile('logo.svg')?.pages.length, 2, 'the same file on two pages is one asset');
  assert.equal(result.record.logo?.kind, 'img');
});

test('inline SVG icons are deduplicated by drawing', () => {
  const circle = result.record.icons.find((i) => i.html.includes('<circle'));
  assert.ok(circle);
  assert.equal(circle.count, 2);
});

test('components are grouped into variants by computed style', () => {
  const kinds = (k: string) => result.record.components.filter((c) => c.kind === k);
  const buttons = kinds('button');
  const primary = buttons.find((b) => b.style['background-color'] === '#111111');
  const secondary = buttons.find((b) => b.style['border-top-width'] === '2px');
  assert.ok(primary && secondary, 'primary and outlined buttons are separate variants');
  assert.ok(primary.examples.includes('Buy now'));
  assert.equal(kinds('card').length, 1, 'three identical cards are one variant');
  assert.equal(kinds('card')[0].count, 3);
  assert.ok(kinds('input').length >= 1);
  assert.ok(kinds('badge').some((b) => b.examples.includes('New')));
  assert.ok(primary.screenshot && existsSync(path.join(out, primary.screenshot)), 'each variant has a cropped screenshot');
});

test('downloads files into folders by type and writes the list as JSON and CSV', () => {
  const logo = byFile('logo.svg')!;
  assert.ok(logo.local && existsSync(path.join(out, logo.local)));
  assert.ok(logo.local.startsWith(path.join('assets', 'logo')));
  assert.ok(byFile('clip.mp4')?.local?.startsWith(path.join('assets', 'video')));
  assert.ok(existsSync(path.join(out, 'assets', 'icon')), 'inline icons saved as SVG files');
  const csv = readFileSync(path.join(out, 'assets.csv'), 'utf8');
  assert.ok(csv.startsWith('id,type,url,'));
  assert.equal(csv.trim().split('\n').length, result.assets.length + 1);
  const ds = JSON.parse(readFileSync(path.join(out, 'design-system.json'), 'utf8'));
  assert.equal(ds.schema, 'design-system/1');
  assert.ok(ds.tokens.colors.some((c: { hex: string }) => c.hex === '#111111'));
});
