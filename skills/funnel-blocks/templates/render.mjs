// Block renderers. Each takes a props object and returns HTML that uses only
// fb- classes from kit/blocks.css, so a company's tokens restyle everything.
// Copy is escaped. Inline emphasis: *phrase* = accent colour, ==phrase== = marker.

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rich = (s = '') => esc(s).replace(/==(.+?)==/g, '<span class="fb-mark">$1</span>').replace(/\*(.+?)\*/g, '<span class="fb-accent-word">$1</span>');
const each = (list = [], fn) => list.map(fn).join('');
const band = (tone, inner, extra = '') => `<section class="fb-band${tone ? ` is-${tone}` : ''}${extra ? ` ${extra}` : ''}">${inner}</section>`;
const flag = (on) => (on ? '<span class="fb-placeholder-flag">Placeholder</span>' : '');
const img = (src, alt = '') => (src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : '<div class="g-ph" aria-hidden="true">image</div>');

const button = (b, cls = '') => {
  if (!b) return '';
  const o = typeof b === 'string' ? { label: b } : b;
  return `<a class="fb-button${o.style ? ` is-${o.style}` : ''}${cls ? ` ${cls}` : ''}" href="#">${esc(o.label)}${o.sub ? `<span class="fb-button__sub">${esc(o.sub)}</span>` : ''}</a>`;
};
const checklist = (items) => (items?.length ? `<ul class="fb-checklist">${each(items, (i) => `<li>${rich(i)}</li>`)}</ul>` : '');
const trust = (items) => (items?.length ? `<ul class="fb-trust">${each(items, (i) => `<li>${esc(i)}</li>`)}</ul>` : '');
const field = (f, i) => {
  const o = typeof f === 'string' ? { label: f } : f;
  const id = `f${Math.abs(hash(o.label + i))}`;
  const type = o.type || (/mail/i.test(o.label) ? 'email' : /phone|mobile/i.test(o.label) ? 'tel' : 'text');
  const control = o.options
    ? `<select id="${id}">${each(o.options, (opt) => `<option>${esc(opt)}</option>`)}</select>`
    : o.textarea
      ? `<textarea id="${id}" rows="3" style="min-block-size:96px;padding:0.75rem 0.9rem;border:1px solid var(--color-border);border-radius:var(--field-radius);font:inherit;background:var(--color-bg);color:var(--color-text)"></textarea>`
      : `<input id="${id}" type="${type}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}>`;
  return `<div class="fb-field"><label for="${id}">${esc(o.label)}${o.optional ? ' <span class="fb-small">(optional)</span>' : ''}</label>${control}</div>`;
};
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const formcard = (f, light) => `<form class="fb-formcard${light ? ' is-light' : ''}" onsubmit="return false">
  ${f.title ? `<p class="fb-formcard__title">${rich(f.title)}</p>` : ''}
  ${each(f.fields, field)}
  ${f.consent ? `<label class="fb-consent"><input type="checkbox"> <span>${esc(f.consent)}</span></label>` : ''}
  <button class="fb-button${f.style ? ` is-${f.style}` : ''}" type="submit">${esc(f.button)}</button>
  <p class="fb-microcopy" style="text-align:center">${esc(f.note || 'Demo form: nothing is sent.')}</p>
</form>`;
const countdown = (c) => `<div class="fb-countdown" role="timer" aria-label="${esc(c.label || 'Time left')}">${each(c.units, ([n, l]) => `<div class="fb-countdown__unit"><span class="fb-countdown__num">${esc(n)}</span><span class="fb-countdown__label">${esc(l)}</span></div>`)}</div>`;
const question = (q) => `<div class="fb-question">
  <div class="fb-question__progress"><span>${esc(q.progress)}</span><div class="fb-progress__track"><div class="fb-progress__fill" style="--progress:${q.percent || 25}%"></div></div></div>
  <p class="fb-question__title">${esc(q.q)}</p>
  <div class="fb-answers${q.grid ? ' is-grid' : ''}" role="group" aria-label="${esc(q.q)}">${each(q.answers, (a, i) => `<button class="fb-answer" type="button" aria-pressed="${i === q.selected}">${esc(a)}</button>`)}</div>
  ${q.back ? '<button class="fb-back" type="button">Back</button>' : ''}
</div>`;

