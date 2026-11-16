#!/usr/bin/env node
// Render every funnel template in a company's design system and lay it out on
// the Blueprint board: one row per funnel, desktop steps (1440) then phone
// steps (390), arrows between steps, a label note per row.
//
//   node skills/funnel-blocks/blueprint/build.mjs \
//     --brand src/data/brands/<id>.json \
//     --content src/data/brands/<id>.funnels.json \
//     [--board http://127.0.0.1:4400] [--only lead-magnet,quiz] [--dry]
//
// Re-running updates the same artboards: ids are kept in
// .blueprint/funnel-blocks.<id>.json (git-ignored, like the rest of .blueprint).
// The board runs on 127.0.0.1 only; this script talks to nothing else.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { funnels, resolveStep } from '../templates/funnels.mjs';
import { renderStep } from '../templates/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, '..', 'kit');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
if (!args.brand || !args.content) {
  console.error('usage: build.mjs --brand <brand.json> --content <funnels.json> [--board url] [--only a,b] [--dry]');
  process.exit(1);
}
const BOARD = String(args.board || 'http://127.0.0.1:4400').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BOARD)) throw new Error('The board must be on 127.0.0.1.');

const brand = JSON.parse(fs.readFileSync(args.brand, 'utf8'));
const content = JSON.parse(fs.readFileSync(args.content, 'utf8'));
const brandId = path.basename(args.brand, '.json');
const only = args.only ? String(args.only).split(',') : null;

// ---------- CSS: kit + the company's tokens ----------
const minify = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').trim();
const kitCss = minify(fs.readFileSync(path.join(KIT, 'tokens.css'), 'utf8') + fs.readFileSync(path.join(KIT, 'blocks.css'), 'utf8'));
const tokenCss = (obj) => Object.entries(obj || {}).map(([k, v]) => `--${k}:${v};`).join('');
// The company's own tokens are declared after the kit, so they win. The frozen
// light-surface copies are re-declared so they pick up the company's values.
const brandCss = `:root{${tokenCss(brand.tokens)}${tokenCss(content.tokens)}--color-text-light:var(--color-text);--color-muted-light:var(--color-muted);--color-border-light:var(--color-border);}`;
const boardCss = '.g-ph{display:grid;place-items:center;min-block-size:200px;background:repeating-linear-gradient(135deg,var(--color-surface) 0 12px,var(--color-bg) 12px 24px);color:var(--color-muted);font:600 13px/1.3 system-ui;}';
const css = kitCss + brandCss + boardCss;

// ---------- Content: resolve @image names ----------
const images = content.images || {};
const resolveImages = (v) => {
  if (typeof v === 'string') return v.startsWith('@') ? images[v.slice(1)] ?? '' : v;
  if (Array.isArray(v)) return v.map(resolveImages);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveImages(x)]));
  return v;
};
const ctx = { brand: brand.name, logo: resolveImages(content.logo || '') };
const doc = (body, title = brand.name) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${String(title).replace(/[<&]/g, '')}</title><meta name="viewport" content="width=device-width,initial-scale=1">${brand.fontsHref ? `<link rel="stylesheet" href="${brand.fontsHref}">` : ''}<style>${css}</style></head><body class="fb">${body}</body></html>`;

// ---------- Board API ----------
const api = async (method, url, body) => {
  const res = await fetch(BOARD + url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
};
const manifestPath = path.join(process.cwd(), '.blueprint', `funnel-blocks.${brandId}.json`);
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { artboards: {}, notes: {}, arrows: {} };
const board = args.dry ? { artboards: [], items: [], connectors: [] } : await api('GET', '/api/board');
const has = (list, id) => (board[list] || []).some((x) => x.id === id);

// ---------- Render, measure, place ----------
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const measure = async (html, width) => {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(html.replaceAll('src="/assets/', `src="${BOARD}/assets/`), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return Math.max(600, await page.evaluate(() => document.documentElement.scrollHeight));
};

