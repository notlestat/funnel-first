// The event contract and the PostHog sink. The first tests run anywhere. The browser part taps through
// built funnels and checks what each one sends. It needs `npm run build` first and Google Chrome; it skips otherwise.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium, type Browser, type Page } from 'playwright-core';
import { readUtm, type SentEvent } from '../src/system/events.ts';
import { posthogOptions, stripUrlQueries } from '../src/system/analytics.ts';
import { validateBrand } from '../src/system/validate.ts';
import { launchChecks } from '../src/system/rules.ts';
import { runBuild } from '../qa/build.ts';
import { serve } from '../qa/server.ts';
import { load } from './helpers.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testAnalytics = { provider: 'posthog', key: 'phc_testkey1234567890', region: 'eu' } as const;

test('readUtm keeps the five UTM keys and ignores everything else', () => {
  const utm = readUtm('?utm_source=meta&utm_medium=paid&utm_campaign=spring&utm_content=v2&utm_term=physio&email=a@b.com&gclid=x');
  assert.deepEqual(utm, { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'spring', utm_content: 'v2', utm_term: 'physio' });
});

test('readUtm trims values, drops empty ones and caps long ones', () => {
  const utm = readUtm(`?utm_source=%20meta%20&utm_medium=&utm_campaign=${'x'.repeat(300)}`);
  assert.equal(utm.utm_source, 'meta');
  assert.equal('utm_medium' in utm, false);
  assert.equal(utm.utm_campaign?.length, 100);
});

test('readUtm returns nothing for a link without UTMs', () => {
  assert.deepEqual(readUtm(''), {});
});

test('PostHog runs with no storage, no autocapture, no recordings and no campaign copies', () => {
  const options = posthogOptions('eu');
  assert.equal(options.api_host, 'https://eu.i.posthog.com');
  assert.equal(options.persistence, 'memory');
  assert.equal(options.autocapture, false);
  assert.equal(options.disable_session_recording, true);
  assert.equal(options.disable_external_dependency_loading, true);
  assert.equal(options.save_campaign_params, false);
  assert.equal(options.before_send, stripUrlQueries);
});

test('every URL PostHog attaches leaves without its query and hash', () => {
  const event = stripUrlQueries({
    uuid: '1',
    event: 'funnel_viewed',
    properties: { $current_url: 'https://a.example/ironwood/?utm_source=meta&email=a%40b.com#top', $referrer: 'https://www.google.com/search?q=knee+pain', brand: 'ironwood', step: 2 },
    $set_once: { $initial_current_url: 'https://a.example/?email=a%40b.com' },
  });
  assert.deepEqual(event?.properties, { $current_url: 'https://a.example/ironwood/', $referrer: 'https://www.google.com/search', brand: 'ironwood', step: 2 });
  assert.equal(event?.$set_once?.$initial_current_url, 'https://a.example/');
});

test('the brand file takes a PostHog project key and refuses a personal one', () => {
  const brand = load('gridline');
  brand.analytics = { ...testAnalytics };
  assert.equal(validateBrand(brand, []).ok, true);
  brand.analytics.key = 'phx_personalkey1234567890';
  assert.ok(validateBrand(brand, []).errors.some((e) => e.startsWith('analytics.key')));
});

test('a brand without analytics is not launch-ready', () => {
  const brand = load('gridline');
  assert.ok(launchChecks(brand).some((c) => c.status === 'waiting' && c.label === 'analytics not set, nothing is measured'));
  brand.analytics = { ...testAnalytics };
  assert.ok(launchChecks(brand).some((c) => c.status === 'pass' && c.label === 'analytics sends to PostHog'));
});

const DIST = path.join(ROOT, 'dist');
const ready = existsSync(path.join(DIST, 'ironwood-coaching/index.html'));
const skip = !ready && 'run npm run build first';
let browser: Browser;
let site: Awaited<ReturnType<typeof serve>>;

