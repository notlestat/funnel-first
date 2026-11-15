// Open a client's pages in real Chrome and record computed styles by role.
// Output is an evidence ledger: what was seen, where, and how often. No decisions here.
import { chromium } from 'playwright-core';

export type Viewport = 'desktop' | 'mobile';

export interface Sample {
  page: string;
  viewport: Viewport;
  role: string;
  property: string;
  value: string;
  count: number;
  weight: number;
}

export interface Ledger {
  urls: string[];
  captured_at: string;
  fontsHref?: string;
  customProperties: Record<string, string>;
  samples: Sample[];
  limitations: string[];
}

const viewports: Record<Viewport, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

export async function collect(urls: string[]): Promise<Ledger> {
  for (const url of urls) {
    const { protocol } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') throw new Error(`Only http and https pages can be captured: ${url}`);
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const samples: Sample[] = [];
  const limitations: string[] = [];
  let fontsHref: string | undefined;
  let customProperties: Record<string, string> = {};

  try {
    for (const url of urls) {
      for (const [viewport, size] of Object.entries(viewports) as [Viewport, typeof viewports.desktop][]) {
        const page = await browser.newPage({ viewport: size });
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
          await page.evaluate(() => document.fonts.ready.then(() => undefined));
          const result = await page.evaluate(readPage);
          samples.push(...result.samples.map((s) => ({ ...s, page: url, viewport })));
          fontsHref ??= result.fontsHref;
          if (!Object.keys(customProperties).length) customProperties = result.customProperties;
          if (result.blockedSheets) limitations.push(`${url}: ${result.blockedSheets} cross-origin stylesheet(s) could not be read for custom properties.`);
        } catch (error) {
          limitations.push(`${url} at ${viewport}: ${(error as Error).message.split('\n')[0]}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  limitations.push('Reconstructed from rendered pages. Internal token names, intent and font licences are unknown.');
  return { urls, captured_at: new Date().toISOString().slice(0, 10), fontsHref, customProperties, samples, limitations: [...new Set(limitations)] };
}

// Runs inside the page. Must be self-contained: no imports or outer variables.
function readPage() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Any CSS colour (rgb, oklch, color()) -> #rrggbb, or null if transparent or translucent.
  const hex = (value: string): string | null => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a < 250) return null;
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  const tally = new Map<string, { role: string; property: string; value: string; count: number; weight: number }>();
  const add = (role: string, property: string, value: string | null, weight = 1) => {
    if (!value) return;
    const key = `${role}|${property}|${value}`;
    const entry = tally.get(key) ?? { role, property, value, count: 0, weight: 0 };
    entry.count += 1;
    entry.weight += weight;
    tally.set(key, entry);
  };

  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const all = (selector: string) => [...document.querySelectorAll(selector)].filter(visible);

  // Page
  const body = getComputedStyle(document.body);
  const pageBg = hex(body.backgroundColor) ?? hex(getComputedStyle(document.documentElement).backgroundColor) ?? '#FFFFFF';
  add('page', 'background-color', pageBg);
  add('page', 'color', hex(body.color));
  add('page', 'font-family', body.fontFamily);
  add('page', 'font-size', body.fontSize);

  // Headings
  for (const level of ['h1', 'h2', 'h3']) {
    for (const el of all(level).slice(0, 6)) {
      const s = getComputedStyle(el);
      add(level, 'font-family', s.fontFamily);
      add(level, 'font-size', s.fontSize);
      add(level, 'font-weight', s.fontWeight);
      add(level, 'color', hex(s.color));
    }
  }

  // Display text: the largest visible text in the first screen and a half.
  // Sites often use <h1> for a small label, so the hero is found by size, not by tag.
  let display: Element | null = null;
  let displaySize = 0;
  for (const el of all('h1, h2, h3, h4, p, span, a, div, strong')) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 2);
    if (!hasText || el.getBoundingClientRect().top > innerHeight * 1.5) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size > displaySize) [display, displaySize] = [el, size];
  }
  if (display) {
    const s = getComputedStyle(display);
    add('display', 'font-size', s.fontSize);
    add('display', 'font-family', s.fontFamily);
    add('display', 'font-weight', s.fontWeight);
  }

  // Running text, weighted by how much text uses it
  for (const el of all('p, li, figcaption, small, label, dd, td')) {
    const s = getComputedStyle(el);
    const chars = (el.textContent ?? '').trim().length;
    if (!chars) continue;
    add('text', 'color', hex(s.color), chars);
    add('text', 'font-size', s.fontSize, chars);
  }

  // Primary actions: button-like elements with a solid fill
  for (const el of all('button, input[type="submit"], [role="button"], a[class*="btn" i], a[class*="button" i], a[class*="cta" i]')) {
    const s = getComputedStyle(el);
    const fill = hex(s.backgroundColor);
    if (!fill || fill === pageBg) continue;
    add('action', 'background-color', fill);
    add('action', 'color', hex(s.color));
    add('action', 'border-radius', s.borderTopLeftRadius);
    add('action', 'font-weight', s.fontWeight);
  }

  // Inputs
  for (const el of all('input[type="email"], input[type="text"], input:not([type]), textarea, select')) {
    const s = getComputedStyle(el);
    add('input', 'border-color', hex(s.borderTopColor));
    add('input', 'border-radius', s.borderTopLeftRadius);
  }

  // Surfaces: large filled areas that differ from the page background, weighted by area
  for (const el of all('div, section, article, aside, header, footer, li, form')) {
    const fill = hex(getComputedStyle(el).backgroundColor);
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (fill && fill !== pageBg && area >= 20_000) add('surface', 'background-color', fill, area);
  }

  // Borders and dividers
  for (const el of all('*')) {
    const s = getComputedStyle(el);
    for (const side of ['Top', 'Bottom'] as const) {
      if (parseFloat(s[`border${side}Width`]) >= 1 && s[`border${side}Style`] !== 'none') {
        add('border', 'color', hex(s[`border${side}Color`]));
      }
    }
  }

  // Section rhythm
  for (const el of all('section, header, footer, main > *')) {
    const pad = parseFloat(getComputedStyle(el).paddingTop);
    if (pad >= 24) add('section', 'padding-top', `${Math.round(pad)}px`);
  }

  // Content width: the nearest ancestor of the main heading that is capped by max-width,
  // or that is narrower than the page and centred (width: min(...) with margin auto).
  let node = document.querySelector('h1')?.parentElement ?? null;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    if (cs.maxWidth !== 'none' && cs.maxWidth.endsWith('px')) {
      add('container', 'max-width', `${Math.round(parseFloat(cs.maxWidth))}px`);
      break;
    }
    const width = node.getBoundingClientRect().width;
    const ml = parseFloat(cs.marginLeft);
    if (width < innerWidth - 40 && ml > 0 && Math.abs(ml - parseFloat(cs.marginRight)) < 2) {
      add('container', 'max-width', `${Math.round(width)}px`);
      break;
    }
    node = node.parentElement;
  }

  // Custom properties declared on :root in readable stylesheets
  const customProperties: Record<string, string> = {};
  let blockedSheets = 0;
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      blockedSheets += 1;
      continue;
    }
    for (const rule of [...rules]) {
      if (rule instanceof CSSStyleRule && /^(:root|html)$/.test(rule.selectorText.trim())) {
        for (const prop of [...rule.style]) {
          if (prop.startsWith('--') && Object.keys(customProperties).length < 150) {
            customProperties[prop] = rule.style.getPropertyValue(prop).trim();
          }
        }
      }
    }
  }
  // Inline :root variables count too (some sites set them on the html element)
  for (const prop of [...document.documentElement.style]) {
    if (prop.startsWith('--')) customProperties[prop] = document.documentElement.style.getPropertyValue(prop).trim();
  }

  const fontsHref = (document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]') as HTMLLinkElement | null)?.href;
  return { samples: [...tally.values()], customProperties, blockedSheets, fontsHref };
}
