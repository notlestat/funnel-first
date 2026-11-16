import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import type { Finding, PageResult, Rect } from './types.ts';

interface Metrics { cls: number | null; lcpMs: number | null }
declare global { interface Window { __funnelQa: Metrics } }

export async function observe(page: Page) {
  await page.addInitScript(() => {
    window.__funnelQa = { cls: null, lcpMs: null };
    let sessionStart = 0, last = 0, sessionScore = 0;
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
      window.__funnelQa.cls = 0;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!('hadRecentInput' in entry) || entry.hadRecentInput || !('value' in entry) || typeof entry.value !== 'number') continue;
          if (entry.startTime - last > 1000 || entry.startTime - sessionStart > 5000) { sessionStart = entry.startTime; sessionScore = 0; }
          last = entry.startTime;
          sessionScore += entry.value;
          window.__funnelQa.cls = Math.max(window.__funnelQa.cls ?? 0, sessionScore);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }
    if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__funnelQa.lcpMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    }
  });
}

// This function is serialized into Chrome. Keep every helper inside it.
export async function inspect(page: Page, firstScreen = true): Promise<Finding[]> {
  return page.evaluate(({ firstScreen }) => {
    const found: Finding[] = [];
    const selector = (el: Element): string => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      if (el === document.documentElement) return 'html';
      const parent = el.parentElement;
      if (!parent) return el.localName;
      return `${selector(parent)} > ${el.localName}:nth-child(${Array.from(parent.children).indexOf(el) + 1})`;
    };
    const section = (el: Element) => {
      const block = el.closest('[data-flow], .section, section, header, footer');
      if (!block) return 'page';
      if (block.matches('[data-flow]')) return 'flow';
      if (block.matches('header, .hero')) return 'hero';
      if (block.matches('.video')) return 'video';
      return block.getAttribute('aria-labelledby')?.replace(/-heading$/, '') || block.id || 'page';
    };
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
    };
    const visible = (el: HTMLElement) => {
      const s = getComputedStyle(el);
      return !!el.getClientRects().length && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0 && !el.closest('[hidden]');
    };
    const add = (el: Element, check: string, severity: Finding['severity'], message: string) => found.push({ selector: selector(el), section: section(el), rect: rect(el), check, severity, message });
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width + 1) add(document.documentElement, 'overflow', 'error', `Document width ${document.documentElement.scrollWidth}px exceeds ${width}px.`);
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!visible(el) || ['SCRIPT', 'STYLE', 'LINK', 'META'].includes(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > width + 1 || r.left < -1 || r.right > width + 1) add(el, 'overflow', 'error', `Element spans ${Math.round(r.left)} to ${Math.round(r.right)}px in a ${width}px viewport.`);
      if (width === 390 && el.matches('button, a[href], input:not([type=hidden]), select, textarea')) {
        // A labelled radio/checkbox can be tapped anywhere in its enclosing label.
        const label = el instanceof HTMLInputElement && ['radio', 'checkbox'].includes(el.type) ? el.labels?.[0] : null;
        const target = label && label.contains(el) ? label : el;
        const t = target.getBoundingClientRect();
        if (t.width < 44 || t.height < 44) add(target, 'tap-target', 'warning', `Tap area ${Math.round(t.width)} × ${Math.round(t.height)}px, below 44 × 44px.`);
      }
      const hasText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
      if (hasText) {
        // Text may be clipped by the element itself or by any overflow ancestor.
        const range = document.createRange();
        range.selectNodeContents(el);
        const textRects = Array.from(range.getClientRects());
        for (let clip: HTMLElement | null = el; clip; clip = clip.parentElement) {
          const s = getComputedStyle(clip);
          const box = clip.getBoundingClientRect();
          const hidesY = ['hidden', 'clip'].includes(s.overflowY) || (s.webkitLineClamp !== 'none' && Number(s.webkitLineClamp) > 0);
          const hidesX = ['hidden', 'clip'].includes(s.overflowX);
          if ((hidesY && ((clip === el && el.scrollHeight > el.clientHeight + 1) || textRects.some(t => t.bottom > box.bottom + 1 || t.top < box.top - 1))) ||
            (hidesX && ((clip === el && el.scrollWidth > el.clientWidth + 1) || textRects.some(t => t.right > box.right + 1 || t.left < box.left - 1)))) {
            add(el, 'clipped-text', 'error', `Text is clipped by ${selector(clip)}.`);
            break;
          }
        }
      }
    }
    if (width === 390 && firstScreen) {
      const question = document.querySelector<HTMLElement>('[data-flow] [data-kind=question]:not([hidden])');
      const ask = question ?? document.querySelector<HTMLElement>('.hero .button, header .button, [data-primary-cta]');
      if (!ask) add(document.body, 'first-screen-cta', 'error', 'No primary CTA or first question found.');
      else {
        const r = ask.getBoundingClientRect();
        if (!visible(ask) || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > width) add(ask, 'first-screen-cta', 'error', `The ${question ? 'complete first question' : 'primary CTA'} is not fully visible in the first ${innerHeight}px.`);
      }
    }
    for (const image of document.images) {
      if (!visible(image)) continue;
      const r = image.getBoundingClientRect();
      if (!image.hasAttribute('width') || !image.hasAttribute('height') || Number(image.getAttribute('width')) <= 0 || Number(image.getAttribute('height')) <= 0) add(image, 'image-dimensions', 'warning', 'Image is missing positive width and height attributes.');
      if (image.naturalWidth > r.width * 2 + 1 || image.naturalHeight > r.height * 2 + 1) add(image, 'image-oversized', 'warning', `Image ${image.naturalWidth} × ${image.naturalHeight}px renders at ${Math.round(r.width)} × ${Math.round(r.height)}px.`);
      if (image.complete && image.naturalWidth === 0) add(image, 'failed-request', 'error', `Image failed to decode: ${image.currentSrc || image.src}`);
    }
    return found;
  }, { firstScreen });
}

