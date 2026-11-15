import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBrand } from '../src/system/validate.ts';
import { load } from './helpers.ts';

test('both sample brands pass', () => {
  for (const id of ['larkspur', 'gridline']) assert.equal(validateBrand(load(id), []).ok, true, id);
});

test('a missing token is a schema error naming the field', () => {
  const brand = load('gridline') as unknown as { tokens: Record<string, string> };
  delete brand.tokens.radius;
  const result = validateBrand(brand, []);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith('tokens.radius')));
});

test('a layout variant outside the system is rejected', () => {
  const brand = load('gridline') as unknown as { layout: Record<string, string> };
  brand.layout.hero = 'carousel';
  assert.equal(validateBrand(brand, []).ok, false);
});

test('weak contrast is an error with the ratio', () => {
  const brand = load('gridline');
  brand.tokens['color-muted'] = '#B0B0B0';
  const result = validateBrand(brand, []);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith('Muted text on background: 2.17')));
});
