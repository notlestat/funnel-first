import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { brandSchema, type Brand } from '../src/system/schema.ts';
import { stressCases } from './stress.ts';

export async function brandFiles(root: string, requested: string[]) {
  const folder = path.join(root, 'src/data/brands');
  const ids = (await readdir(folder)).filter(f => /^[a-z0-9][a-z0-9-]*\.json$/.test(f)).map(f => f.slice(0, -5)).sort();
  for (const id of requested) if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !ids.includes(id)) throw new Error(`Unknown brand: ${id}`);
  return Promise.all((requested.length ? [...new Set(requested)] : ids).map(async id => ({ id, brand: brandSchema.parse(JSON.parse(await readFile(path.join(folder, `${id}.json`), 'utf8'))) })));
}

async function newest(root: string): Promise<number> {
  const s = await stat(root).catch(() => null);
  if (!s) return 0;
  if (!s.isDirectory()) return s.mtimeMs;
  return Math.max(s.mtimeMs, ...await Promise.all((await readdir(root)).map(f => newest(path.join(root, f)))));
}

export async function requireFreshBuild(root: string, ids: string[]) {
  const modified = Math.max(...await Promise.all(['src', 'public', 'astro.config.mjs', 'package.json', 'package-lock.json'].map(p => newest(path.join(root, p)))));
  for (const id of ids) {
    const built = await stat(path.join(root, 'dist', id, 'index.html')).catch(() => null);
    if (!built || built.mtimeMs < modified) throw new Error('A fresh dist/ build is required. Run npm run build, then npm run qa.');
  }
}

export function runBuild(root: string, astro: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [astro, 'build'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const append = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-16000); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => { child.kill('SIGTERM'); }, 180000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Stress build failed (${code}):\n${output}`)); });
  });
}

export async function buildStress(root: string, brands: { id: string; brand: Brand }[]) {
  const temp = await mkdtemp(path.join(tmpdir(), 'funnel-qa-'));
  const cleanup = () => rm(temp, { recursive: true, force: true });
  try {
    // Copy the real renderer. Only this disposable copy gets different content.
    await cp(path.join(root, 'src'), path.join(temp, 'src'), { recursive: true, filter: source => source !== path.join(root, 'src/data/brands') });
    await mkdir(path.join(temp, 'src/data/brands'), { recursive: true });
    await cp(path.join(root, 'package.json'), path.join(temp, 'package.json'));
    await cp(path.join(root, 'astro.config.mjs'), path.join(temp, 'astro.config.mjs'));
    await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
    if (await stat(path.join(root, 'public')).catch(() => null)) await cp(path.join(root, 'public'), path.join(temp, 'public'), { recursive: true });
    const cases: { brand: string; id: string; route: string; notes: string[]; skipped: boolean }[] = [];
    for (const { id, brand } of brands) {
      for (const stress of stressCases(brand, `/brands/${id}/qa-portrait.svg`)) {
        const route = `${id}-qa-${stress.id}`;
        cases.push({ brand: id, id: stress.id, route, notes: [...stress.notes, ...(stress.id === 'brand-name-long' ? ['The funnel currently does not render brand.name as text. This case checks logo alt text and schema acceptance.'] : [])], skipped: !stress.brand });
        if (!stress.brand) continue;
        const assetDir = path.join(temp, 'public/brands', route);
        await mkdir(assetDir, { recursive: true });
        const originalAssets = path.join(root, 'public/brands', id);
        if (await stat(originalAssets).catch(() => null)) await cp(originalAssets, assetDir, { recursive: true });
        await cp(path.join(root, 'qa/fixtures/portrait.svg'), path.join(assetDir, 'qa-portrait.svg'));
        // Route aliases must own their images for the unchanged image rules.
        const data: unknown = JSON.parse(JSON.stringify(stress.brand), (key, value: unknown) => key === 'src' && typeof value === 'string' && value.startsWith(`/brands/${id}/`) ? value.replace(`/brands/${id}/`, `/brands/${route}/`) : value);
        const parsed = brandSchema.parse(data);
        await writeFile(path.join(temp, 'src/data/brands', `${route}.json`), JSON.stringify(parsed));
      }
    }
    await runBuild(temp, path.join(root, 'node_modules/astro/bin/astro.mjs'));
    return { root: path.join(temp, 'dist'), cases, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