async function photoContrast(page: Page): Promise<Finding[]> {
  const candidates = await page.evaluate(() => {
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const selector = (el: Element): string => el.id ? `#${CSS.escape(el.id)}` : el.parentElement ? `${selector(el.parentElement)} > ${el.localName}:nth-child(${Array.from(el.parentElement.children).indexOf(el) + 1})` : 'html';
    return Array.from(document.querySelectorAll<HTMLElement>('body *')).flatMap(el => {
      if (!Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) || !el.getClientRects().length || el.closest('[hidden]')) return [];
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return [];
      let imageBehind = false;
      let opacity = 1;
      for (let ancestor: HTMLElement | null = el; ancestor; ancestor = ancestor.parentElement) {
        const s = getComputedStyle(ancestor);
        opacity *= Number(s.opacity);
        if (s.backgroundImage.includes('url(')) imageBehind = true;
        // The hero uses an absolutely positioned img under the text and scrim.
        if (Array.from(ancestor.children).some(child => child instanceof HTMLImageElement && getComputedStyle(child).position === 'absolute' && overlap(r, child.getBoundingClientRect()))) imageBehind = true;
      }
      if (!imageBehind || !opacity) return [];
      const color = getComputedStyle(el).color;
      const section = el.closest('.section, section, header')?.getAttribute('aria-labelledby')?.replace(/-heading$/, '') ?? (el.closest('header, .hero') ? 'hero' : 'page');
      return [{ selector: selector(el), section, color, opacity, rect: { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height } }];
    });
  });
  if (!candidates.length) return [];
  const style = await page.addStyleTag({ content: '* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important }' });
  let buffer: Buffer;
  try { buffer = await page.screenshot({ fullPage: true, animations: 'disabled' }); }
  finally { await style.evaluate(el => el.parentNode?.removeChild(el)); }
  // Decode the screenshot in Chrome rather than adding a PNG dependency.
  const sampler = await page.context().newPage();
  try {
    return await sampler.evaluate(async ({ data, candidates }) => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('No screenshot canvas');
      ctx.drawImage(image, 0, 0);
      const luminance = (rgb: number[]) => rgb.map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const results: Finding[] = [];
      for (const c of candidates) {
        ctx.fillStyle = c.color; ctx.clearRect(0, 0, 1, 1); ctx.fillRect(0, 0, 1, 1);
        const fg = Array.from(ctx.getImageData(0, 0, 1, 1).data);
        ctx.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
        let minimum = 21;
        for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
          const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(c.rect.x + c.rect.width * (col + 0.5) / 7)));
          const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(c.rect.y + c.rect.height * (row + 0.5) / 7)));
          const bg = Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
          const alpha = fg[3] / 255 * c.opacity;
          const ink = fg.slice(0, 3).map((v, i) => v * alpha + bg[i] * (1 - alpha));
          const a = luminance(ink), b = luminance(bg);
          minimum = Math.min(minimum, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
        }
        if (minimum < 4.5) results.push({ check: 'photo-contrast', severity: 'warning', selector: c.selector, section: c.section, rect: c.rect, message: `Sampled screenshot background reaches ${minimum.toFixed(2)}:1 contrast, below 4.5:1.` });
      }
      return results;
    }, { data: `data:image/png;base64,${buffer.toString('base64')}`, candidates });
  } finally { await sampler.close(); }
}

