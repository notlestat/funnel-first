// The event contract. readUtm runs anywhere. The browser part taps through built funnels
// and checks what each one sends. It needs `npm run build` first and Google Chrome; it skips otherwise.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { readUtm, type SentEvent } from '../src/system/events.ts';
import { serve } from '../qa/server.ts';

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

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
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
