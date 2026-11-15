// Usage:
//   npm run scan -- <url | urls.txt> [more…] [--out scans] [--concurrency 4] [--viewport mobile|desktop] [--no-screenshot] [--timeout 30000]
//   npm run scan:report -- [scans]
// A .txt file holds one URL per line; lines starting with # are skipped.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { scanUrls, viewports, type ViewportName } from './run.ts';
import { loadScans, report, reportMarkdown } from './report.ts';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const [, value] = args.splice(i, 2);
  return value ?? fallback;
};
const has = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i !== -1) args.splice(i, 1);
  return i !== -1;
};

if (args[0] === 'extract') {
  args.shift();
  const { extractCompany } = await import('./extract.ts');
  // Read the flags first, so whatever is left is the URL.
  const pages = Number(flag('pages', '6'));
  const viewport = flag('viewport', 'desktop') as ViewportName;
  const outFlag = flag('out', '');
  const download = has('download');
  const url = args[0];
  if (!url) {
    console.error('Usage: npm run extract -- <url> [--pages 6] [--viewport desktop|mobile] [--download] [--out extracts/<host>]');
    process.exit(1);
  }
  const host = new URL(url).host.replace(/^www\./, '');
  const outDir = path.resolve(outFlag || path.join('extracts', host));
  console.log(`Extracting ${host}: up to ${pages} pages at ${viewport}${download ? ', downloading files' : ''}, into ${outDir}`);
  const { record } = await extractCompany(url, { outDir, pages, viewport, download, log: (l) => console.log(l) });
  console.log(`\n${record.assets.total} assets (${Object.entries(record.assets.counts).map(([t, n]) => `${t} ${n}`).join(', ')}), ${record.icons.length} inline icons, ${record.components.length} component variants.`);
  console.log(`Saved ${path.join(outDir, 'design-system.json')}, assets.json, assets.csv and components/`);
} else if (args[0] === 'report') {
  args.shift();
  const dir = path.resolve(args[0] ?? 'scans');
  const r = report(await loadScans(dir));
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(r, null, 2));
  await writeFile(path.join(dir, 'report.md'), reportMarkdown(r));
  console.log(reportMarkdown(r));
  console.log(`\nSaved ${path.join(dir, 'report.json')} and report.md`);
} else {
  const outDir = path.resolve(flag('out', 'scans'));
  const concurrency = Number(flag('concurrency', '4'));
  const viewport = flag('viewport', 'mobile') as ViewportName;
  const timeoutMs = Number(flag('timeout', '30000'));
  const screenshot = !has('no-screenshot');
  if (!(viewport in viewports)) throw new Error('--viewport must be mobile or desktop');
  const urls: string[] = [];
  for (const a of args) {
    if (a.endsWith('.txt')) urls.push(...(await readFile(a, 'utf8')).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
    else urls.push(a);
  }
  if (!urls.length) {
    console.error('Usage: npm run scan -- <url | urls.txt> [--out scans] [--concurrency 4] [--viewport mobile|desktop] [--no-screenshot]');
    process.exit(1);
  }
  console.log(`Scanning ${urls.length} URL(s) at ${viewport}, ${concurrency} at a time, into ${outDir}`);
  let done = 0;
  const results = await scanUrls(urls, {
    outDir, concurrency, viewport, screenshot, timeoutMs,
    onResult: (s) => {
      done += 1;
      const detail = s.status === 'ok' ? `${s.funnel.first_ask.ask} first, ${s.funnel.sequence.join(' > ')}` : s.reason;
      console.log(`[${done}/${urls.length}] ${s.status.padEnd(7)} ${s.ms}ms ${s.url}  ${detail}`);
    },
  });
  const ok = results.filter((r) => r.status === 'ok').length;
  console.log(`\n${ok} read, ${results.length - ok} not read. Run "npm run scan:report -- ${path.relative(process.cwd(), outDir) || '.'}" for the cross-funnel report.`);
}
