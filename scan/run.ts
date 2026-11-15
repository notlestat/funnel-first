// Scan funnels: one shared Chrome, several pages at once, never two at once on the same host.
// Writes one JSON file per URL plus index.jsonl. Code only: no AI per page.
import { chromium, type Browser } from 'playwright-core';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFunnel, type RawFunnel } from './read.ts';
import { blockKind, blockedReason, builder, ctaRepeats, firstAsk, headlineType, tracking } from './classify.ts';

export const SCHEMA = 'funnel-scan/1';

export const viewports = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;
export type ViewportName = keyof typeof viewports;

export interface ScanOptions {
  outDir: string;
  concurrency?: number;
  viewport?: ViewportName;
  screenshot?: boolean;
  timeoutMs?: number;
  onResult?: (scan: FunnelScan) => void;
}

export function scanId(url: string) {
  const u = new URL(url);
  const base = `${u.host}${u.pathname}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${base || 'page'}-${createHash('sha1').update(url).digest('hex').slice(0, 6)}`;
}

export function checkUrl(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Not a URL: ${url}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`Only http and https pages can be scanned: ${url}`);
  return u.href;
}

// The record the backend reads. Field names are the contract; add fields, never rename them.
export function toScan(url: string, raw: RawFunnel, meta: { ms: number; viewport: ViewportName; screenshot: string | null }) {
  const ask = firstAsk(raw.first_screen);
  const blocks = raw.blocks.map((b, i) => ({ order: b.order, ...blockKind(b, i, raw.blocks.length), heading: b.heading, top: b.top, height: b.height }));
  const kinds = blocks.map((b) => b.kind);
  const askBlocks = new Set(blocks.flatMap((b, i) => (b.kind === 'capture' || b.kind === 'question' || b.kind === 'cta' || (b.kind === 'hero' && raw.blocks[i].ctas) ? [i] : [])));
  const proofNearAsk = blocks.some((b, i) => (b.kind === 'proof' || b.kind === 'logo-strip') && (askBlocks.has(i - 1) || askBlocks.has(i + 1) || askBlocks.has(i)));
  const heights = raw.button_heights.slice().sort((a, b) => a - b);
  return {
    schema: SCHEMA,
    id: scanId(url),
    url,
    final_url: raw.final_url,
    status: 'ok' as const,
    scanned_at: new Date().toISOString(),
    viewport: { name: meta.viewport, ...raw.viewport },
    ms: meta.ms,
    title: raw.title,
    lang: raw.lang,
    screenshot: meta.screenshot,
    tokens: {
      declared: raw.declared,
      page: raw.page,
      display: raw.display,
      colors: raw.colours,
      type: raw.type,
      radius: raw.radius,
      shadow: raw.shadow,
      spacing: { section_padding: raw.section_padding, gap: raw.gaps },
      button: { median_height: heights.length ? heights[Math.floor(heights.length / 2)] : null, count: heights.length },
    },
    assets: raw.assets,
    funnel: {
      headline: { text: raw.headline, type: headlineType(raw.headline) },
      first_ask: ask,
      blocks,
      sequence: kinds.filter((k) => k !== 'nav' && k !== 'footer'),
      ctas: raw.ctas.map(({ text, href, top, height, kind }) => ({ text, href, top, height, kind, above_fold: top < raw.viewport.h })),
      cta_repeats: ctaRepeats(raw.ctas),
      forms: raw.forms,
      loose_inputs: raw.loose_inputs,
      // Typed contact fields only: tap answers (radio, checkbox) are questions, not contact details.
      contact_fields: [...new Set(raw.forms.flatMap((f) => f.fields.map((x) => x.type)).filter((t) => !['radio', 'checkbox', 'range'].includes(t)))],
      proof: {
        blocks: kinds.filter((k) => k === 'proof').length,
        logo_strip: kinds.includes('logo-strip'),
        rating: raw.blocks.map((b) => b.rating).find(Boolean) ?? null,
        near_ask: proofNearAsk,
      },
      video: { present: raw.assets.videos.length > 0, first_top: raw.assets.videos[0]?.top ?? null },
      page_height: raw.page_height,
    },
    stack: { builder: builder(raw.stack), tracking: tracking(raw.stack) },
    limitations: [
      'Heuristic labels from one page load without interaction. Later steps of a multi-step funnel are not visited.',
      ...(raw.inner_scroll ? ['The page scrolls inside a container. Block positions are approximate.'] : []),
      ...(raw.blocked_sheets ? [`${raw.blocked_sheets} cross-origin stylesheet(s) unreadable: declared variables and font files may be incomplete.`] : []),
    ],
  };
}

