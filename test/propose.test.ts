import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palette, propose } from '../capture/propose.ts';
import type { Ledger, Sample } from '../capture/collect.ts';

const page = 'https://client.test/';
const sample = (role: string, property: string, value: string, viewport: 'desktop' | 'mobile' = 'desktop', count = 1, weight = 1): Sample =>
  ({ page, viewport, role, property, value, count, weight });
const both = (role: string, property: string, value: string, count = 1, weight = 1) =>
  [sample(role, property, value, 'desktop', count, weight), sample(role, property, value, 'mobile', count, weight)];

const ledger = (samples: Sample[], customProperties: Record<string, string> = {}): Ledger =>
  ({ urls: [page], captured_at: '2026-11-13', customProperties, samples, limitations: [] });

const base = [
  ...both('page', 'background-color', '#FFFFFF'),
  ...both('page', 'color', '#111111'),
  ...both('page', 'font-family', 'Inter, sans-serif'),
  ...both('action', 'background-color', '#0A7A4B', 3),
  ...both('action', 'color', '#FFFFFF', 3),
  ...both('action', 'border-radius', '8px', 3),
  ...both('h1', 'font-family', 'Fraunces, serif'),
  ...both('h1', 'font-weight', '500'),
  sample('h1', 'font-size', '14px', 'desktop'),
  sample('h1', 'font-size', '14px', 'mobile'),
  sample('display', 'font-size', '64px', 'desktop'),
  sample('display', 'font-size', '36px', 'mobile'),
  ...both('text', 'color', '#111111', 10, 900),
  ...both('text', 'color', '#5A5A5A', 6, 400),
  ...both('text', 'font-size', '16px', 10, 900),
  ...both('text', 'font-size', '13px', 4, 120),
];

test('values seen on every page at both widths are measured', () => {
  const { tokens } = propose(ledger(base));
  assert.deepEqual(tokens['color-accent'], { value: '#0A7A4B', confidence: 'measured', source: 'Most common filled button, 6 button(s)' });
  assert.equal(tokens['font-display'].value, 'Fraunces, serif');
  assert.equal(tokens.radius.value, '8px');
});

test('hero size comes from the largest text, not a small h1, as a fluid clamp', () => {
  assert.equal(propose(ledger(base)).tokens['size-hero'].value, 'clamp(2.25rem, 4.44vw, 4rem)');
});

test('muted is the most-used text colour that is not the body colour', () => {
  const t = propose(ledger(base)).tokens['color-muted'];
  assert.equal(t.value, '#5A5A5A');
  assert.equal(t.confidence, 'inferred');
});

test('missing evidence falls back to a default and is listed for review', () => {
  const p = propose(ledger(base));
  assert.equal(p.tokens['color-surface'].confidence, 'default');
  assert.ok(p.needsReview.some((line) => line.startsWith('color-surface: default')));
});

test('a colour matching a declared custom property is upgraded to measured', () => {
  const t = propose(ledger(base, { '--brand-grey': '#5a5a5a' })).tokens['color-muted'];
  assert.equal(t.confidence, 'measured');
  assert.match(t.source, /--brand-grey/);
});

test('a client colour that fails contrast is reported, not changed', () => {
  const pale = base.map((s) => (s.role === 'action' && s.property === 'color' ? { ...s, value: '#7FBFA0' } : s));
  const p = propose(ledger(pale));
  assert.equal(p.tokens['color-on-accent'].value, '#7FBFA0');
  assert.ok(p.contrastErrors.some((e) => e.startsWith('Button text on accent')));
});

test('a surface equal to the page background is ignored', () => {
  const p = propose(ledger([...base, ...both('surface', 'background-color', '#FFFFFF', 1, 90_000)]));
  assert.equal(p.tokens['color-surface'].confidence, 'default');
});

test('palette lists each solid colour once, most-used first, with its roles', () => {
  const colours = palette(ledger(base));
  assert.deepEqual(colours[0], { value: '#111111', count: 22, roles: ['page', 'text'] });
  assert.ok(colours.some((c) => c.value === '#0A7A4B' && c.roles.includes('action')));
  assert.ok(colours.every((c) => /^#[0-9A-F]{6}$/.test(c.value)), 'only colours, no fonts or sizes');
  assert.equal(new Set(colours.map((c) => c.value)).size, colours.length);
});