// ---------- Design system sheet: the company's tokens, type and parts ----------
const esc = (t = '') => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const allTokens = { ...(brand.tokens || {}), ...(content.tokens || {}) };
const swatches = Object.entries(allTokens).filter(([k]) => k.startsWith('color-'));
const sheetHtml = doc(`
<section class="fb-band"><div class="fb-container fb-stack">
  <div class="fb-stack is-tight"><span class="fb-eyebrow is-plain">Design system</span><h1 class="fb-hero__title">${esc(brand.name)}</h1>
  <p class="fb-lede">${esc(content.sheet?.source || '')}</p></div>
  <h2 class="fb-heading">Colour</h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">${swatches.map(([k, v]) => `<div style="border:1px solid var(--color-border);border-radius:12px;overflow:hidden;background:var(--color-bg)"><div style="block-size:72px;background:${esc(v)}"></div><div style="padding:10px 12px;font-size:12px;line-height:1.4"><b>${esc(k)}</b><br>${esc(v)}${content.sheet?.derived?.includes(k) ? '<br><span class="fb-placeholder-flag" style="margin-top:4px">derived</span>' : ''}</div></div>`).join('')}</div>
  <h2 class="fb-heading">Type</h2>
  <div class="fb-split" style="align-items:start"><div class="fb-stack is-tight">
    <p class="fb-small">${esc(allTokens['font-display'] || '')} · ${esc(allTokens['weight-display'] || '')}</p>
    <p class="fb-hero__title" style="margin:0">Hero headline</p><p class="fb-heading" style="margin:0">Section heading</p><p class="fb-card__title" style="margin:0">Card title</p></div>
    <div class="fb-stack is-tight"><p class="fb-small">${esc(allTokens['font-body'] || '')}</p><p class="fb-lede" style="color:var(--color-text)">Body copy. Four quick questions, then pick a time. We come to your home or work.</p><p class="fb-lede">Muted copy for supporting lines.</p><p class="fb-small">Small print and microcopy.</p></div></div>
  <h2 class="fb-heading">Parts</h2>
  <div class="fb-split" style="align-items:start">
    <div class="fb-stack"><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center"><a class="fb-button is-yes" href="#">Book my detail</a><a class="fb-button" href="#">Primary</a><a class="fb-button is-ghost" href="#">Ghost</a></div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center"><span class="fb-eyebrow">Eyebrow pill</span><span class="fb-eyebrow is-plain">Plain eyebrow</span><span class="fb-chip">Date chip</span><span class="fb-steppill">Step 2 of 3</span></div>
      <p class="fb-heading" style="margin:0">One phrase gets a <span class="fb-mark">marker</span> or <span class="fb-accent-word">accent</span></p>
      <div class="fb-field"><label for="sx">Field label</label><input id="sx" placeholder="Placeholder"></div>
      <div class="fb-answers"><button class="fb-answer" aria-pressed="false">Tap answer</button><button class="fb-answer" aria-pressed="true">Selected answer</button></div></div>
    <div class="fb-stack"><article class="fb-card"><div class="fb-card__icon">✓</div><h3 class="fb-card__title">Card</h3><p>White, 1px border, 16px corners, no shadow, as on their site.</p></article>
      <div class="fb-formcard"><p class="fb-formcard__title">Dark form card</p><div class="fb-field"><label for="sy">Email</label><input id="sy"></div><button class="fb-button is-yes">Submit</button></div></div>
  </div>
</div></section>
<section class="fb-band is-dark"><div class="fb-container fb-stack"><h2 class="fb-heading">Decisions to approve</h2><ol class="fb-nextsteps">${(content.sheet?.decisions || []).map((d, i) => `<li><b>${i + 1}</b><span>${esc(d)}</span></li>`).join('')}</ol></div></section>`, `Design system · ${brand.name}`);

const DESK = 1440, PHONE = 390, GAP = 80, PHONE_GAP = 60, ROW_GAP = 420;
const MAX = 4000, SLICE = 3900; // Blueprint's tallest artboard; long pages continue in a second part with 100px overlap
const slice = (html, k) => (k ? html.replace('</style>', `html body.fb{margin-top:-${k * SLICE}px !important}</style>`) : html);
let y = content.layout?.startY ?? 0;
// The sheet sits above the first funnel row.
{
  const height = await measure(sheetHtml, DESK);
  const sy = -(Math.min(MAX, height) + 520);
  if (!args.dry) {
    let id = manifest.artboards['_sheet'];
    const props = { name: `Design system · ${brand.name}`, x: 0, y: sy, width: DESK, height: Math.min(MAX, height) };
    if (id && has('artboards', id)) { await api('PUT', `/api/artboards/${id}/html`, sheetHtml); await api('PATCH', `/api/artboards/${id}`, props); }
    else { id = (await api('POST', '/api/artboards', { ...props, html: sheetHtml })).id; await api('PATCH', `/api/artboards/${id}`, { x: 0, y: sy }); manifest.artboards['_sheet'] = id; }
  }
}
const report = [];
const produced = new Set();