export type FunnelScan = ReturnType<typeof toScan> | {
  schema: typeof SCHEMA; id: string; url: string; status: 'blocked' | 'error'; reason: string; scanned_at: string; ms: number;
};

async function scanOne(browser: Browser, url: string, opts: Required<Omit<ScanOptions, 'onResult'>>): Promise<FunnelScan> {
  const id = scanId(url);
  const started = Date.now();
  const context = await browser.newContext({ viewport: viewports[opts.viewport], isMobile: opts.viewport === 'mobile', hasTouch: opts.viewport === 'mobile' });
  const page = await context.newPage();
  // Skip downloading video and audio: the scan reads players, not footage.
  await page.route('**/*', (route) => (route.request().resourceType() === 'media' ? route.abort() : route.continue()));
  try {
    await page.goto(url, { waitUntil: 'load', timeout: opts.timeoutMs });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const blocked = blockedReason(title, bodyText);
    if (blocked) return { schema: SCHEMA, id, url, status: 'blocked', reason: blocked, scanned_at: new Date().toISOString(), ms: Date.now() - started };
    const raw = await page.evaluate(readFunnel);
    let screenshot: string | null = null;
    if (opts.screenshot) {
      screenshot = `shots/${id}.jpg`;
      await page.screenshot({ path: path.join(opts.outDir, screenshot), type: 'jpeg', quality: 60 });
    }
    return toScan(url, raw, { ms: Date.now() - started, viewport: opts.viewport, screenshot });
  } catch (error) {
    return { schema: SCHEMA, id, url, status: 'error', reason: (error as Error).message.split('\n')[0], scanned_at: new Date().toISOString(), ms: Date.now() - started };
  } finally {
    await context.close();
  }
}

export async function scanUrls(urls: string[], options: ScanOptions): Promise<FunnelScan[]> {
  const opts = { concurrency: 4, viewport: 'mobile' as ViewportName, screenshot: true, timeoutMs: 30_000, ...options };
  const clean = [...new Set(urls.map(checkUrl))];
  await mkdir(path.join(opts.outDir, 'shots'), { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results: FunnelScan[] = [];
  const hostBusy = new Set<string>();
  const queue = [...clean];
  try {
    const worker = async () => {
      while (queue.length) {
        // Take the next URL whose host is free, so no site gets two pages at once.
        const i = queue.findIndex((u) => !hostBusy.has(new URL(u).host));
        if (i === -1) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        const [url] = queue.splice(i, 1);
        const host = new URL(url).host;
        hostBusy.add(host);
        const scan = await scanOne(browser, url, { ...opts, outDir: opts.outDir });
        await new Promise((r) => setTimeout(r, 500)); // a short pause before the same host is used again
        hostBusy.delete(host);
        results.push(scan);
        await writeFile(path.join(opts.outDir, `${scan.id}.json`), JSON.stringify(scan, null, 2));
        await appendFile(path.join(opts.outDir, 'index.jsonl'), JSON.stringify(summary(scan)) + '\n');
        opts.onResult?.(scan);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, 16)) }, worker));
  } finally {
    await browser.close();
  }
  return results;
}

// One line per scan, for the index and the viewer's list.
export function summary(scan: FunnelScan) {
  if (scan.status !== 'ok') return { id: scan.id, url: scan.url, status: scan.status, reason: scan.reason, scanned_at: scan.scanned_at, ms: scan.ms };
  return {
    id: scan.id,
    url: scan.url,
    status: scan.status,
    scanned_at: scan.scanned_at,
    ms: scan.ms,
    title: scan.title,
    headline_type: scan.funnel.headline.type,
    first_ask: scan.funnel.first_ask.ask,
    sequence: scan.funnel.sequence,
    builder: scan.stack.builder[0] ?? null,
    screenshot: scan.screenshot,
  };
}
