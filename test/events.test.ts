import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readUtm } from '../src/system/events.ts';

test('readUtm keeps the five UTM keys and ignores everything else', () => {
  const utm = readUtm('?utm_source=meta&utm_medium=paid&utm_campaign=spring&utm_content=v2&utm_term=physio&email=a@b.com&gclid=x');
  assert.deepEqual(utm, { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'spring', utm_content: 'v2', utm_term: 'physio' });
});

test('readUtm trims values, drops empty ones and caps long ones', () => {
  const utm = readUtm(`?utm_source=%20meta%20&utm_medium=&utm_campaign=${'x'.repeat(300)}`);
  assert.equal(utm.utm_source, 'meta');
  assert.equal('utm_medium' in utm, false);
  assert.equal(utm.utm_campaign?.length, 100);
});

test('readUtm returns nothing for a link without UTMs', () => {
  assert.deepEqual(readUtm(''), {});
});
