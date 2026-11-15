// Runs inside each extracted page. Collects every asset the page references and every
// component variant, grouped by its exact computed style. Must be self-contained.
export type RawExtract = ReturnType<typeof readCompany>;

export function readCompany(maxPerKind: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const hex = (value: string): string | null => {
    if (!value || value === 'transparent') return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a < 20) return null;
    const h = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    return a < 250 ? `${h}${Math.round(a).toString(16).padStart(2, '0').toUpperCase()}` : h;
  };
  const abs = (url: string | null | undefined) => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return null;
    try {
      return new URL(url, location.href).href;
    } catch {
      return null;
    }
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY) };
  };
  // A short, safe HTML sample: no scripts, no event handlers, no inline data blobs.
  const snippet = (el: Element, max = 1500) => {
    const clone = el.cloneNode(true) as Element;
    for (const s of clone.querySelectorAll('script, style, noscript, iframe')) s.remove();
    for (const node of [clone, ...clone.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if (/^on/i.test(attr.name) || /^javascript:/i.test(attr.value) || attr.value.length > 300) node.removeAttribute(attr.name);
      }
    }
    return clone.outerHTML.replace(/\s+/g, ' ').slice(0, max);
  };
  const largestFromSrcset = (srcset: string | null) => {
    if (!srcset) return null;
    let best: { url: string; w: number } | null = null;
    for (const part of srcset.split(',')) {
      const [url, size] = part.trim().split(/\s+/);
      const w = size?.endsWith('w') ? parseInt(size) : size?.endsWith('x') ? parseFloat(size) * 1000 : 1;
      if (url && (!best || w > best.w)) best = { url, w };
    }
    return best ? abs(best.url) : null;
  };

  // ---- Assets ----
  type Asset = { type: string; url: string; alt?: string; w?: number; h?: number; natural_w?: number; natural_h?: number; context: string; above_fold?: boolean; html?: string; mime?: string };
  const assets: Asset[] = [];
  const seen = new Set<string>();
  const add = (a: Asset) => {
    const key = `${a.type}|${a.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    assets.push(a);
  };
  const isIconSize = (w: number, h: number) => w > 0 && h > 0 && w <= 64 && h <= 64;

  for (const img of document.querySelectorAll('img')) {
    const i = img as HTMLImageElement;
    const b = box(i);
    const url = largestFromSrcset(i.getAttribute('srcset')) ?? abs(i.currentSrc || i.getAttribute('src') || i.getAttribute('data-src'));
    if (!url) continue;
    const svg = /\.svg(\?|$)/i.test(url);
    const inLogo = !!i.closest('header, nav, [class*="logo" i], a[href="/"]') && /logo/i.test(`${i.alt} ${i.className} ${url}`);
    const type = inLogo ? 'logo' : svg && isIconSize(b.w, b.h) ? 'icon' : 'image';
    add({ type, url, alt: i.alt, w: b.w, h: b.h, natural_w: i.naturalWidth, natural_h: i.naturalHeight, context: i.closest('header,nav') ? 'header' : i.closest('footer') ? 'footer' : 'page', above_fold: b.top < innerHeight });
  }
  for (const source of document.querySelectorAll('picture source[srcset]')) {
    const url = largestFromSrcset(source.getAttribute('srcset'));
    if (url) add({ type: 'image', url, context: 'picture source', mime: source.getAttribute('type') ?? undefined });
  }
  // CSS background images on elements.
  for (const el of document.querySelectorAll('body *')) {
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none') continue;
    for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const url = abs(m[1]);
      if (!url) continue;
      const b = box(el);
      add({ type: isIconSize(b.w, b.h) ? 'icon' : 'image', url, w: b.w, h: b.h, context: 'css background', above_fold: b.top < innerHeight });
    }
  }
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"], link[rel="manifest"]')) {
    const url = abs(link.getAttribute('href'));
    if (url) add({ type: link.rel.includes('manifest') ? 'manifest' : 'favicon', url, context: link.rel, mime: link.type || undefined });
  }
  for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const url = abs(document.querySelector<HTMLMetaElement>(sel)?.content);
    if (url) add({ type: 'share-image', url, context: sel.includes('og') ? 'og:image' : 'twitter:image' });
  }
  for (const v of document.querySelectorAll('video')) {
    const video = v as HTMLVideoElement;
    const b = box(video);
    const srcs = [video.currentSrc, video.getAttribute('src'), ...[...video.querySelectorAll('source')].map((s) => s.getAttribute('src'))];
    for (const s of srcs) {
      const url = abs(s);
      if (url) add({ type: 'video', url, w: b.w, h: b.h, context: video.autoplay ? 'autoplay video' : 'video', mime: video.querySelector('source')?.getAttribute('type') ?? undefined });
    }
    const poster = abs(video.getAttribute('poster'));
    if (poster) add({ type: 'image', url: poster, w: b.w, h: b.h, context: 'video poster' });
  }
  // Players often keep <video> inside a shadow root. Walk the open ones.
  const shadowVideos: HTMLVideoElement[] = [];
  const walkShadow = (root: Document | ShadowRoot) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        shadowVideos.push(...(el.shadowRoot.querySelectorAll('video') as NodeListOf<HTMLVideoElement>));
        walkShadow(el.shadowRoot);
      }
    }
  };
  walkShadow(document);
  for (const video of shadowVideos) {
    const url = abs(video.currentSrc || video.getAttribute('src'));
    if (url) add({ type: 'video', url, context: 'video in a player component' });
  }
  // Mux: a playback id gives the stream and its poster, even before anyone presses play.
  const muxIds = new Set<string>();
  for (const el of document.querySelectorAll('[playback-id]')) muxIds.add(el.getAttribute('playback-id')!.split('?')[0]);
  for (const a of assets) {
    const m = a.url.match(/^https:\/\/image\.mux\.com\/([A-Za-z0-9]+)\/(thumbnail|animated)/);
    if (m) muxIds.add(m[1]);
  }
  for (const id of muxIds) {
    add({ type: 'video', url: `https://stream.mux.com/${id}.m3u8`, context: 'Mux stream (HLS)', mime: 'application/x-mpegURL' });
    add({ type: 'image', url: `https://image.mux.com/${id}/thumbnail.webp`, context: 'Mux poster' });
  }
  for (const f of document.querySelectorAll('iframe')) {
    const url = abs(f.getAttribute('src'));
    if (url && /youtube|vimeo|wistia|vidyard|loom|bunny|mux/i.test(url)) add({ type: 'video-embed', url, ...box(f), context: 'player iframe' });
  }

  // Inline SVG icons: one entry per distinct drawing, with its markup.
  const iconMarkup = new Map<string, { html: string; w: number; h: number; label: string; count: number }>();
  for (const svg of document.querySelectorAll('svg')) {
    if (svg.parentElement?.closest('svg')) continue;
    const b = box(svg);
    if (!visible(svg) && !svg.querySelector('symbol')) continue;
    // Sprite sheets: record each symbol.
    if (svg.querySelector('symbol') && b.w < 2) {
      for (const sym of svg.querySelectorAll('symbol')) {
        const html = snippet(sym, 6000);
        const entry = iconMarkup.get(html) ?? { html, w: 0, h: 0, label: sym.id, count: 0 };
        entry.count += 1;
        iconMarkup.set(html, entry);
      }
      continue;
    }
    if (b.w > 160 || b.h > 160) continue; // a large SVG is an illustration, not an icon
    const use = svg.querySelector('use');
    const ref = use?.getAttribute('href') ?? use?.getAttribute('xlink:href');
    const resolved = ref?.startsWith('#') ? document.querySelector(ref) : null;
    const html = resolved ? snippet(resolved, 6000) : snippet(svg, 6000);
    const label = svg.getAttribute('aria-label') || text(svg.querySelector('title')) || (ref ?? '');
    const entry = iconMarkup.get(html) ?? { html, w: b.w, h: b.h, label, count: 0 };
    entry.count += 1;
    iconMarkup.set(html, entry);
  }
  const inlineIcons = [...iconMarkup.values()].sort((a, b) => b.count - a.count).slice(0, 200);

  // ---- Logo ----
  let logo: { kind: 'img' | 'inline-svg'; url?: string; html?: string; alt?: string } | null = null;
  const logoImg = assets.find((a) => a.type === 'logo');
  if (logoImg) logo = { kind: 'img', url: logoImg.url, alt: logoImg.alt };
  else {
    const home = [...document.querySelectorAll('header a[href="/"], nav a[href="/"], a[href="/"], [class*="logo" i]')].find((el) => visible(el) && el.querySelector('svg, img'));
    const svg = home?.querySelector('svg');
    const img = home?.querySelector('img');
    if (svg) logo = { kind: 'inline-svg', html: snippet(svg, 20000), alt: home!.getAttribute('aria-label') ?? '' };
    else if (img) {
      const url = abs((img as HTMLImageElement).currentSrc || img.getAttribute('src'));
      if (url) {
        logo = { kind: 'img', url, alt: (img as HTMLImageElement).alt };
        add({ type: 'logo', url, alt: (img as HTMLImageElement).alt, context: 'home link' });
      }
    }
  }

  // ---- Components, grouped by computed-style signature ----
  type Variant = { kind: string; signature: string; style: Record<string, string>; count: number; examples: string[]; html: string; mark: string; w: number; h: number };
  const groups = new Map<string, Variant>();
  let markId = 0;
  const pageBg = hex(getComputedStyle(document.body).backgroundColor) ?? '#FFFFFF';
  const record = (kind: string, el: Element, style: Record<string, string>, example: string) => {
    const signature = kind + '|' + Object.values(style).join('|');
    let g = groups.get(signature);
    if (!g) {
      const mark = `cs-${kind}-${markId++}`;
      el.setAttribute('data-cs-mark', mark);
      const b = box(el);
      g = { kind, signature, style, count: 0, examples: [], html: snippet(el), mark, w: b.w, h: b.h };
      groups.set(signature, g);
    }
    g.count += 1;
    if (example && g.examples.length < 4 && !g.examples.includes(example)) g.examples.push(example);
  };
  const styleOf = (el: Element, props: string[]) => {
    const s = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const p of props) {
      const v = s.getPropertyValue(p);
      out[p] = /color/.test(p) ? (hex(v) ?? 'transparent') : v;
    }
    return out;
  };
  const boxProps = ['background-color', 'color', 'border-top-color', 'border-top-width', 'border-top-style', 'border-top-left-radius', 'padding-top', 'padding-left', 'font-family', 'font-size', 'font-weight', 'text-transform', 'letter-spacing', 'box-shadow'];
  const skip = (el: Element) => !visible(el) || !!el.closest('[class*="cookie" i], [id*="cookie" i], [aria-modal="true"]');

  for (const el of document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a')) {
    if (skip(el)) continue;
    const s = getComputedStyle(el);
    const label = el instanceof HTMLInputElement ? el.value : text(el);
    const b = el.getBoundingClientRect();
    const filled = (hex(s.backgroundColor) ?? pageBg) !== pageBg;
    const outlined = parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none';
    if (el.tagName === 'A' && !filled && !outlined && !/btn|button|cta/i.test(el.className.toString())) continue;
    if (b.height < 24 || b.height > 90 || b.width < 32 || label.split(/\s+/).length > 8) continue;
    // A large clickable photo with no label is an image, not a button style. Small ones are icon buttons.
    if (!label && el.querySelector('img, picture, video') && b.width > 64) continue;
    record('button', el, { ...styleOf(el, boxProps), height: `${Math.round(b.height / 4) * 4}px` }, label.slice(0, 60));
  }
  for (const el of document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select')) {
    if (skip(el)) continue;
    record('input', el, styleOf(el, boxProps), (el as HTMLInputElement).placeholder || (el as HTMLInputElement).type);
  }
  for (const el of document.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    if (skip(el)) continue;
    record('choice', el, { type: (el as HTMLInputElement).type, ...styleOf(el, ['accent-color', 'width', 'height']) }, '');
  }
  // Cards: framed boxes (fill, border or shadow) holding an image or a heading, repeated beside siblings like them.
  for (const el of document.querySelectorAll('div, article, li, a, section')) {
    if (skip(el)) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 120 || b.width > 720 || b.height < 100 || b.height > 900) continue;
    const s = getComputedStyle(el);
    const framed = (hex(s.backgroundColor) && hex(s.backgroundColor) !== hex(getComputedStyle(el.parentElement ?? document.body).backgroundColor)) || (parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none') || s.boxShadow !== 'none';
    if (!framed || !el.querySelector('img, picture, svg, h2, h3, h4')) continue;
    const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.tagName === el.tagName).length : 1;
    if (siblings < 2) continue;
    record('card', el, styleOf(el, ['background-color', 'border-top-color', 'border-top-width', 'border-top-left-radius', 'box-shadow', 'padding-top', 'padding-left']), text(el.querySelector('h2, h3, h4, strong')).slice(0, 60));
  }
  // Badges and chips: small framed labels.
  for (const el of document.querySelectorAll('span, div, a, p, li')) {
    if (skip(el) || el.children.length > 2) continue;
    const b = el.getBoundingClientRect();
    const label = text(el);
    if (b.height < 14 || b.height > 34 || b.width > 220 || !label || label.length > 30) continue;
    const s = getComputedStyle(el);
    const framed = (hex(s.backgroundColor) ?? pageBg) !== pageBg || (parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none');
    if (!framed || parseFloat(s.paddingLeft) < 4) continue;
    if (el.closest('button, a[class*="btn" i]')) continue;
    record('badge', el, styleOf(el, boxProps), label);
  }
  // Text links in running copy.
  for (const el of document.querySelectorAll('p a, li a, footer a')) {
    if (skip(el)) continue;
    record('link', el, styleOf(el, ['color', 'text-decoration-line', 'font-weight', 'font-size']), text(el).slice(0, 40));
  }
  for (const [kind, sel] of [['nav', 'header, nav, [role="banner"]'], ['footer', 'footer, [role="contentinfo"]']] as const) {
    const el = [...document.querySelectorAll(sel)].find((e) => visible(e) && e.getBoundingClientRect().width > innerWidth * 0.6);
    if (el) {
      const s = getComputedStyle(el);
      record(kind, el, { 'background-color': hex(s.backgroundColor) ?? 'transparent', color: hex(s.color) ?? '', position: s.position, height: `${Math.round(el.getBoundingClientRect().height)}px`, links: String(el.querySelectorAll('a').length) }, '');
    }
  }

  const components = [...groups.values()];
  const byKind = new Map<string, Variant[]>();
  for (const c of components) byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]);
  const trimmed = [...byKind.values()].flatMap((list) => list.sort((a, b) => b.count - a.count).slice(0, maxPerKind));

  // Same-site links worth visiting next: navigation first, then the rest of the page.
  const links = [...new Set(
    [...document.querySelectorAll<HTMLAnchorElement>('header a[href], nav a[href], main a[href], footer a[href]')]
      .map((a) => abs(a.getAttribute('href')))
      .filter((u): u is string => !!u && new URL(u).host === location.host && !/\.(pdf|zip|jpg|png|mp4)$/i.test(u))
      .map((u) => u.split('#')[0]),
  )].slice(0, 200);

  return {
    url: location.href,
    title: document.title,
    assets,
    logo,
    inline_icons: inlineIcons,
    components: trimmed,
    links,
  };
}
