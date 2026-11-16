import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { brandFiles, buildStress, requireFreshBuild } from './build.ts';
import { checkPage } from './browser.ts';
import { writeReport } from './report.ts';
import { serve } from './server.ts';
import { viewports, type QaReport } from './types.ts';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write('Usage: npm run qa -- [brand...] [--warn-only]\nRequires npm run build. Writes qa-report/index.html and report.json.\n');
    return;
  }
  const unknown = args.find(a => a.startsWith('-') && a !== '--warn-only');
  if (unknown) throw new Error(`Unknown flag: ${unknown}`);
  const root = process.cwd();
  const brands = await brandFiles(root, args.filter(a => a !== '--warn-only'));
  if (!brands.length) throw new Error('No brands found in src/data/brands/.');
  await requireFreshBuild(root, brands.map(b => b.id));
  const outDir = path.join(root, 'qa-report');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'images'), { recursive: true });
  const report: QaReport = { schema: 'funnel-qa/1', generatedAt: new Date().toISOString(), brands: brands.map(b => b.id), stress: [], pages: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const real = await serve(path.join(root, 'dist'));
    try {
      for (const { id } of brands) for (const viewport of viewports) {
        process.stdout.write(`QA ${id} real ${viewport.width}px\n`);
        report.pages.push(await checkPage(browser, { url: `${real.url}/${id}/`, brand: id, case: 'real', viewport, outDir, prefix: `${id}-real-${viewport.width}` }));
      }
    } finally { await real.close(); }
    process.stdout.write('Building schema-valid stress copies in a temporary project...\n');
    const stress = await buildStress(root, brands);
    try {
      report.stress = stress.cases.map(c => ({ brand: c.brand, id: c.id, notes: c.notes, skipped: c.skipped }));
      const server = await serve(stress.root);
      try {
        for (const c of stress.cases) {
          if (c.skipped) continue;
          for (const viewport of viewports.filter(v => v.width !== 768)) {
            process.stdout.write(`QA ${c.brand} ${c.id} ${viewport.width}px\n`);
            report.pages.push(await checkPage(browser, { url: `${server.url}/${c.route}/`, brand: c.brand, case: c.id, viewport, outDir, prefix: `${c.brand}-${c.id}-${viewport.width}` }));
          }
        }
      } finally { await server.close(); }
    } finally { await stress.cleanup(); }
  } finally {
    await browser.close();
    const totals = await writeReport(report, outDir);
    process.stdout.write(`${totals.errors} errors, ${totals.warnings} warnings. Report: ${path.join(outDir, 'index.html')}\n`);
    if (totals.errors && !args.includes('--warn-only')) process.exitCode = 1;
  }
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
