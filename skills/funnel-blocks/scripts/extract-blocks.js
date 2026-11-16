// Runs inside a Swipe Pages (Tatsu builder) template page. Returns one JSON
// record: page-level tokens plus one entry per section, with its modules.
(() => {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const cs = (el) => getComputedStyle(el);
  const rgbHex = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return c;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (a === 0) return 'transparent';
    const h = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
    return a < 1 ? `${h}@${Math.round(a * 100)}` : h;
  };
  const text = (el, n = 90) => (el?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = cs(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const typeOf = (el) => {
    const s = cs(el);
    return {
      size: px(s.fontSize), weight: s.fontWeight, family: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      lh: +(parseFloat(s.lineHeight) / parseFloat(s.fontSize) || 0).toFixed(2), ls: s.letterSpacing,
      tt: s.textTransform, color: rgbHex(s.color), align: s.textAlign,
    };
  };

  const moduleKinds = (root) => {
    const kinds = {};
    root.querySelectorAll('.tatsu-module').forEach((m) => {
      if (!visible(m)) return;
      const named = (el) => [...el.classList].find((c) => /^tatsu-[a-z][a-z-]+$/.test(c) && !/^tatsu-(module|align|image-lazyload|hidden|atts|column)/.test(c));
      let k = named(m);
      if (!k) for (const d of m.querySelectorAll('*')) { k = named(d); if (k) break; }
      if (!k) k = (m.querySelector('svg,i,img') && text(m).length > 1) ? 'icon-text' : text(m).length > 1 ? 'text' : m.querySelector('svg,img') ? 'icon' : 'spacer';
      k = k.replace(/^tatsu-/, '').replace(/-wrap-h\d$/, '').replace(/-(inner|wrap|wrapper|container)$/, '');
      kinds[k] = (kinds[k] || 0) + 1;
    });
    if (root.querySelector('iframe[src*="youtube"],iframe[src*="vimeo"],iframe[src*="wistia"],video')) kinds.video = 1;
    if (root.querySelector('form, .tatsu-form')) kinds.form = 1;
    if (root.querySelector('[class*="countdown"], [class*="timer"]')) kinds.countdown = 1;
    if (root.querySelector('lottie-player')) kinds.lottie = 1;
    return kinds;
  };

  const fillOf = (el) => {
    const r0 = el.getBoundingClientRect();
    const chain = [el, ...el.querySelectorAll('*')].slice(0, 6);
    let p = el.parentElement;
    for (let k = 0; k < 2 && p; k++, p = p.parentElement) {
      const pr = p.getBoundingClientRect();
      if (Math.abs(pr.width - r0.width) < 12 && Math.abs(pr.height - r0.height) < 12) chain.push(p);
    }
    for (const c of chain) for (const pseudo of [null, '::before', '::after']) {
      const s = getComputedStyle(c, pseudo);
      if (pseudo && (s.content === 'none' || s.content === 'normal')) continue;
      if (rgbHex(s.backgroundColor) !== 'transparent') return { bg: rgbHex(s.backgroundColor), from: c === el ? 'self' : pseudo || 'near' };
      if (s.backgroundImage.includes('gradient')) return { bg: 'gradient', from: 'near' };
    }
    return null;
  };
  const effOf = (el, prop, none) => {
    const chain = [el, ...el.querySelectorAll('*')].slice(0, 6);
    let p = el.parentElement; for (let k = 0; k < 2 && p; k++, p = p.parentElement) chain.push(p);
    for (const c of chain) { const v = getComputedStyle(c)[prop]; if (v && !none.includes(v)) return v; }
    return null;
  };
  const textColor = (el) => {
    let deepest = el;
    for (const d of el.querySelectorAll('*')) if (text(d).length > 1 && d.children.length === 0) { deepest = d; break; }
    return rgbHex(cs(deepest).color);
  };
  const buttonOf = (el) => {
    const s = cs(el);
    const r = el.getBoundingClientRect();
    const f = fillOf(el) || {};
    const border = effOf(el, 'borderTopWidth', ['0px']);
    return {
      text: text(el, 60), bg: f.bg || 'transparent', color: textColor(el),
      radius: effOf(el, 'borderTopLeftRadius', ['0px']) || '0px', h: px(r.height), w: px(r.width),
      padY: px(s.paddingTop), padX: px(s.paddingLeft), size: px(s.fontSize), weight: s.fontWeight,
      tt: s.textTransform, ls: s.letterSpacing, shadow: (effOf(el, 'boxShadow', ['none']) || '').slice(0, 90) || null,
      border: border ? border : null,
      family: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    };
  };
  const isButton = (b) => {
    if (!visible(b) || text(b).length < 2) return false;
    const r = b.getBoundingClientRect();
    if (r.height < 30 || r.height > 140 || r.width < 60) return false;
    return !!fillOf(b) || !!effOf(b, 'borderTopWidth', ['0px']);
  };

  const sections = [...document.querySelectorAll('.tatsu-section-offset')].filter(visible).map((sec, i) => {
    const s = cs(sec);
    const pad = sec.firstElementChild || sec;
    const ps = cs(pad);
    const inner = sec.querySelector('.be-preview') || pad;
    const bgLayer = sec.querySelector(':scope > div > div') ;
    const overlay = sec.querySelector('.tatsu-section-overlay');
    const os = overlay ? cs(overlay) : null;
    const bgCandidates = [sec, ...sec.querySelectorAll(':scope > div, :scope > div > div')];
    let bg = 'transparent', bgImage = null;
    for (const c of bgCandidates) {
      const cc = cs(c);
      if (bg === 'transparent' && cc.backgroundColor && rgbHex(cc.backgroundColor) !== 'transparent') bg = rgbHex(cc.backgroundColor);
      if (!bgImage && cc.backgroundImage && cc.backgroundImage !== 'none') bgImage = cc.backgroundImage.includes('gradient') ? 'gradient' : 'image';
    }
    const rect = sec.getBoundingClientRect();
    const cols = [...sec.querySelectorAll('.tatsu-section-pad-inner > div > .be-preview, .tatsu-section-pad-inner > div > div[class*="tatsu-column"]')].filter(visible);
    const colEls = [...sec.querySelectorAll('.tatsu-column-no-bg, [class*="tatsu-column"]:not(.tatsu-column-inner)')].filter((c) => visible(c) && !c.parentElement.closest('.tatsu-column-no-bg'));
    const rowW = inner.getBoundingClientRect().width;
    const colWidths = colEls.map((c) => Math.round((c.getBoundingClientRect().width / rowW) * 100));
    const heads = [...sec.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).filter((h) => text(h).length > 1);
    const buttons = [...sec.querySelectorAll('a,button,input[type=submit]')].filter(isButton);
    const imgs = [...sec.querySelectorAll('img')].filter(visible);
    const cards = [...sec.querySelectorAll('.tatsu-column-inner, .tatsu-column-no-bg')].filter((c) => {
      const cc = cs(c);
      return rgbHex(cc.backgroundColor) !== 'transparent' || cc.boxShadow !== 'none' || cc.borderTopWidth !== '0px';
    });
    const firstCard = cards[0] ? cs(cards[0]) : null;
    const allText = text(sec, 4000).toLowerCase();
    const cues = {
      faq: /frequently asked|faq|questions/.test(allText) || !!sec.querySelector('.tatsu-accordion'),
      testimonial: /“|"|testimonial|review|what (our )?(clients|customers|students) say/.test(allText) && /— |- [A-Z]|★|stars?/.test(text(sec, 4000)),
      price: /\$\s?\d|£\s?\d|€\s?\d|price|only \$/.test(allText),
      guarantee: /guarantee|money.back|risk.free|refund/.test(allText),
      urgency: /limited|today only|ends|hurry|left|spots|countdown|expires/.test(allText),
      steps: /step \d|how it works|3 (easy|simple) steps/.test(allText),
      logos: imgs.length >= 4 && imgs.every((im) => im.getBoundingClientRect().height < 90),
      date: /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*day\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d/.test(allText),
      bump: /yes[,!] (add|i want)|order bump|add (this|to my order)|one.time offer|upgrade/.test(allText),
      noThanks: /no thanks|no, i|skip/.test(allText),
    };
    return {
      i, y: px(rect.top + scrollY), h: px(rect.height), bg, bgImage,
      overlay: os && rgbHex(os.backgroundColor) !== 'transparent' ? `${rgbHex(os.backgroundColor)} op${os.opacity}` : null,
      padT: px(ps.paddingTop), padB: px(ps.paddingBottom), innerW: px(inner.getBoundingClientRect().width), maxW: cs(inner).maxWidth,
      cols: colWidths, modules: moduleKinds(sec),
      headings: heads.slice(0, 4).map((h) => ({ tag: h.tagName, t: text(h, 80), ...typeOf(h) })),
      body: (() => { const p = [...sec.querySelectorAll('p, li, .tatsu-text-inner, span')].filter(visible).find((e) => text(e).length > 40); return p ? typeOf(p) : null; })(),
      buttons: buttons.slice(0, 2).map(buttonOf), imgCount: imgs.length,
      card: firstCard ? { n: cards.length, bg: rgbHex(firstCard.backgroundColor), radius: firstCard.borderRadius, shadow: firstCard.boxShadow !== 'none' ? firstCard.boxShadow.slice(0, 90) : null, border: firstCard.borderTopWidth !== '0px' ? `${firstCard.borderTopWidth} ${rgbHex(firstCard.borderTopColor)}` : null, pad: px(firstCard.paddingTop) } : null,
      inputs: [...sec.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(visible).map((f) => { const fs = cs(f); return { type: f.type || f.tagName, h: px(f.getBoundingClientRect().height), radius: fs.borderRadius, border: `${fs.borderTopWidth} ${rgbHex(fs.borderTopColor)}`, bg: rgbHex(fs.backgroundColor), label: (f.labels?.[0] && text(f.labels[0], 30)) || f.placeholder || '' }; }),
      cues,
    };
  });

  const header = document.querySelector('.tatsu-header');
  const popupForms = [...document.querySelectorAll('.tatsu-popup-container')].map((p) => ({ fields: [...p.querySelectorAll('input:not([type=hidden]), select, textarea')].map((f) => f.type || f.tagName) }));
  const bs = cs(document.body);
  return JSON.stringify({
    url: location.href, title: document.title, vw: innerWidth, pageH: px(document.documentElement.scrollHeight),
    bodyBg: rgbHex(bs.backgroundColor), bodyFont: bs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    header: header && visible(header) ? { h: px(header.getBoundingClientRect().height), sticky: ['fixed', 'sticky'].includes(cs(header).position), links: [...header.querySelectorAll('a')].filter(visible).length } : null,
    popupForms, sections,
  });
})()
