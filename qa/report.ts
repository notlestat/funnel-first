import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { QaReport } from './types.ts';

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function writeReport(report: QaReport, outDir: string) {
  const e = escapeHtml;
  const findings = report.pages.flatMap(p => p.findings);
  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.length - errors;
  const image = (src: string, alt: string) => `<a href="${e(src)}"><img loading="lazy" src="${e(src)}" alt="${e(alt)}"></a>`;
  const brands = report.brands.map(brand => {
    const pages = report.pages.filter(p => p.brand === brand);
    const sectionNames = [...new Set(pages.flatMap(p => p.findings.map(f => f.section)))];
    return `<article id="${e(brand)}"><h2>${e(brand)}</h2>
      ${sectionNames.length ? sectionNames.map(section => `<section><h3>${e(section)}</h3><div class="findings">${pages.flatMap(p => p.findings.filter(f => f.section === section).map(f => `<figure>
        ${f.screenshot ? image(f.screenshot, `${f.check}, outlined in red`) : '<p>Screenshot unavailable</p>'}
        <figcaption><span class="severity ${f.severity}">${f.severity}</span> <strong>${e(f.check)}</strong><p>${e(p.case)} · ${p.viewport.width} × ${p.viewport.height}</p><p>${e(f.message)}</p><code>${e(f.selector)}</code></figcaption>
      </figure>`)).join('')}</div></section>`).join('') : '<p>No findings.</p>'}
      <section><h3>Stress contact sheets</h3><p>FAQ answers are expanded. Open an image to inspect it at its original size.</p>${report.stress.filter(s => s.brand === brand).map(stress => `<details><summary>${e(stress.id)}${stress.skipped ? ' · skipped' : ''}</summary>${stress.notes.map(n => `<p>${e(n)}</p>`).join('')}
        <div class="sheet">${pages.filter(p => p.case === stress.id).flatMap(p => p.sections.map(s => `<figure>${image(s.screenshot, `${brand}, ${stress.id}, ${s.section}, ${p.viewport.width}px`)}<figcaption>${e(s.section)} · ${p.viewport.width}px</figcaption></figure>`)).join('')}</div></details>`).join('')}</section>
      <details><summary>Measurements and coverage</summary><ul>${pages.map(p => `<li>${e(p.case)} · ${p.viewport.width}px · CLS ${p.metrics.cls?.toFixed(3) ?? 'unavailable'} · LCP ${p.metrics.lcpMs === null ? 'unavailable' : `${Math.round(p.metrics.lcpMs)}ms`}</li>`).join('')}</ul></details>
    </article>`;
  }).join('');
  const limitations = [...new Set(report.pages.flatMap(p => p.limitations))];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Funnel visual QA</title><style>
    :root{color-scheme:light;--bg:#f6f6f4;--ink:#18181b;--muted:#56565f;--line:#d5d5d8;--focus:#2457d6}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:100rem;margin:auto;padding:2rem 1rem 5rem}h1{font-size:1.75rem;margin:0}h2{margin-top:3rem;font-size:1.5rem}h3{font-size:1.1rem}p{margin:.5rem 0}nav{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;margin:1.5rem 0}a{color:#174db0;text-underline-offset:.2em}nav a,summary{min-height:44px;padding:.7rem 0}summary{cursor:pointer;font-weight:600}details{border-top:1px solid var(--line);padding:.5rem 0}a:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.findings,.sheet{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:1.25rem;margin:1rem 0}figure{margin:0;min-width:0;background:white;border:1px solid var(--line)}figure>a{display:block}img{display:block;width:100%;height:auto;max-height:28rem;object-fit:contain;object-position:top;background:#eee}figcaption{padding:1rem;overflow-wrap:anywhere}code{font-size:.8rem}strong{font-weight:650}.severity{display:inline-block;padding:.15rem .4rem;margin-right:.4rem;font-weight:650}.error{background:#ffe3e0;color:#8f1010}.warning{background:#fff0c8;color:#654500}.meta{color:var(--muted)}li{margin:.4rem 0}article{scroll-margin-top:1rem}
  </style></head><body><main><h1>Funnel visual QA</h1><p>${errors} errors · ${warnings} warnings · ${report.pages.length} page passes</p><p class="meta">${e(report.generatedAt)}</p><nav aria-label="Brands">${report.brands.map(b => `<a href="#${e(b)}">${e(b)}</a>`).join('')}</nav><details><summary>How to read this report</summary><p>Errors affect the exit code. Warnings need review. Red outlines identify the problem element. Each stress case has a grid of section screenshots.</p><p>These are automated observations, not design approval.</p><ul>${limitations.map(l => `<li>${e(l)}</li>`).join('')}</ul></details>${brands}</main></body></html>`;
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(outDir, 'index.html'), html);
  return { errors, warnings };
}