async function evidence(page: Page, finding: Finding, file: string) {
  const r = finding.rect;
  const bounds = await page.evaluate(() => ({ width: Math.max(innerWidth, document.documentElement.scrollWidth), height: Math.max(innerHeight, document.documentElement.scrollHeight) }));
  const x = Math.max(0, Math.min(bounds.width - 1, r.x - 16));
  const y = Math.max(0, Math.min(bounds.height - 1, r.y - 16));
  const overlay = await page.evaluateHandle(r => {
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'absolute', left: `${Math.max(0, r.x)}px`, top: `${Math.max(0, r.y)}px`, width: `${Math.max(2, r.width)}px`, height: `${Math.max(2, r.height)}px`, outline: '3px solid #d00000', outlineOffset: '-3px', zIndex: '2147483647', pointerEvents: 'none' });
    document.body.append(box);
    return box;
  }, r);
  try {
    await page.screenshot({ path: file, fullPage: true, clip: { x, y, width: Math.max(1, Math.min(bounds.width - x, r.width + 32, 1500)), height: Math.max(1, Math.min(bounds.height - y, r.height + 32, 900)) }, animations: 'disabled' });
  } finally { await overlay.evaluate(el => el.remove()); await overlay.dispose(); }
}

export async function checkPage(browser: Browser, options: { url: string; brand: string; case: string; viewport: { width: number; height: number }; outDir: string; prefix: string }): Promise<PageResult> {
  const context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const result: PageResult = { brand: options.brand, case: options.case, viewport: options.viewport, url: options.url, findings: [], sections: [], metrics: { cls: null, lcpMs: null }, limitations: ['Local Chrome load, no CPU or network throttle. CLS and LCP cover the initial observation window, not field performance.', 'Photo contrast samples a 7 by 7 grid behind each text box. Image-backed text with masks, blending or overlapping layers needs manual review.'] };
  const requestFailures: { url: string; message: string }[] = [];
  const imageBytes = new Map<string, number>();
  const responseJobs: Promise<void>[] = [];
  const pageFinding = (check: string, severity: Finding['severity'], message: string): Finding => ({ check, severity, message, selector: 'html', section: 'page', rect: { x: 0, y: 0, width: options.viewport.width, height: options.viewport.height } });
  try {
    page.on('console', msg => { if (msg.type() === 'error') result.findings.push(pageFinding('console-error', 'warning', msg.text())); });
    page.on('pageerror', error => result.findings.push(pageFinding('console-error', 'warning', error.message)));
    page.on('requestfailed', req => requestFailures.push({ url: req.url(), message: req.failure()?.errorText ?? 'Failed request' }));
    page.on('response', response => {
      if (response.status() >= 400) requestFailures.push({ url: response.url(), message: `HTTP ${response.status()}` });
      if (response.request().resourceType() === 'image') responseJobs.push((async () => {
        try { imageBytes.set(response.url(), (await response.body()).length); } catch { /* Failed bodies are recorded by requestfailed. */ }
      })());
    });
    await observe(page);
    await page.goto(options.url, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(1200);
    result.metrics = await page.evaluate(() => window.__funnelQa);
    result.findings.push(...await inspect(page));
    if (options.viewport.width === 390) {
      if (result.metrics.cls !== null && result.metrics.cls > 0.1) result.findings.push(pageFinding('cls', 'warning', `CLS ${result.metrics.cls.toFixed(3)} exceeds 0.1.`));
      if (result.metrics.lcpMs !== null && result.metrics.lcpMs > 2500) result.findings.push(pageFinding('lcp', 'warning', `LCP ${Math.round(result.metrics.lcpMs)}ms exceeds 2500ms.`));
      if (result.metrics.cls === null || result.metrics.lcpMs === null) result.limitations.push('One or more PerformanceObserver metrics were unavailable.');
    }
    // Trigger lazy images before inspecting assets and making the section contact sheet.
    await page.evaluate(async () => {
      for (const img of document.images) { img.loading = 'eager'; }
      await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
    });
    const afterImages = await inspect(page, false);
    result.findings.push(...afterImages);
    result.findings.push(...await photoContrast(page));
    await Promise.all(responseJobs);
    const images = await page.evaluate(() => {
      const selector = (el: Element): string => el.id ? `#${CSS.escape(el.id)}` : el.parentElement ? `${selector(el.parentElement)} > ${el.localName}:nth-child(${Array.from(el.parentElement.children).indexOf(el) + 1})` : 'html';
      const owner = (el: HTMLElement, src: string) => {
        const r = el.getBoundingClientRect();
        const block = el.closest('.section, section, header');
        return { src, selector: selector(el), section: block?.matches('header') ? 'hero' : block?.matches('.video') ? 'video' : block?.getAttribute('aria-labelledby')?.replace(/-heading$/, '') || block?.id || 'page', rect: { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height } };
      };
      const images = Array.from(document.images).map(img => owner(img, img.currentSrc || img.src));
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        if (!el.getClientRects().length) continue;
        for (const match of getComputedStyle(el).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)) images.push(owner(el, new URL(match[1], location.href).href));
      }
      return images;
    });
    for (const image of images) if ((imageBytes.get(image.src) ?? 0) > 300 * 1024) result.findings.push({ ...image, check: 'image-bytes', severity: 'warning', message: `Image response body is ${Math.round(imageBytes.get(image.src)! / 1024)} KB, over 300 KB.` });
    for (const failed of requestFailures) {
      const image = images.find(i => i.src === failed.url);
      result.findings.push(image ? { ...image, check: 'failed-request', severity: 'error', message: `${failed.message}: ${failed.url}` } : pageFinding('failed-request', 'error', `${failed.message}: ${failed.url}`));
    }
    // FAQ answers are hidden at load. Inspect their expanded rendering too.
    await page.evaluate(() => { for (const details of document.querySelectorAll('details')) details.open = true; });
    const expanded = await inspect(page, false);
    result.findings.push(...expanded.map(f => ({ ...f, message: `${f.message} [FAQ expanded]` })));
    // Deduplicate repeat observations while retaining each distinct element/check.
    result.findings = result.findings.filter((f, i, all) => all.findIndex(g => g.check === f.check && g.selector === f.selector && (g.check !== 'failed-request' || g.message === f.message)) === i);
    for (let i = 0; i < result.findings.length; i++) {
      const f = result.findings[i];
      // Re-read geometry after expanding FAQs before drawing evidence.
      const box = await page.locator(f.selector).first().boundingBox().catch(() => null);
      if (box) f.rect = { ...box, y: box.y + await page.evaluate(() => scrollY) };
      f.screenshot = `images/${options.prefix}-finding-${i}.png`;
      await evidence(page, f, path.join(options.outDir, f.screenshot));
    }
    if (options.case !== 'real') {
      const sections = page.locator('main > .section, [data-flow]');
      for (let i = 0; i < await sections.count(); i++) {
        const section = sections.nth(i);
        const name = await section.evaluate(el => el.matches('[data-flow]') ? 'flow' : el.matches('header') ? 'hero' : el.matches('.video') ? 'video' : el.getAttribute('aria-labelledby')?.replace(/-heading$/, '') || el.id || 'section');
        const screenshot = `images/${options.prefix}-section-${i}.png`;
        await section.screenshot({ path: path.join(options.outDir, screenshot), animations: 'disabled' });
        result.sections.push({ section: name, screenshot });
      }
    }
    return result;
  } catch (error) {
    result.findings.push(pageFinding('qa-error', 'error', `Page check failed: ${error instanceof Error ? error.message : String(error)}`));
    for (let i = 0; i < result.findings.length; i++) {
      const f = result.findings[i];
      if (f.screenshot) continue;
      f.screenshot = `images/${options.prefix}-failure-${i}.png`;
      await evidence(page, f, path.join(options.outDir, f.screenshot)).catch(() => { delete f.screenshot; });
    }
    return result;
  } finally { await context.close(); }
}
