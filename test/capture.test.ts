// Round trip: capture a page the system built and compare against the brand file that built it.
// Needs `npm run build` first and Google Chrome installed; skips otherwise.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../capture/collect.ts';
import { propose, tokenValues } from '../capture/propose.ts';
import { load } from './helpers.ts';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const ready = existsSync(path.join(DIST, 'larkspur/index.html'));
let server: Server;
let origin = '';

before(async () => {
  if (!ready) return;
  server = createServer((req, res) => {
    const clean = path.normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = path.join(DIST, clean);
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(DIST) || !existsSync(file)) return void res.writeHead(404).end();
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': type }).end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

after(() => server?.close());

test('capture recovers the brand tokens of a page built from them', { skip: !ready && 'run npm run build first', timeout: 60_000 }, async () => {
  const truth = load('larkspur').tokens;
  const got = tokenValues(propose(await collect([`${origin}/larkspur/`])));
  for (const name of ['color-bg', 'color-surface', 'color-text', 'color-muted', 'color-accent', 'color-on-accent', 'color-border', 'radius', 'measure', 'weight-display', 'size-small'] as const) {
    assert.equal(got[name].toUpperCase(), truth[name].toUpperCase(), name);
  }
  assert.match(got['font-display'], /^"?Fraunces/);
  assert.match(got['font-body'], /^"?Public Sans/);
});

test('collect refuses non-web URLs', async () => {
  await assert.rejects(collect(['file:///etc/passwd']), /Only http and https/);
});
