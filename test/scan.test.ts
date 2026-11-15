// The funnel scanner: labelling rules as unit tests, then real Chrome against pages the system built,
// where the right answer is known. The browser part needs `npm run build` and Google Chrome; it skips otherwise.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockKind, blockedReason, builder, ctaRepeats, firstAsk, headlineType, tracking } from '../scan/classify.ts';
import { checkUrl, scanId, scanUrls, type FunnelScan } from '../scan/run.ts';
import { report } from '../scan/report.ts';

// ---- Labelling rules ----

test('headline types follow the study buckets', () => {
  assert.equal(headlineType('Does your roof suit solar?'), 'question');
  assert.equal(headlineType('Sell your pottery online, even without a big following'), 'named-doubt');
  assert.equal(headlineType('How agencies scale to 7 figures despite the market'), 'named-doubt');
  assert.equal(headlineType('Close the month in five days, not ten'), 'plain');
  assert.equal(headlineType('We scaled to $2M in one year'), 'result');
  assert.equal(headlineType('This quick test reveals why'), 'curiosity');
});

const screen = { text_inputs: 0, choices: 0, option_buttons: 0, ctas: 0, video: 0, question_text: null as string | null };

test('the first ask is a question when tap answers sit in the first screen', () => {
  assert.equal(firstAsk({ ...screen, choices: 4, question_text: 'Do you own your home?' }).ask, 'question');
  assert.equal(firstAsk({ ...screen, option_buttons: 2, question_text: 'Are you on LinkedIn?' }).ask, 'question');
  assert.equal(firstAsk({ ...screen, text_inputs: 1, ctas: 1 }).ask, 'form');
  assert.equal(firstAsk({ ...screen, video: 1, ctas: 1 }).ask, 'video');
  assert.equal(firstAsk({ ...screen, ctas: 2 }).ask, 'button');
  assert.equal(firstAsk(screen).ask, 'none');
});

const block = {
  order: 2, tag: 'section', top: 1200, height: 500, heading: '', heading_tag: 'h2', chars: 600, inputs: [] as string[], choices: 0,
  buttons: 0, button_labels: [] as string[], ctas: 0, images: 0, small_images: 0, video: 0, quotes: 0, details: 0, list_items: 0,
  h3s: 0, paragraphs: 0, price: false, date: false, rating: null as string | null, legal: false, text_sample: '',
};

test('blocks are labelled from what they contain', () => {
  const kind = (b: Partial<typeof block>, i = 2, n = 8) => blockKind({ ...block, ...b }, i, n).kind;
  assert.equal(kind({ inputs: ['email'] }), 'capture');
  assert.equal(kind({ details: 3 }), 'faq');
  assert.equal(kind({ heading: 'Frequently asked questions' }), 'faq');
  assert.equal(kind({ quotes: 2 }), 'proof');
  assert.equal(kind({ small_images: 6, chars: 120 }), 'logo-strip');
  assert.equal(kind({ date: true, list_items: 4 }), 'agenda');
  assert.equal(kind({ price: true }), 'offer');
  assert.equal(kind({ heading: 'Who are we to make these promises?' }), 'story');
  assert.equal(kind({ list_items: 4 }), 'benefits');
  assert.equal(kind({ ctas: 1, chars: 120 }), 'cta');
  assert.equal(kind({ video: 1 }), 'video');
  assert.equal(kind({ choices: 4, heading_tag: 'h1', top: 80 }, 0), 'hero');
  assert.equal(kind({ tag: 'footer' }, 7), 'footer');
});

const stack = (over: object) => ({
  script_srcs: [] as string[],
  inline: { fbq: false, gtag: false, gtm: false, ttq: false, hotjar: false, clarity: false, linkedin: false, segment: false, snap: false, pinterest: false },
  markers: { generator: null as string | null, html_class: '', data_attrs: [] as string[], link_hosts: [] as string[] },
  ...over,
});

test('builders and tracking are read from script and asset hosts', () => {
  assert.deepEqual(builder(stack({ markers: { generator: 'Webflow', html_class: '', data_attrs: ['data-wf-page'], link_hosts: [] } })), ['webflow']);
  assert.ok(builder(stack({ markers: { generator: null, html_class: '', data_attrs: [], link_hosts: ['perspective.imgix.net'] } })).includes('perspective'));
  assert.deepEqual(tracking(stack({ script_srcs: ['https://connect.facebook.net/en_US/fbevents.js'] })), ['meta-pixel']);
  const inline = stack({});
  inline.inline.fbq = true;
  inline.inline.gtm = true;
  assert.deepEqual(tracking(inline), ['meta-pixel', 'google-tag-manager']);
});

