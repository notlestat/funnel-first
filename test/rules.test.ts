import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast } from '../src/system/contrast.ts';
import { conversionWarnings, distinctnessWarnings } from '../src/system/rules.ts';
import { load } from './helpers.ts';

test('contrast matches known WCAG values', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(2), '4.48');
});

test('conversion warnings flag a long headline and placeholder proof', () => {
  const brand = load('gridline');
  brand.content.hero!.headline = 'A very long headline that keeps going well past what anyone will read at a glance';
  const warnings = conversionWarnings(brand);
  assert.ok(warnings.some((w) => w.startsWith('Hero headline')));
  assert.ok(warnings.some((w) => w.includes('placeholder')));
});

test('a copy of an existing client is flagged as too similar', () => {
  const gridline = load('gridline');
  const copy = structuredClone(gridline);
  copy.name = 'Copycat';
  assert.equal(distinctnessWarnings(copy, [{ id: 'gridline', data: gridline }]).length, 1);
});

test('the two sample brands are distinct from each other', () => {
  assert.deepEqual(distinctnessWarnings(load('larkspur'), [{ id: 'gridline', data: load('gridline') }]), []);
});