export const blocks = {
  announce: (p) => `<div class="fb-announce">${p.strong ? `<strong>${esc(p.strong)}</strong> ` : ''}${esc(p.text)}</div>`,

  brandbar: (p, ctx) => `<header class="fb-brandbar${p.cta ? ' is-split' : ''}"><a class="fb-brandbar__logo" href="#">${ctx.logo ? `<img src="${esc(ctx.logo)}" alt="${esc(ctx.brand)}" style="block-size:64px;inline-size:auto;mix-blend-mode:multiply">` : esc(ctx.brand)}</a>${p.cta ? `<a class="fb-button is-ghost" href="#" style="min-block-size:44px;padding:0.5em 1.2em;inline-size:auto">${esc(p.cta)}</a>` : ''}</header>`,

  steplabel: (p) => `<div class="fb-steplabel">${esc(p.text)}</div>`,

  hero: (p) => {
    const copy = `
      ${p.chips ? `<div class="fb-chips">${each(p.chips, (c) => `<span class="fb-chip">${esc(c)}</span>`)}</div>` : ''}
      ${p.eyebrow ? `<span class="fb-eyebrow${p.eyebrowPlain ? ' is-plain' : ''}">${esc(p.eyebrow)}</span>` : ''}
      <h1 class="fb-hero__title">${rich(p.title)}</h1>
      ${p.lede ? `<p class="fb-lede">${rich(p.lede)}</p>` : ''}
      ${checklist(p.checklist)}
      ${p.countdown ? countdown(p.countdown) : ''}
      ${p.video ? `<div class="fb-video">${img(p.video.poster)}<button class="fb-video__play" aria-label="${esc(p.video.label || 'Play the video')}"></button></div>` : ''}
      ${button(p.button)}
      ${p.micro ? `<p class="fb-microcopy">${esc(p.micro)}</p>` : ''}
      ${trust(p.trust)}`;
    if (p.variant === 'split' || p.variant === 'question') {
      const side = p.variant === 'question' ? question(p.question) : p.form ? formcard(p.form, p.formLight) : `<div class="fb-photo">${img(p.image)}</div>`;
      return band(p.tone, `<div class="fb-container fb-split is-copy-wide"><div class="fb-stack">${copy}</div>${side}</div>`, 'fb-hero');
    }
    if (p.variant === 'photo') {
      return `<section class="fb-band fb-hero is-photo"><img class="fb-band__media" src="${esc(p.image)}" alt=""><div class="fb-container fb-stack is-center">${copy}</div></section>`;
    }
    return band(p.tone, `<div class="fb-container${p.narrow ? ' is-narrow' : ''} fb-stack is-center">${copy}${p.form ? `<div class="fb-container is-form">${formcard(p.form, p.formLight)}</div>` : ''}</div>`, 'fb-hero');
  },

  trust: (p) => band(p.tone, `<div class="fb-container fb-stack is-center">${trust(p.items)}</div>`, 'is-tight'),

  benefits: (p) => band(p.tone, `<div class="fb-container fb-stack">
    ${p.title ? `<div class="fb-stack is-center is-tight"><h2 class="fb-heading">${rich(p.title)}</h2>${p.lede ? `<p class="fb-lede">${rich(p.lede)}</p>` : ''}</div>` : ''}
    <div class="fb-grid">${each(p.items, (i) => `<article class="fb-card"><div class="fb-card__icon" aria-hidden="true">${esc(i.icon || '✓')}</div><h3 class="fb-card__title">${esc(i.title)}</h3><p>${esc(i.body)}</p></article>`)}</div>
  </div>`),

  feature: (p) => band(p.tone, `<div class="fb-container fb-split fb-feature${p.flipped ? ' is-flipped' : ''}">
    <div class="fb-stack">${p.eyebrow ? `<span class="fb-eyebrow is-plain">${esc(p.eyebrow)}</span>` : ''}<h2 class="fb-heading">${rich(p.title)}</h2>${p.lede ? `<p class="fb-lede">${rich(p.lede)}</p>` : ''}${checklist(p.checklist)}${button(p.button)}</div>
    <div class="fb-feature__media fb-photo">${img(p.image, p.alt)}</div>
  </div>`),

  beforeafter: (p) => band(p.tone, `<div class="fb-container is-narrow fb-stack is-center">
    ${p.title ? `<h2 class="fb-heading">${rich(p.title)}</h2>` : ''}
    <div class="fb-beforeafter" style="inline-size:100%"><figure>${img(p.before, 'Before')}<figcaption>Before</figcaption></figure><figure>${img(p.after, 'After')}<figcaption>After</figcaption></figure></div>
    ${p.caption ? `<p class="fb-small">${esc(p.caption)}</p>` : ''}
  </div>`),

  steps: (p) => band(p.tone, `<div class="fb-container fb-stack"><h2 class="fb-heading">${rich(p.title)}</h2><ol class="fb-steps">${each(p.items, ([t, b]) => `<li><h3 class="fb-card__title">${esc(t)}</h3><p class="fb-small">${esc(b)}</p></li>`)}</ol></div>`),

  quotes: (p) => band(p.tone, `<div class="fb-container fb-stack">
    <h2 class="fb-heading">${rich(p.title)}</h2>
    <div class="fb-grid">${each(p.items, (q) => `<figure class="fb-card fb-quote"><div class="fb-stars" role="img" aria-label="5 out of 5 stars">★★★★★</div><blockquote>"${esc(q.quote)}"</blockquote><figcaption><span class="fb-avatar"></span><span><span class="fb-quote__name">${esc(q.name)}</span><br>${esc(q.role || '')}</span></figcaption>${flag(q.placeholder)}</figure>`)}</div>
  </div>`),

  bio: (p) => band(p.tone, `<div class="fb-container fb-split">
    <div class="fb-bio__photo">${p.image ? img(p.image) : '<div class="g-ph is-tall" style="block-size:100%">portrait</div>'}</div>
    <div class="fb-stack"><span class="fb-bio__role">${esc(p.role)}</span><h2 class="fb-heading">${rich(p.title)}</h2>${each(p.body, (b) => `<p class="fb-lede">${esc(b)}</p>`)}${flag(p.placeholder)}</div>
  </div>`),

  video: (p) => band(p.tone, `<div class="fb-container is-narrow fb-stack is-center">${p.title ? `<h2 class="fb-heading">${rich(p.title)}</h2>` : ''}<div class="fb-video">${img(p.poster)}<button class="fb-video__play" aria-label="${esc(p.label || 'Play the video')}"></button></div>${p.caption ? `<p class="fb-small">${esc(p.caption)}</p>` : ''}${button(p.button)}</div>`),

  offer: (p) => band(p.tone, `<div class="fb-container is-form"><div class="fb-offer">
    <p class="fb-formcard__title">${rich(p.title)}</p>
    <ul class="fb-offer__items">${each(p.items, (i) => `<li><span>${esc(i.name)}</span><span class="fb-offer__value">${i.free ? `${i.value ? `<s>${esc(i.value)}</s>` : ''}<strong>Included</strong>` : esc(i.value || '')}</span></li>`)}</ul>
    ${p.total ? `<div class="fb-offer__total"><span>${esc(p.total[0])}</span><span>${esc(p.total[1])}</span></div>` : ''}
    <div class="fb-offer__today"><span class="fb-small">${esc(p.todayLabel || 'Today')}</span><span class="fb-price__now">${esc(p.today)}</span></div>
    ${button(p.button, 'is-block')}
    ${flag(p.placeholder)}
  </div></div>`),

  guarantee: (p) => band(p.tone, `<div class="fb-container is-narrow"><div class="fb-guarantee"><div class="fb-guarantee__seal">${esc(p.seal)}</div><div class="fb-stack is-tight"><h3 class="fb-card__title">${esc(p.title)}</h3><p class="fb-small">${esc(p.body)}</p>${flag(p.placeholder)}</div></div></div>`, 'is-tight'),

  faq: (p) => band(p.tone, `<div class="fb-container is-narrow fb-stack"><h2 class="fb-heading">${rich(p.title)}</h2><div class="fb-faq">${each(p.items, ([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><div>${esc(a)}</div></details>`)}</div></div>`),

  cta: (p) => band(p.tone || 'accent', `<div class="fb-container fb-stack is-center"><h2 class="fb-heading">${rich(p.title)}</h2>${p.lede ? `<p class="fb-lede">${esc(p.lede)}</p>` : ''}${button(p.button)}${p.micro ? `<p class="fb-microcopy">${esc(p.micro)}</p>` : ''}</div>`, 'fb-ctaband'),

  form: (p) => band(p.tone, `<div class="fb-container is-form fb-stack">${p.title ? `<div class="fb-stack is-center is-tight"><h2 class="fb-heading">${rich(p.title)}</h2>${p.lede ? `<p class="fb-lede">${esc(p.lede)}</p>` : ''}</div>` : ''}${formcard({ ...p, title: p.title ? '' : p.cardTitle }, p.light)}</div>`),

  question: (p) => band(p.tone, `<div class="fb-container is-form fb-stack">${p.intro ? `<div class="fb-stack is-center is-tight"><h1 class="fb-heading">${rich(p.intro)}</h1>${p.lede ? `<p class="fb-lede">${esc(p.lede)}</p>` : ''}</div>` : ''}${question(p)}${p.filter ? `<p class="fb-microcopy" style="text-align:center">${esc(p.filter)}</p>` : ''}</div>`),

  result: (p) => band(p.tone, `<div class="fb-container is-form fb-stack">
    ${p.intro ? `<div class="fb-stack is-center is-tight"><h1 class="fb-heading">${rich(p.intro)}</h1></div>` : ''}
    <div class="fb-result"><span class="fb-result__label">${esc(p.label || 'Your match')}</span><p class="fb-result__title">${esc(p.title)}</p><p class="fb-lede">${esc(p.body)}</p>${p.price ? `<p class="fb-result__price">${esc(p.price)}</p>` : ''}${checklist(p.includes)}${button(p.button, 'is-block')}${p.alt ? `<button class="fb-decline" type="button">${esc(p.alt)}</button>` : ''}</div>
  </div>`),

  slots: (p) => band(p.tone, `<div class="fb-container is-form fb-stack">
    ${p.title ? `<div class="fb-stack is-center is-tight"><h1 class="fb-heading">${rich(p.title)}</h1>${p.lede ? `<p class="fb-lede">${esc(p.lede)}</p>` : ''}</div>` : ''}
    <div class="fb-slots">
      ${p.summary ? `<div class="fb-summary">${each(p.summary, ([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`)}</div>` : ''}
      <span class="fb-slots__label">Pick a day</span>
      <div class="fb-dates">${each(p.dates, ([d, n], i) => `<button class="fb-date" type="button" aria-pressed="${i === (p.day ?? 1)}">${esc(d)}<b>${esc(n)}</b></button>`)}</div>
      <span class="fb-slots__label">Pick a time</span>
      <div class="fb-times">${each(p.times, (t, i) => `<button class="fb-time" type="button" aria-pressed="${i === (p.time ?? 1)}"${(p.taken || []).includes(i) ? ' disabled' : ''}>${esc(t)}</button>`)}</div>
      ${button(p.button, 'is-block')}
      <p class="fb-microcopy" style="text-align:center">${esc(p.note || 'Demo calendar: no booking is made.')}</p>
    </div>
  </div>`),

  plans: (p) => band(p.tone, `<div class="fb-container fb-stack">
    <div class="fb-stack is-center is-tight"><h2 class="fb-heading">${rich(p.title)}</h2>${p.lede ? `<p class="fb-lede">${esc(p.lede)}</p>` : ''}</div>
    <div class="fb-plans">${each(p.plans, (pl) => `<article class="fb-plan${pl.featured ? ' is-featured' : ''}">${pl.featured ? `<span class="fb-plan__badge">${esc(pl.featured)}</span>` : ''}<h3 class="fb-plan__name">${esc(pl.name)}</h3><p class="fb-plan__price">${esc(pl.price)} <small>${esc(pl.per || '')}</small></p>${checklist(pl.items)}${button({ label: pl.button, style: pl.featured ? '' : 'ghost' })}</article>`)}</div>
    ${p.placeholder ? `<p class="fb-small" style="text-align:center">${flag(true)} ${esc(p.placeholder)}</p>` : ''}
  </div>`),

  apply: (p) => band(p.tone, `<div class="fb-container is-form fb-stack">
    <div class="fb-stack is-center is-tight">${p.progress ? `<span class="fb-steppill">${esc(p.progress)}</span>` : ''}<h1 class="fb-heading">${rich(p.title)}</h1>${p.lede ? `<p class="fb-lede">${esc(p.lede)}</p>` : ''}</div>
    ${formcard({ fields: p.fields, button: p.button, note: p.note }, true)}
  </div>`),

  days: (p) => band(p.tone, `<div class="fb-container is-narrow fb-stack">
    <div class="fb-stack is-center is-tight"><span class="fb-eyebrow">${esc(p.eyebrow)}</span><h1 class="fb-heading">${rich(p.title)}</h1></div>
    <ol class="fb-days">${each(p.days, (d, i) => `<li class="${i < p.current ? 'is-done' : ''}"${i === p.current ? ' aria-current="step"' : ''}>Day<b>${i + 1}</b>${esc(d)}</li>`)}</ol>
    <div class="fb-video">${img(p.poster)}<button class="fb-video__play" aria-label="Play today's lesson"></button></div>
    <h2 class="fb-card__title">Today's tasks</h2>
    <ul class="fb-tasks">${each(p.tasks, (t, i) => `<li><label><input type="checkbox"${i === 0 ? ' checked' : ''}> <span>${esc(t)}</span></label></li>`)}</ul>
    ${button(p.button)}
  </div>`),

  voucher: (p) => band(p.tone, `<div class="fb-container fb-split">
    <div class="fb-photo">${img(p.image)}</div>
    <div class="fb-stack">${p.eyebrow ? `<span class="fb-eyebrow is-plain">${esc(p.eyebrow)}</span>` : ''}<h1 class="fb-hero__title">${rich(p.title)}</h1><p class="fb-lede">${esc(p.lede)}</p>
      <span class="fb-slots__label">${esc(p.amountLabel || 'Choose an amount')}</span>
      <div class="fb-amounts">${each(p.amounts, (a, i) => `<button class="fb-amount" type="button" aria-pressed="${i === p.selected}">${esc(a)}</button>`)}</div>
      ${field({ label: 'Message for the card', optional: true }, 0)}
      ${button(p.button, 'is-block')}${trust(p.trust)}${flag(p.placeholder)}</div>
  </div>`),

  checkout: (p) => band(p.tone || 'surface', `<div class="fb-container is-form fb-stack">
    ${p.progress ? `<div class="fb-progress" style="--progress:${p.percent || 66}%"><span class="fb-progress__label">${esc(p.progress)}</span><div class="fb-progress__track"><div class="fb-progress__fill"></div></div></div>` : ''}
    <form class="fb-formcard is-light" onsubmit="return false">
      <div class="fb-steptabs"><div aria-current="step"><b>1</b><span>Your details</span><small>${esc(p.tab1 || 'Name and contact')}</small></div><div><b>2</b><span>Payment</span><small>Card details</small></div></div>
      <div class="fb-product"><div class="fb-product__thumb" style="overflow:hidden">${p.product.image ? img(p.product.image) : ''}</div><div><div class="fb-product__name">${esc(p.product.name)}</div><div class="fb-small">${esc(p.product.meta || '')}</div></div><div class="fb-product__price">${esc(p.product.price)}</div></div>
      ${each(p.fields, field)}
      ${p.bump ? `<div class="fb-bump"><label><input type="checkbox"> ${esc(p.bump.label)}</label><p>${esc(p.bump.body)}</p></div>` : ''}
      ${p.summary ? `<div class="fb-summary">${each(p.summary, ([k, v], i, arr) => `<div${i === arr.length - 1 ? ' class="is-total"' : ''}><span>${esc(k)}</span><span>${esc(v)}</span></div>`)}</div>` : ''}
      <button class="fb-button" type="submit">${esc(p.button)}</button>
      <p class="fb-secure">${esc(p.secure || 'Demo checkout: no payment is taken.')}</p>
    </form>
  </div>`),

  upsell: (p) => band(p.tone || 'dark', `<div class="fb-container is-narrow fb-stack is-center">
    <span class="fb-steppill">${esc(p.pill)}</span>
    <h1 class="fb-hero__title">${rich(p.title)}</h1>
    <p class="fb-lede">${esc(p.lede)}</p>
    ${p.image ? `<div class="fb-photo is-wide" style="inline-size:100%">${img(p.image)}</div>` : ''}
    ${checklist(p.checklist)}
    <div class="fb-price">${p.was ? `<span class="fb-price__was">${esc(p.was)}</span>` : ''}<span class="fb-price__now">${esc(p.now)}</span></div>
    <div class="fb-decision">${button({ label: p.yes, style: 'yes' })}<button class="fb-decline" type="button">${esc(p.no)}</button></div>
    ${flag(p.placeholder)}
  </div>`),

  confirm: (p) => band(p.tone, `<div class="fb-container is-form fb-stack is-center">
    <div class="fb-confirm__check" aria-hidden="true">✓</div>
    <h1 class="fb-heading">${rich(p.title)}</h1>
    <p class="fb-lede">${esc(p.lede)}</p>
    ${p.summary ? `<div class="fb-summary" style="inline-size:100%;text-align:start">${each(p.summary, ([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`)}</div>` : ''}
    <ol class="fb-nextsteps">${each(p.steps, (s, i) => `<li><b>${i + 1}</b><span>${esc(s)}</span></li>`)}</ol>
    ${button(p.button)}
    ${p.help ? `<p class="fb-small">${esc(p.help)}</p>` : ''}
  </div>`),

  footer: (p, ctx) => `<footer class="fb-footer"><nav><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></nav>${p.disclaimer ? `<p>${esc(p.disclaimer)}</p>` : ''}<p>© 2026 ${esc(ctx.brand)}</p></footer>`,
};

export function renderStep(step, ctx) {
  return step.blocks
    .map(([type, props]) => {
      const fn = blocks[type];
      if (!fn) throw new Error(`Unknown block "${type}" in step "${step.id}".`);
      return fn(props || {}, ctx);
    })
    .join('\n');
}
