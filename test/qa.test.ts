import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser } from 'playwright-core';
import { load } from './helpers.ts';
import { brandSchema } from '../src/system/schema.ts';
import { stressCases } from '../qa/stress.ts';
import { brandFiles, buildStress, requireFreshBuild } from '../qa/build.ts';
import { checkPage, inspect, observe } from '../qa/browser.ts';
import { serve } from '../qa/server.ts';
import { escapeHtml, writeReport } from '../qa/report.ts';

test('stress copies are independent, schema-valid, and exercise exact content boundaries', () => {
  for (const id of ['gridline', 'brightside-solar', 'ironwood-coaching', 'fieldnote-studio', 'kiln-collective']) {
    const brand = load(id);
    const original = JSON.stringify(brand);
    const cases = stressCases(brand, `/brands/${id}/portrait.svg`);
    assert.equal(cases.length, 9);
    for (const c of cases) assert.equal(brandSchema.safeParse(c.brand).success, true, `${id}/${c.id}: ${c.notes}`);
    assert.equal(cases.find(c => c.id === 'headline-short')!.brand!.content.hero!.headline.split(' ').length, 3);
    assert.equal(cases.find(c => c.id === 'headline-long')!.brand!.content.hero!.headline.split(' ').length, 16);
    const long = cases.find(c => c.id === 'button-long')!.brand!;
    assert.equal((long.content.hero?.cta ?? long.content.flow?.contact.button)?.length, 28);
    const max = cases.find(c => c.id === 'lists-maximum')!;
    if (max.brand!.content.flow) assert.equal(max.brand!.content.flow.questions[0].options.length, 6);
    if (max.brand!.content.faq) assert.match(max.notes.join(' '), /no schema maximum/);
    assert.equal(JSON.stringify(brand), original, 'Source object must not change');
  }
});

test('schema-invalid stress data is skipped and explained without weakening the schema', () => {
  const cases = stressCases(load('gridline'), 'https://remote.example/portrait.png');
  const portrait = cases.find(c => c.id === 'portrait-image')!;
  assert.equal(portrait.brand, null);
  assert.match(portrait.notes.join(' '), /local file/);
});

test('a missing or stale build is refused, and brand paths cannot escape', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'qa-fresh-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/data/brands'), { recursive: true });
  await writeFile(path.join(root, 'src/data/brands/gridline.json'), JSON.stringify(load('gridline')));
  await assert.rejects(requireFreshBuild(root, ['gridline']), /fresh dist/);
  await assert.rejects(brandFiles(root, ['../gridline']), /Unknown brand/);
  await mkdir(path.join(root, 'dist/gridline'), { recursive: true });
  await writeFile(path.join(root, 'dist/gridline/index.html'), 'built');
  await requireFreshBuild(root, ['gridline']);
  await new Promise(resolve => setTimeout(resolve, 20));
  await writeFile(path.join(root, 'src/change.ts'), 'changed');
  await assert.rejects(requireFreshBuild(root, ['gridline']), /fresh dist/);
});

let browser: Browser;
let fixture: Awaited<ReturnType<typeof serve>>;
let root: string;
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'qa-browser-test-'));
  await mkdir(path.join(root, 'images'));
  await cp(new URL('./fixtures/qa/index.html', import.meta.url), path.join(root, 'index.html'));
  await writeFile(path.join(root, 'photo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200"><rect width="600" height="1200" fill="white"/><!--${'x'.repeat(310 * 1024)}--></svg>`);
  fixture = await serve(root);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});
after(async () => { await browser?.close(); await fixture?.close(); if (root) await rm(root, { recursive: true, force: true }); });

