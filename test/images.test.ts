import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateBrand } from '../src/system/validate.ts';
import { imageErrors, launchChecks } from '../src/system/rules.ts';
import type { Brand } from '../src/system/schema.ts';
import { load } from './helpers.ts';

const img = (src: string, alt = 'A clean black SUV') => ({ src, alt, width: 960, height: 645 });
const pair = (placeholder = false) => ({
  before: img('/brands/gridline/before.webp', 'Dirty SUV'),
  after: img('/brands/gridline/after.webp', 'Clean SUV'),
  caption: 'Same car, one visit.',
  placeholder,
});

test('an image hotlinked from another site is rejected', () => {
  const brand = load('gridline');
  brand.content.hero!.image = img('https://example.com/hero.jpg');
  const result = validateBrand(brand, []);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith('content.hero.image.src')));
});

test('a logo needs alt text, a hero photo may be decorative', () => {
  const brand = load('gridline');
  brand.logo = img('/brands/gridline/logo.webp', '');
  assert.ok(validateBrand(brand, []).errors.some((e) => e.startsWith('logo.alt')));
  delete brand.logo;
  brand.content.hero!.image = img('/brands/gridline/hero.webp', '');
  assert.equal(validateBrand(brand, []).ok, true);
});

test('more than three before/after pairs is rejected', () => {
  const brand = load('gridline');
  brand.content.proof!.pairs = [pair(), pair(), pair(), pair()];
  assert.ok(validateBrand(brand, []).errors.some((e) => e.startsWith('content.proof.pairs')));
});

test('the build rejects missing files and images from another brand folder', () => {
  const pub = mkdtempSync(path.join(tmpdir(), 'public-'));
  mkdirSync(path.join(pub, 'brands/gridline'), { recursive: true });
  writeFileSync(path.join(pub, 'brands/gridline/hero.webp'), '');
  const brand = load('gridline') as Brand;
  brand.content.hero!.image = img('/brands/gridline/hero.webp');
  assert.deepEqual(imageErrors('gridline', brand, pub), []);
  brand.logo = img('/brands/gridline/missing.webp');
  assert.match(imageErrors('gridline', brand, pub)[0], /file not found/);
  brand.logo = img('/brands/larkspur/logo.webp');
  assert.match(imageErrors('gridline', brand, pub)[0], /keep this brand's images in \/brands\/gridline\//);
});

test('a placeholder before/after pair is not launch-ready', () => {
  const brand = load('gridline');
  brand.content.proof!.pairs = [pair(true)];
  const check = launchChecks(brand).find((c) => c.label.includes('before/after'));
  assert.equal(check?.status, 'waiting');
});