for (const funnel of funnels) {
  if (only && !only.includes(funnel.id)) continue;
  const steps = funnel.steps.map((s) => resolveStep(funnel, s, resolveImages(content)));
  const placed = [];
  let rowHeight = 0;
  let deskX = 0, phoneX = 0;
  for (const [vi, width] of [DESK, PHONE].entries()) {
    if (vi === 1) phoneX = deskX + 120;
    for (const [si, step] of steps.entries()) {
      const full = doc(renderStep(step, ctx), `${step.name} · ${funnel.name} · ${brand.name}`);
      const total = await measure(full, width);
      const parts = Math.max(1, Math.ceil((total - 100) / SLICE));
      for (let k = 0; k < parts; k++) {
      const html = slice(full, k);
      const height = Math.min(MAX, total - k * SLICE);
      const x = vi === 0 ? deskX : phoneX;
      if (vi === 0) deskX += DESK + (k === parts - 1 ? GAP : 40);
      else phoneX += PHONE + (k === parts - 1 ? PHONE_GAP : 24);
      const key = `${funnel.id}/${step.id}/${width}${k ? `#${k + 1}` : ''}`;
      const name = `${funnel.name} · ${si + 1} ${step.name} · ${width === DESK ? 'desktop' : 'phone'}${parts > 1 ? ` (part ${k + 1} of ${parts})` : ''}`;
      rowHeight = Math.max(rowHeight, height);
      const missing = k ? 0 : (html.match(/Missing content:/g) || []).length;
      report.push({ key, height, missing });
      produced.add(key);
      if (args.dry) continue;
      let id = manifest.artboards[key];
      if (id && has('artboards', id)) {
        await api('PUT', `/api/artboards/${id}/html`, html);
        await api('PATCH', `/api/artboards/${id}`, { name, x, y, width, height });
      } else {
        id = (await api('POST', '/api/artboards', { name, width, height, html })).id;
        await api('PATCH', `/api/artboards/${id}`, { x, y });
        manifest.artboards[key] = id;
      }
      if (k === 0) placed.push({ id, vi, si });
      }
    }
  }
  if (!args.dry) {
    // Row label
    const noteKey = funnel.id;
    const text = `${funnel.name.toUpperCase()}\nGoal: ${funnel.goal}\nSteps: ${steps.map((s) => s.name).join(' → ')}\nDesktop 1440 left, phone 390 right.`;
    const noteId = manifest.notes[noteKey];
    if (noteId && has('items', noteId)) await api('PATCH', `/api/items/${noteId}`, { text, x: 0, y: y - 190 });
    else manifest.notes[noteKey] = (await api('POST', '/api/items', { type: 'note', text, x: 0, y: y - 190, width: 520, author: 'agent' })).id;
    // Arrows between consecutive desktop steps
    const desk = placed.filter((p) => p.vi === 0).sort((a, b) => a.si - b.si);
    for (let i = 0; i < desk.length - 1; i++) {
      const k = `${funnel.id}/${i}`;
      if (manifest.arrows[k] && has('connectors', manifest.arrows[k])) continue;
      manifest.arrows[k] = (await api('POST', '/api/connectors', { from: desk[i].id, to: desk[i + 1].id, label: 'next step', author: 'agent' })).id;
    }
  }
  y += rowHeight + ROW_GAP;
}

await browser.close();
// Remove artboards this run no longer produces (a page that got shorter loses its part 2).
if (!args.dry) {
  const ran = funnels.filter((f) => !only || only.includes(f.id)).map((f) => `${f.id}/`);
  for (const [key, id] of Object.entries(manifest.artboards)) {
    if (key === '_sheet' || !ran.some((p) => key.startsWith(p)) || produced.has(key)) continue;
    if (has('artboards', id)) await api('DELETE', `/api/artboards/${id}`);
    delete manifest.artboards[key];
  }
}
if (!args.dry) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const gaps = report.filter((r) => r.missing);
console.log(`${report.length} artboards ${args.dry ? 'rendered (dry run)' : 'on the board'}.`);
if (gaps.length) console.log('Missing content in:', gaps.map((g) => `${g.key} (${g.missing})`).join(', '));