test('Chrome finds overflow, small targets, clipping, image issues, pixel contrast and failed requests', async () => {
  const result = await checkPage(browser, { url: fixture.url, brand: 'fixture', case: 'fixture-stress', viewport: { width: 390, height: 844 }, outDir: root, prefix: 'fixture' });
  const has = (check: string, selector?: string) => result.findings.some(f => f.check === check && (!selector || f.selector === selector));
  assert.ok(has('overflow', '#wide'));
  assert.ok(has('tap-target', '#small'));
  assert.ok(!has('tap-target', '#safe'));
  assert.ok(has('clipped-text', '#clipped'));
  assert.ok(has('clipped-text', '#child'));
  assert.ok(has('photo-contrast', '#low'));
  assert.ok(has('image-dimensions', '#huge'));
  assert.ok(has('image-oversized', '#huge'));
  assert.ok(has('image-bytes', '#huge'));
  assert.ok(has('image-bytes', '#photo'), 'CSS image backgrounds also have a byte budget');
  assert.ok(has('failed-request', '#broken'));
  assert.ok(has('console-error'));
  assert.ok(has('tap-target', '#below'), 'Evidence crops work below the initial viewport');
  assert.ok(!result.findings.some(f => f.message.startsWith('Page check failed:')), 'A finding must not break later section screenshots');
  assert.ok(!has('failed-request', '#lazy'), 'Lazy images are loaded before judging decode failures');
  assert.equal(result.findings.find(f => f.selector === '#wide')?.section, 'proof');
  assert.equal(result.findings.find(f => f.check === 'overflow')?.severity, 'error');
  assert.equal(result.findings.find(f => f.check === 'tap-target')?.severity, 'warning');
  for (const f of result.findings) assert.ok((await stat(path.join(root, f.screenshot!))).size > 0);
  assert.deepEqual(result.sections.map(s => s.section), ['hero', 'proof']);
  const crop = await readFile(path.join(root, result.findings.find(f => f.selector === '#below')!.screenshot!));
  const sampler = await browser.newPage();
  try {
    const redPixels = await sampler.evaluate(async data => {
      const img = new Image(); img.src = data; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let red = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 180 && pixels[i + 1] < 40 && pixels[i + 2] < 40) red++;
      return red;
    }, `data:image/png;base64,${crop.toString('base64')}`);
    assert.ok(redPixels > 40, 'The below-fold evidence visibly outlines its target in red');
  } finally { await sampler.close(); }
  const reportDir = path.join(root, 'report');
  await mkdir(reportDir);
  await writeReport({ schema: 'funnel-qa/1', generatedAt: new Date().toISOString(), brands: ['fixture'], stress: [], pages: [result] }, reportDir);
  assert.match(await readFile(path.join(reportDir, 'index.html'), 'utf8'), /outlined in red/);
  assert.equal(JSON.parse(await readFile(path.join(reportDir, 'report.json'), 'utf8')).pages.length, 1);
});

test('a CTA below the fold fails only the phone first-screen pass', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.setContent('<header class="hero" style="padding-top:900px"><a class="button" href="#x">Start</a></header>');
    assert.ok((await inspect(page)).some(f => f.check === 'first-screen-cta'));
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.ok(!(await inspect(page)).some(f => f.check === 'first-screen-cta'));
  } finally { await page.close(); }
});

test('hidden flow steps do not produce false clipping or overflow errors', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.setContent('<header class="hero"><a class="button" href="#x">Start</a></header><div hidden style="width:900px"><h2 style="height:10px;overflow:hidden">Hidden long heading</h2></div>');
    assert.deepEqual((await inspect(page)).filter(f => ['overflow', 'clipped-text'].includes(f.check)), []);
  } finally { await page.close(); }
});

test('PerformanceObserver records a real layout shift and LCP before interaction', async () => {
  const page = await browser.newPage();
  try {
    await observe(page);
    await page.goto(fixture.url);
    await page.waitForTimeout(200);
    await page.evaluate(() => { document.querySelector('header')!.style.height = '400px'; });
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => window.__funnelQa);
    assert.ok(metrics.cls !== null && metrics.cls > 0.1, JSON.stringify(metrics));
    assert.ok(metrics.lcpMs !== null && metrics.lcpMs > 0);
  } finally { await page.close(); }
});

test('temporary stress build uses the real pages and cleans up without touching source brands', async t => {
  const repo = path.resolve(import.meta.dirname, '..');
  const before = await readFile(path.join(repo, 'src/data/brands/gridline.json'), 'utf8');
  const stress = await buildStress(repo, [{ id: 'gridline', brand: load('gridline') }]);
  t.after(stress.cleanup);
  const built = await readFile(path.join(stress.root, 'gridline-qa-headline-short/index.html'), 'utf8');
  assert.match(built, /Find your answer/);
  const portrait = await readFile(path.join(stress.root, 'gridline-qa-portrait-image/index.html'), 'utf8');
  assert.match(portrait, /qa-portrait\.svg/);
  assert.equal(await readFile(path.join(repo, 'src/data/brands/gridline.json'), 'utf8'), before);
  await stress.cleanup();
  await assert.rejects(stat(stress.root), /ENOENT/);
});

test('report escapes untrusted strings', () => {
  assert.equal(escapeHtml('<script>"x" & \'y\'</script>'), '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
});
