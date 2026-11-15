// Runs the real MCP server as a child process against a temporary copy of the data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { load } from './helpers.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let dataDir: string;
let client: Client;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'conversion-system-'));
  await cp(path.join(ROOT, 'src/data'), dataDir, { recursive: true });
  client = new Client({ name: 'test', version: '0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'mcp/server.ts')],
      env: { ...process.env, CONVERSION_DATA_DIR: dataDir, SCANS_DIR: path.join(dataDir, 'scans'), EXTRACTS_DIR: path.join(dataDir, 'extracts') } as Record<string, string>,
    }),
  );
});

after(async () => {
  await client.close();
  await rm(dataDir, { recursive: true, force: true });
});

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const res = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { error: Boolean(res.isError), body: JSON.parse(res.content[0].text) };
};

const newClient = () => {
  const b = load('larkspur');
  b.name = 'Test Clinic';
  b.layout = { hero: 'split', benefits: 'cards' };
  Object.assign(b.tokens, { 'color-accent': '#5B3FA8', 'font-display': "'Newsreader', serif" });
  return b;
};

test('lists all eleven tools', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    'add_reference', 'capture_brand', 'extract_design_system', 'get_brand', 'list_brands', 'scan_funnels', 'scan_report', 'search_references', 'system_overview', 'validate_brand', 'write_brand',
  ]);
});

test('system_overview carries the funnel playbook', async () => {
  const { body } = await call('system_overview');
  assert.deepEqual(Object.keys(body.recipes).sort(), ['appointment', 'lead-magnet', 'quiz', 'vsl', 'webinar']);
  assert.ok(body.recipeGuide.appointment.firstAsk.includes('question'));
  assert.ok(body.designerChecks.some((c: { id: string; q: string }) => c.id === 'hook-story-offer' && c.q.includes('hook, the story and the offer')));
  assert.equal(body.sections.find((s: { id: string }) => s.id === 'flow').stage, 'offer');
});

test('scan_funnels refuses a non-web URL before opening a browser', async () => {
  const res = await client.callTool({ name: 'scan_funnels', arguments: { urls: ['file:///etc/passwd'] } });
  assert.equal(res.isError, true);
});

test('system_overview describes the recipe and variants', async () => {
  const { body } = await call('system_overview');
  assert.deepEqual(body.recipes['lead-magnet'], ['hero', 'benefits', 'proof', 'faq', 'capture']);
  assert.deepEqual(body.sections.find((s: { id: string }) => s.id === 'hero').variants, ['stacked', 'split', 'question']);
});

test('search_references filters by funnel type', async () => {
  // The library may be empty, so add one reference, then check what the filter returns.
  await call('add_reference', {
    id: 'search-sample',
    reference: {
      name: 'Search sample', source_url: 'https://example.com/', inspected_at: '2026-11-15', status: 'candidate',
      coverage: { kind: 'full-page', viewports: ['mobile-390'], limitations: [] },
      tags: { funnel_types: ['appointment'], pattern_types: ['multi-step'], conversion_roles: ['qualification'] },
      mechanism: { label: 'HYPOTHESIS', statement: 'Test record.' }, evidence: { level: 'visual-only' },
    },
  });
  const { body } = await call('search_references', { funnel_type: 'appointment' });
  assert.ok(body.count >= 1);
  assert.equal(body.references.length, body.count);
  for (const r of body.references) assert.ok(r.data.tags.funnel_types.includes('appointment'), r.id);
  assert.equal((await call('search_references', { funnel_type: 'no-such-funnel' })).body.count, 0);
});

test('write_brand saves a valid, distinct client and returns review pages', async () => {
  const { error, body } = await call('write_brand', { id: 'test-clinic', brand: newClient() });
  assert.equal(error, false, JSON.stringify(body));
  assert.deepEqual(body.review, ['/test-clinic/system', '/test-clinic/']);
  assert.ok((await readdir(path.join(dataDir, 'brands'))).includes('test-clinic.json'));
});

test('write_brand refuses to overwrite without permission', async () => {
  assert.equal((await call('write_brand', { id: 'test-clinic', brand: newClient() })).error, true);
});

test('write_brand refuses weak contrast and saves nothing', async () => {
  const b = newClient();
  b.tokens['color-on-accent'] = '#8A74C9'; // fails on the purple accent
  const { error, body } = await call('write_brand', { id: 'low-contrast', brand: b });
  assert.equal(error, true);
  assert.ok(body.errors[0].startsWith('Button text on accent'));
  assert.ok(!(await readdir(path.join(dataDir, 'brands'))).includes('low-contrast.json'));
});

test('ids that could escape the data folder are refused', async () => {
  for (const id of ['../escape', 'a/b', 'UPPER', '']) {
    assert.equal((await call('write_brand', { id, brand: newClient() })).error, true, id);
  }
});

test('validate_brand warns when a client copies another', async () => {
  const { body } = await call('validate_brand', { id: 'copycat', brand: load('gridline') });
  assert.equal(body.ok, true);
  assert.ok(body.warnings.some((w: string) => w.startsWith('Looks close to "gridline"')));
});

test('add_reference always saves as candidate and refuses duplicates', async () => {
  const ref = {
    name: 'Example inspected page',
    source_url: 'https://example.com/',
    inspected_at: '2026-11-13',
    status: 'curated',
    coverage: { kind: 'full-page', viewports: ['desktop'], limitations: [] },
    tags: { funnel_types: ['lead-magnet'], pattern_types: ['hero'], conversion_roles: ['attention'] },
    mechanism: { label: 'HYPOTHESIS', statement: 'Test record.' },
    evidence: { level: 'visual-only' },
  };
  const first = await call('add_reference', { id: 'example-page', reference: ref });
  assert.equal(first.body.status, 'candidate');
  assert.equal((await call('add_reference', { id: 'example-page', reference: ref })).error, true);
});

test('capture_brand refuses a bad id and a non-web URL before opening a browser', async () => {
  assert.equal((await call('capture_brand', { id: '../x', urls: ['https://example.com/'] })).error, true);
  const res = await client.callTool({ name: 'capture_brand', arguments: { id: 'ok', urls: ['file:///etc/passwd'] } });
  assert.equal(res.isError, true);
});