before(async () => {
  if (!ready) return;
  site = await serve(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});
after(async () => {
  await browser?.close();
  await site?.close();
});

const open = async (url: string) => {
  const page = await browser.newPage();
  await page.goto(`${site.url}${url}`);
  return page;
};
const events = (page: Page) => page.evaluate(() => window.__funnelEvents ?? []);
// Each action should send exactly one event, so waiting on the count also checks for doubles.
const waitFor = (page: Page, count: number) => page.waitForFunction((n) => window.__funnelEvents?.length === n, count);
const current = '[data-step]:not([hidden])';

test('a quiz sends each step forward, then the attempt, with UTMs and no answers or contact details', { skip, timeout: 30_000 }, async () => {
  const page = await open('/ironwood-coaching/?utm_source=meta&utm_campaign=spring');
  await waitFor(page, 1);
  await page.locator(`${current} .option input`).first().click(); // question 1
  await waitFor(page, 2);
  await page.locator(`${current} [data-continue]`).click(); // the note
  await waitFor(page, 3);
  await page.locator(`${current} .option input`).first().click(); // question 2
  await waitFor(page, 4);
  await page.locator(`${current} .option input`).first().check(); // question 3 takes several answers
  await page.locator(`${current} [data-continue]`).click();
  await waitFor(page, 5);
  await page.locator(`${current} .option input`).first().click(); // question 4
  await waitFor(page, 6);
  await page.locator(`${current} .option input`).first().click(); // question 5
  await waitFor(page, 7);
  const firstAnswer = await page.locator('[data-step] .option-label').first().textContent();
  await page.fill('#flow-email', 'reader@example.com');
  await page.click(`${current} .submit`);
  await waitFor(page, 8);

  const sent: SentEvent[] = await events(page);
  assert.deepEqual(sent.map((e) => e.name), ['funnel_viewed', ...Array(6).fill('flow_step_reached'), 'capture_attempted']);
  assert.deepEqual(
    sent.filter((e) => e.name === 'flow_step_reached').map((e) => [e.props.step, e.props.kind]),
    [[2, 'note'], [3, 'question'], [4, 'question'], [5, 'question'], [6, 'question'], [7, 'contact']],
  );
  assert.deepEqual(sent.at(-1)!.props, { form: 'flow', delivered: false, utm_source: 'meta', utm_campaign: 'spring', brand: 'ironwood-coaching', recipe: 'quiz' });
  for (const e of sent) assert.equal(e.props.utm_source, 'meta', e.name);
  const all = JSON.stringify(sent);
  assert.equal(all.includes('reader@example.com'), false, 'the email must not be sent');
  assert.equal(all.includes(firstAnswer!.trim()), false, 'answer text must not be sent');
  await page.close();
});

test('an invalid contact step sends no attempt', { skip, timeout: 30_000 }, async () => {
  const page = await open('/gridline/');
  await waitFor(page, 1);
  await page.click('form[data-capture] button[type="submit"]');
  await page.locator('#email-error').waitFor({ state: 'visible' });
  assert.deepEqual((await events(page)).map((e) => e.name), ['funnel_viewed']);
  await page.close();
});

test('a lead magnet sends the hero click and the capture attempt', { skip, timeout: 30_000 }, async () => {
  const page = await open('/gridline/');
  await waitFor(page, 1);
  await page.click('[data-cta="hero"]');
  await waitFor(page, 2);
  await page.fill('form[data-capture] input[type="email"]', 'reader@example.com');
  await page.click('form[data-capture] button[type="submit"]');
  await waitFor(page, 3);
  const sent = await events(page);
  assert.deepEqual(sent.map((e) => [e.name, e.props.location ?? e.props.form ?? null]), [['funnel_viewed', null], ['cta_clicked', 'hero'], ['capture_attempted', 'capture']]);
  await page.close();
});

test('an appointment page names the closing button as the cta location', { skip, timeout: 30_000 }, async () => {
  const page = await open('/brightside-solar/');
  await waitFor(page, 1);
  await page.click('[data-cta="cta"]');
  await waitFor(page, 2);
  assert.deepEqual((await events(page)).at(-1)!.props, { location: 'cta', brand: 'brightside-solar', recipe: 'appointment' });
  await page.close();
});

test('a brand without analytics never downloads PostHog or contacts it', { skip, timeout: 30_000 }, async () => {
  const scripts = (await readdir(path.join(DIST, '_astro'))).filter((f) => f.endsWith('.js'));
  const posthogFiles: string[] = [];
  for (const file of scripts) if ((await readFile(path.join(DIST, '_astro', file), 'utf8')).includes('[PostHog.js]')) posthogFiles.push(file);
  assert.equal(posthogFiles.length, 1, 'PostHog should be one separate file in the build');
  const page = await browser.newPage();
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(`${site.url}/ironwood-coaching/`, { waitUntil: 'networkidle' });
  assert.deepEqual(urls.filter((u) => u.includes(posthogFiles[0]) || u.includes('posthog.com')), []);
  await page.close();
});

// Builds one funnel with analytics on, in a throwaway copy, the way qa/build.ts builds its stress cases.
async function buildWithAnalytics() {
  const temp = await mkdtemp(path.join(tmpdir(), 'measurement-'));
  const cleanup = () => rm(temp, { recursive: true, force: true });
  try {
    await cp(path.join(ROOT, 'src'), path.join(temp, 'src'), { recursive: true, filter: (s) => s !== path.join(ROOT, 'src/data/brands') });
    await mkdir(path.join(temp, 'src/data/brands'));
    await writeFile(path.join(temp, 'src/data/brands/ironwood-coaching.json'), JSON.stringify({ ...load('ironwood-coaching'), analytics: testAnalytics }));
    for (const file of ['package.json', 'astro.config.mjs']) await cp(path.join(ROOT, file), path.join(temp, file));
    if (existsSync(path.join(ROOT, 'public'))) await cp(path.join(ROOT, 'public'), path.join(temp, 'public'), { recursive: true });
    await symlink(path.join(ROOT, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
    await runBuild(temp, path.join(ROOT, 'node_modules/astro/bin/astro.mjs'));
    return { dist: path.join(temp, 'dist'), cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

const until = async (check: () => boolean, ms: number) => {
  for (const end = Date.now() + ms; !check(); await new Promise((r) => setTimeout(r, 100))) {
    if (Date.now() > end) throw new Error(`timed out after ${ms}ms`);
  }
};

test('a brand with analytics sends its events to PostHog, with nothing stored and no query strings', { skip, timeout: 120_000 }, async () => {
  const build = await buildWithAnalytics();
  const local = await serve(build.dist);
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
    // PostHog drops events from browsers that say they are automated. Right for bots, wrong for this test.
    await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const received: { event: string; properties: Record<string, unknown> }[] = [];
    let raw = '';
    // Every request to PostHog is answered here, so nothing reaches the network.
    await page.route(/posthog\.com/, (route) => {
      const body = route.request().postDataBuffer();
      if (body) {
        const text = (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString();
        raw += text;
        const data = JSON.parse(text);
        received.push(...(data.batch ?? [data]));
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });

    await page.goto(`${local.url}/ironwood-coaching/?utm_source=meta&email=reader%40example.com`);
    await waitFor(page, 1);
    await page.locator(`${current} .option input`).first().click();
    await waitFor(page, 2);
    await until(() => received.some((e) => e.event === 'flow_step_reached'), 15_000);

    assert.deepEqual(received.map((e) => e.event), ['funnel_viewed', 'flow_step_reached']);
    for (const e of received) {
      assert.equal(e.properties.brand, 'ironwood-coaching');
      assert.equal(e.properties.utm_source, 'meta');
      for (const value of Object.values(e.properties)) if (typeof value === 'string' && value.startsWith('http')) assert.equal(value.includes('?'), false, value);
    }
    assert.equal(received[1].properties.step, 2);
    assert.equal(/reader(@|%40)example\.com/.test(raw), false, 'the email in the link must not be sent');
    assert.deepEqual(await page.context().cookies(), []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await page.close();
  } finally {
    await local.close();
    await build.cleanup();
  }
});

test('Back sends flow_back with the step it left', { skip, todo: 'add the track call to the Back handler in Flow.astro', timeout: 5_000 }, async () => {
  const page = await open('/ironwood-coaching/');
  await waitFor(page, 1);
  await page.locator(`${current} .option input`).first().click();
  await waitFor(page, 2);
  await page.click('[data-back]');
  await waitFor(page, 3);
  assert.deepEqual((await events(page)).at(-1), { name: 'flow_back', props: { from: 2, brand: 'ironwood-coaching', recipe: 'quiz' } });
  await page.close();
});
