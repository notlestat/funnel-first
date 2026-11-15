// Runs inside the scanned page. Collects raw facts only; judgement happens in classify.ts,
// where it can be tested without a browser. Must be self-contained: no imports or outer variables.
export type RawFunnel = ReturnType<typeof readFunnel>;

export function readFunnel() {
  const vh = innerHeight;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // Any CSS colour -> #RRGGBB, or null when transparent or translucent.
  const hex = (value: string): string | null => {
    if (!value || value === 'transparent') return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a < 250) return null;
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const all = (selector: string, root: ParentNode = document) => [...root.querySelectorAll(selector)].filter(visible);
  const top = (el: Element) => Math.round(el.getBoundingClientRect().top + scrollY);
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const abs = (url: string | null | undefined) => {
    if (!url) return null;
    try {
      return new URL(url, location.href).href;
    } catch {
      return null;
    }
  };
  const count = <K,>(map: Map<K, number>, key: K | null | undefined, by = 1) => {
    if (key) map.set(key, (map.get(key) ?? 0) + by);
  };
  const ranked = (map: Map<string, number>, limit = 12) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, n]) => ({ value, count: n }));

  const body = getComputedStyle(document.body);
  const pageBg = hex(body.backgroundColor) ?? hex(getComputedStyle(document.documentElement).backgroundColor) ?? '#FFFFFF';

  // ---- Colour, by role ----
  const colours = new Map<string, { hex: string; roles: Set<string>; count: number }>();
  const colour = (value: string | null, role: string, weight = 1) => {
    if (!value) return;
    const entry = colours.get(value) ?? { hex: value, roles: new Set<string>(), count: 0 };
    entry.roles.add(role);
    entry.count += weight;
    colours.set(value, entry);
  };
  colour(pageBg, 'background', 10);
  for (const el of all('p, li, span, td, label, small, figcaption, dd')) {
    const chars = text(el).length;
    if (chars) colour(hex(getComputedStyle(el).color), 'text', Math.min(chars, 400));
  }
  for (const el of all('h1, h2, h3')) colour(hex(getComputedStyle(el).color), 'heading', 50);
  for (const el of all('a')) colour(hex(getComputedStyle(el).color), 'link');
  for (const el of all('div, section, article, aside, header, footer, form, li')) {
    const fill = hex(getComputedStyle(el).backgroundColor);
    const r = el.getBoundingClientRect();
    if (fill && fill !== pageBg && r.width * r.height > 20_000) colour(fill, 'surface', Math.round((r.width * r.height) / 10_000));
  }

  // ---- Buttons and calls to action ----
  const buttonLike = all('button, input[type="submit"], [role="button"], a');
  const ctas: { text: string; href: string | null; top: number; height: number; bg: string | null; radius: string; kind: string }[] = [];
  const buttonHeights: number[] = [];
  for (const el of buttonLike) {
    const s = getComputedStyle(el);
    const fill = hex(s.backgroundColor);
    const label = (el instanceof HTMLInputElement ? el.value : text(el)).slice(0, 80);
    const r = el.getBoundingClientRect();
    const words = label.split(/\s+/).filter(Boolean).length;
    const styled = (fill && fill !== pageBg) || /btn|button|cta/i.test(el.className.toString());
    if (!label || words > 8 || r.height < 28 || r.width < 60) continue;
    if (el.tagName === 'A' && !styled) continue;
    if (el.closest('nav, footer, [class*="cookie" i], [id*="cookie" i], [role="dialog"]')) continue;
    ctas.push({
      text: label,
      href: el.tagName === 'A' ? el.getAttribute('href') : null,
      top: top(el),
      height: Math.round(r.height),
      bg: fill,
      radius: s.borderTopLeftRadius,
      kind: el.tagName === 'A' ? 'link' : (el as HTMLButtonElement).type === 'submit' || el instanceof HTMLInputElement ? 'submit' : 'button',
    });
    if (fill && fill !== pageBg) {
      colour(fill, 'action', 5);
      colour(hex(s.color), 'on-action', 5);
      buttonHeights.push(Math.round(r.height));
    }
  }

  // ---- Type, by role ----
  const typeRoles: Record<string, string> = {
    h1: 'h1', h2: 'h2', h3: 'h3', p: 'body', li: 'body', small: 'small', label: 'label', button: 'button', input: 'input',
  };
  const type = new Map<string, { role: string; family: string; size: string; weight: string; line_height: string; letter_spacing: string; transform: string; count: number }>();
  for (const [selector, role] of Object.entries(typeRoles)) {
    for (const el of all(selector).slice(0, 60)) {
      if (role !== 'input' && !text(el)) continue;
      const s = getComputedStyle(el);
      const key = [role, s.fontFamily, s.fontSize, s.fontWeight, s.lineHeight, s.letterSpacing, s.textTransform].join('|');
      const entry = type.get(key) ?? { role, family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, line_height: s.lineHeight, letter_spacing: s.letterSpacing, transform: s.textTransform, count: 0 };
      entry.count += 1;
      type.set(key, entry);
    }
  }
  // The display size is the largest text in the first screen and a half, whatever its tag.
  let display: Element | null = null;
  let displaySize = 0;
  for (const el of all('h1, h2, h3, h4, p, span, a, div, strong')) {
    const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 2);
    if (!own || el.getBoundingClientRect().top > vh * 1.5) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size > displaySize) [display, displaySize] = [el, size];
  }

  // ---- Shape and space ----
  const radius = new Map<string, number>();
  const shadow = new Map<string, number>();
  const sectionPadding = new Map<string, number>();
  const gaps = new Map<string, number>();
  for (const el of all('button, input, textarea, select, a, div, section, article, li, img, form')) {
    const s = getComputedStyle(el);
    if (s.borderTopLeftRadius !== '0px' && (s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.borderTopStyle !== 'none' || el.tagName === 'IMG')) count(radius, s.borderTopLeftRadius);
    if (s.boxShadow !== 'none') count(shadow, s.boxShadow);
    if ((s.display === 'flex' || s.display === 'grid') && s.rowGap !== 'normal' && s.rowGap !== '0px') count(gaps, s.rowGap);
  }
  for (const el of all('section, header, footer, main > *, body > div > *')) {
    const pad = parseFloat(getComputedStyle(el).paddingTop);
    if (pad >= 24) count(sectionPadding, `${Math.round(pad)}px`);
  }

  // ---- Declared custom properties (the site's own token names) ----
  const declared: Record<string, string> = {};
  let blockedSheets = 0;
  const fontFaces: { family: string; src: string }[] = [];
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      blockedSheets += 1;
      continue;
    }
    for (const rule of [...rules]) {
      if (rule instanceof CSSStyleRule && /^(:root|html|body)$/.test(rule.selectorText.trim())) {
        for (const prop of [...rule.style]) {
          if (prop.startsWith('--') && Object.keys(declared).length < 400) declared[prop] = rule.style.getPropertyValue(prop).trim();
        }
      }
      if (rule instanceof CSSFontFaceRule && fontFaces.length < 40) {
        fontFaces.push({ family: rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim(), src: rule.style.getPropertyValue('src').slice(0, 300) });
      }
    }
  }
  for (const prop of [...document.documentElement.style]) {
    if (prop.startsWith('--')) declared[prop] = document.documentElement.style.getPropertyValue(prop).trim();
  }

  // ---- Assets ----
  const meta = (selector: string) => document.querySelector<HTMLMetaElement>(selector)?.content ?? null;
  const images = all('img').map((img) => {
    const i = img as HTMLImageElement;
    const r = i.getBoundingClientRect();
    return { src: abs(i.currentSrc || i.src), w: Math.round(r.width), h: Math.round(r.height), natural_w: i.naturalWidth, natural_h: i.naturalHeight, alt: i.alt, above_fold: r.top + scrollY < vh, top: top(i) };
  }).filter((i) => i.src && i.w * i.h >= 400);
  const logoEl =
    document.querySelector('header img, nav img, [class*="logo" i] img, img[class*="logo" i], img[alt*="logo" i], img[src*="logo" i]') ??
    document.querySelector('a[href="/"] img, a[href="./"] img');
  const logoSvg = !logoEl ? document.querySelector('header svg, [class*="logo" i] svg, a[href="/"] svg') : null;
  const fontsLoaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => ({ family: f.family.replace(/['"]/g, ''), weight: f.weight, style: f.style }));
  const fontLinks = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((l) => l.href).filter((h) => /fonts\.googleapis|use\.typekit|fonts\.bunny|fast\.fonts/.test(h));
  const videos = [
    ...all('video').map((v) => ({ kind: 'video', src: abs((v as HTMLVideoElement).currentSrc || v.getAttribute('src') || v.querySelector('source')?.getAttribute('src')), top: top(v) })),
    ...all('iframe').map((f) => ({ kind: 'iframe', src: abs(f.getAttribute('src')), top: top(f) })).filter((f) => /youtube|vimeo|wistia|vidyard|loom|player|video|vturb|bunny/i.test(f.src ?? '')),
  ];

  // ---- Page structure: top-level blocks in reading order ----
  const blockCandidates: Element[] = [];
  const consider = (root: Element, depth: number) => {
    for (const child of [...root.children]) {
      if (!visible(child) || /^(SCRIPT|STYLE|NOSCRIPT|LINK|META)$/.test(child.tagName)) continue;
      const r = child.getBoundingClientRect();
      const wide = r.width >= innerWidth * 0.6;
      if (!wide) continue;
      const sized = (k: Element, min: number) => visible(k) && k.getBoundingClientRect().width >= innerWidth * 0.6 && k.getBoundingClientRect().height >= min;
      const kids = [...child.children].filter((k) => sized(k, 60));
      // Descend through wrappers until blocks look like page sections:
      // a wrapper has one section-sized child, or is over two and a half screens tall with several.
      // Elements that say they are sections stay whole unless they are giant wrappers.
      const sectionLike = /^(SECTION|HEADER|FOOTER|ARTICLE|ASIDE|FORM|NAV)$/.test(child.tagName) || /section/i.test(`${child.id} ${child.className}`);
      if (kids.length === 1 && !sectionLike && depth < 10) consider(child, depth + 1);
      else if (r.height >= 60) {
        if (kids.filter((k) => sized(k, 120)).length >= 2 && r.height > vh * 2.5 && depth < 10) consider(child, depth + 1);
        else blockCandidates.push(child);
      }
    }
  };
  // Some builders scroll inside a container instead of the page. Find it, so its sections are seen.
  // Use <main> only when it holds most of the page; some builders wrap just the hero in it.
  const main = document.querySelector('main');
  let root: Element = main && main.getBoundingClientRect().height >= document.documentElement.scrollHeight * 0.5 ? main : document.body;
  let scroller: Element | null = null;
  if (document.documentElement.scrollHeight < vh * 1.3) {
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 200 && el.scrollHeight > (scroller?.scrollHeight ?? 0)) scroller = el;
    }
    if (scroller) root = scroller;
  }
  consider(root, 0);
  const priceRe = /(?:[$£€]\s?\d|\d\s?(?:€|USD|EUR|GBP))/;
  const dateRe = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b.*\b\d{1,2}(:\d{2})?\s?(am|pm|uhr)?|\b\d{1,2}(:\d{2})\s?(am|pm|pst|est|cet|gmt|uk)/i;
  const ratingRe = /(\d(?:[.,]\d)?\s*(?:\/\s*5|out of 5|stars?)|★{3,}|\b\d(?:[.,]\d)\b.{0,20}\breviews?\b|\b\d[\d,.]*\+?\s+reviews?\b)/i;
  const blocks = blockCandidates.slice(0, 40).map((el, order) => {
    const r = el.getBoundingClientRect();
    const heading = el.querySelector('h1, h2, h3, [class*="title" i], [class*="headline" i]');
    const inputs = all('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, select', el);
    const choices = all('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]', el);
    const btns = all('button, [role="button"]', el).filter((b) => text(b).split(/\s+/).length <= 8);
    const imgs = all('img', el);
    const smallImgs = imgs.filter((i) => {
      const b = i.getBoundingClientRect();
      return b.height <= 90 && b.width <= 260;
    });
    const t = ((el as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
    return {
      order,
      tag: el.tagName.toLowerCase(),
      top: Math.round(r.top + scrollY),
      height: Math.round(r.height),
      heading: text(heading).slice(0, 160),
      heading_tag: heading?.tagName.toLowerCase() ?? null,
      chars: t.length,
      inputs: inputs.map((i) => (i as HTMLInputElement).type || i.tagName.toLowerCase()),
      choices: choices.length,
      buttons: btns.length,
      button_labels: btns.slice(0, 8).map((b) => text(b).slice(0, 60)),
      ctas: ctas.filter((c) => c.top >= r.top + scrollY && c.top < r.bottom + scrollY).length,
      images: imgs.length,
      small_images: smallImgs.length,
      video: all('video, iframe', el).length,
      quotes: all('blockquote, q', el).length + (t.match(/[“"][^”"]{30,300}[”"]/g)?.length ?? 0),
      details: all('details, [aria-expanded]', el).length,
      list_items: all('li', el).length,
      h3s: all('h3, h4', el).length,
      paragraphs: all('p', el).filter((p) => text(p).length > 80).length,
      price: priceRe.test(t),
      date: dateRe.test(t),
      rating: (t.match(ratingRe) ?? [null])[0],
      legal: /privacy|imprint|impressum|terms|cookie|datenschutz|©|copyright/i.test(t) && t.length < 1500,
      text_sample: t.slice(0, 280),
    };
  });

  // ---- Forms ----
  // Multi-step flows hide later steps, so fields are read whether or not they show, with a flag.
  // Site search is not a funnel form. A hero can live in <header>, so only <nav> and search forms are skipped.
  const forms = all('form').filter((f) => !f.closest('nav') && f.getAttribute('role') !== 'search' && !f.querySelector('input[type="search"]')).map((f) => ({
    top: top(f),
    steps: f.querySelectorAll('fieldset, [data-step], [class*="step" i]').length,
    fields: [...f.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')].map((i) => {
      const input = i as HTMLInputElement;
      const label = (input.labels?.[0] && text(input.labels[0])) || input.placeholder || input.getAttribute('aria-label') || input.name;
      return { type: input.type || i.tagName.toLowerCase(), name: input.name, label: (label ?? '').slice(0, 80), required: input.required, visible: visible(i) };
    }),
    submit: text(f.querySelector('button[type="submit"], input[type="submit"], button:not([type])')).slice(0, 80) || (f.querySelector<HTMLInputElement>('input[type="submit"]')?.value ?? ''),
  }));
  // Forms built without <form> tags still have inputs; record loose ones too.
  const looseInputs = all('input[type="email"], input[type="tel"], input[name*="mail" i], input[name*="phone" i]').filter((i) => !i.closest('form')).length;

  // ---- First screen ----
  const fold = (el: Element) => el.getBoundingClientRect().top + scrollY < vh;
  const firstScreen = {
    text_inputs: all('input[type="email"], input[type="text"], input[type="tel"], input:not([type]), textarea').filter(fold).length,
    choices: all('input[type="radio"], input[type="checkbox"], [role="radio"]').filter(fold).length,
    option_buttons: (() => {
      // Two or more short buttons sharing a parent read as answers to a question.
      const shortBtns = all('button, [role="button"], a').filter((b) => fold(b) && !b.closest('nav, header, footer, [role="dialog"]') && text(b).length > 0 && text(b).length <= 40);
      const byParent = new Map<Element, number>();
      for (const b of shortBtns) if (b.parentElement?.parentElement) count(byParent, b.parentElement.parentElement);
      return Math.max(0, ...byParent.values());
    })(),
    ctas: ctas.filter((c) => c.top < vh).length,
    video: videos.filter((v) => v.top < vh).length,
    question_text: all('h1, h2, h3, p, legend, label').filter(fold).map(text).find((s) => s.endsWith('?') && s.length < 160) ?? null,
  };

  // ---- Stack: builder and tracking signals ----
  const scripts = [...document.scripts];
  const scriptSrcs = scripts.map((s) => s.src).filter(Boolean).slice(0, 120);
  const inline = scripts.filter((s) => !s.src).map((s) => s.textContent ?? '').join('\n').slice(0, 200_000);
  const inlineFlags = {
    fbq: /\bfbq\(\s*['"]init/.test(inline),
    gtag: /\bgtag\(\s*['"]config/.test(inline),
    gtm: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/.test(inline),
    ttq: /\bttq\.(load|page)/.test(inline),
    hotjar: /static\.hotjar\.com|hjSiteSettings/.test(inline),
    clarity: /clarity\.ms|\(c\.clarity\)|"clarity"/.test(inline),
    linkedin: /_linkedin_partner_id|snap\.licdn\.com/.test(inline),
    segment: /analytics\.load\(|cdn\.segment\.com/.test(inline),
    snap: /snaptr\(/.test(inline),
    pinterest: /pintrk\(/.test(inline),
  };
  const htmlClass = `${document.documentElement.className} ${document.body.className}`.slice(0, 500);
  const markers = {
    generator: meta('meta[name="generator"]'),
    html_class: htmlClass,
    data_attrs: [...document.documentElement.attributes, ...document.body.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).slice(0, 20),
    link_hosts: [...new Set([...document.querySelectorAll<HTMLLinkElement | HTMLImageElement>('link[href], img[src]')].map((e) => {
      try {
        return new URL((e as HTMLLinkElement).href || (e as HTMLImageElement).src).host;
      } catch {
        return '';
      }
    }).filter(Boolean))].slice(0, 40),
  };

  const headline = display ? text(display).slice(0, 200) : text(document.querySelector('h1')).slice(0, 200);

  return {
    title: document.title,
    lang: document.documentElement.lang || null,
    final_url: location.href,
    page_height: Math.max(document.documentElement.scrollHeight, scroller?.scrollHeight ?? 0),
    inner_scroll: !!scroller,
    viewport: { w: innerWidth, h: vh },
    headline,
    display: display ? { size: getComputedStyle(display).fontSize, family: getComputedStyle(display).fontFamily, weight: getComputedStyle(display).fontWeight } : null,
    page: { bg: pageBg, text: hex(body.color), family: body.fontFamily, size: body.fontSize, line_height: body.lineHeight },
    colours: [...colours.values()].sort((a, b) => b.count - a.count).slice(0, 24).map((c) => ({ hex: c.hex, roles: [...c.roles], count: c.count })),
    type: [...type.values()].sort((a, b) => b.count - a.count).slice(0, 30),
    radius: ranked(radius),
    shadow: ranked(shadow, 8),
    section_padding: ranked(sectionPadding),
    gaps: ranked(gaps),
    button_heights: buttonHeights,
    declared,
    blocked_sheets: blockedSheets,
    assets: {
      logo: logoEl ? { src: abs((logoEl as HTMLImageElement).currentSrc || (logoEl as HTMLImageElement).src), alt: (logoEl as HTMLImageElement).alt ?? '', kind: 'img' } : logoSvg ? { src: null, alt: logoSvg.getAttribute('aria-label') ?? '', kind: 'inline-svg' } : null,
      favicon: abs(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute('href') ?? '/favicon.ico'),
      apple_touch_icon: abs(document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute('href')),
      og_image: abs(meta('meta[property="og:image"]')),
      og_title: meta('meta[property="og:title"]'),
      description: meta('meta[name="description"]'),
      fonts_loaded: fontsLoaded.slice(0, 30),
      font_faces: fontFaces,
      font_links: fontLinks,
      images: images.slice(0, 60),
      svg_count: document.querySelectorAll('svg').length,
      videos,
    },
    ctas,
    blocks,
    forms,
    loose_inputs: looseInputs,
    first_screen: firstScreen,
    stack: { script_srcs: scriptSrcs, inline: inlineFlags, markers },
  };
}