test('repeated calls to action are counted by label or in-page target', () => {
  const c = (text: string, href: string | null) => ({ text, href, top: 0, height: 48, bg: null, radius: '0px', kind: 'link' });
  assert.equal(ctaRepeats([c('Start the quiz', '#flow'), c('Take it now', '#flow'), c('Other', '/x')]), 2);
  assert.equal(ctaRepeats([]), 0);
});

test('bot checks are recognised and recorded, not bypassed', () => {
  assert.match(blockedReason('Just a moment...', '') ?? '', /bot check/);
  assert.match(blockedReason('Site', 'Performing security verification') ?? '', /bot check/);
  assert.equal(blockedReason('Brightside Solar', 'Does your roof suit solar?'), null);
});

test('only web URLs are scanned, and ids are stable and safe', () => {
  assert.throws(() => checkUrl('file:///etc/passwd'), /Only http and https/);
  assert.throws(() => checkUrl('not a url'), /Not a URL/);
  assert.equal(scanId('https://Example.com/Landing/'), scanId('https://Example.com/Landing/'));
  assert.match(scanId('https://example.com/a/../b?x=<y>'), /^[a-z0-9-]+$/);
});

// ---- Real Chrome against pages with known answers ----

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const ready = existsSync(path.join(DIST, 'brightside-solar/index.html'));
let server: Server;
let origin = '';
let out = '';
let scans: FunnelScan[] = [];

before(async () => {
  if (!ready) return;
  server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    if (pathname === '/blocked/') {
      return void res.writeHead(200, { 'Content-Type': 'text/html' }).end('<title>Just a moment...</title><h1>Performing security verification</h1>');
    }
    let file = path.join(DIST, path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, ''));
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(DIST) || !existsSync(file)) return void res.writeHead(404).end();
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': type }).end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  out = mkdtempSync(path.join(tmpdir(), 'funnel-scan-'));
  scans = await scanUrls(['brightside-solar', 'kiln-collective', 'gridline', 'blocked'].map((p) => `${origin}/${p}/`), { outDir: out, concurrency: 2 });
});

after(() => {
  server?.close();
  if (out) rmSync(out, { recursive: true, force: true });
});

const find = (slug: string) => scans.find((s) => s.url.includes(`/${slug}/`))!;

test('an appointment funnel reads as question-first with its real section order', { skip: !ready }, () => {
  const s = find('brightside-solar');
  assert.equal(s.status, 'ok');
  if (s.status !== 'ok') return;
  assert.equal(s.funnel.first_ask.ask, 'question');
  assert.equal(s.funnel.headline.type, 'question');
  assert.deepEqual(s.funnel.sequence, ['hero', 'benefits', 'proof', 'story', 'faq', 'cta']);
  assert.deepEqual(s.funnel.contact_fields.sort(), ['email', 'text']);
  // Tokens match the brand file that built the page.
  const brand = JSON.parse(readFileSync(path.resolve(DIST, '../src/data/brands/brightside-solar.json'), 'utf8'));
  assert.equal(s.tokens.page.bg, brand.tokens['color-bg']);
  assert.ok(s.tokens.colors.some((c) => c.hex === brand.tokens['color-accent'] && c.roles.includes('action')));
  assert.equal(s.tokens.declared['--radius'], brand.tokens.radius);
});

test('a webinar funnel finds its agenda and a single-page lead magnet its order', { skip: !ready }, () => {
  const kiln = find('kiln-collective');
  const grid = find('gridline');
  assert.ok(kiln.status === 'ok' && grid.status === 'ok');
  if (kiln.status !== 'ok' || grid.status !== 'ok') return;
  assert.deepEqual(kiln.funnel.sequence, ['hero', 'agenda', 'proof', 'faq', 'capture']);
  assert.equal(kiln.funnel.headline.type, 'named-doubt');
  assert.deepEqual(grid.funnel.sequence, ['hero', 'benefits', 'proof', 'faq', 'capture']);
  assert.equal(grid.funnel.first_ask.ask, 'button');
});

test('a bot check page is recorded as blocked', { skip: !ready }, () => {
  const s = find('blocked');
  assert.equal(s.status, 'blocked');
});

test('the report counts across scans', { skip: !ready }, () => {
  const r = report(scans);
  assert.equal(r.totals.scanned, 4);
  assert.equal(r.totals.blocked, 1);
  assert.ok(r.funnel.first_ask.some((x) => x.value === 'question' && x.count === 1));
  assert.equal(r.funnel.blocks.find((b) => b.kind === 'faq')!.funnels, 3);
});
