// The funnel rules, enforced by the schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBrand } from '../src/system/validate.ts';
import { conversionWarnings, launchChecks } from '../src/system/rules.ts';
import { load } from './helpers.ts';

const errorsFor = (brand: unknown) => validateBrand(brand, []).errors;
const has = (errors: string[], start: string) => errors.some((e) => e.startsWith(start));

// A real-client brand for the pass rules: a sample marked as real, with a pass written for the test.
const realClient = () => {
  const brand = load('brightside-solar');
  brand.fictional = false;
  brand.pass = {
    steps: [
      { step: 'Ad', hook: 'Does your roof suit solar?', story: 'Four taps to find out.', offer: 'Tap through.' },
      { step: 'First screen', hook: 'The question headline.', story: 'The subhead promises an answer.', offer: 'One tap.' },
      { step: 'Contact', hook: 'Your result is ready.', story: 'The result and a survey slot.', offer: 'An email.' },
    ],
    headline_options: ['Does your roof suit solar?', 'Find out if solar pays on your roof'],
    doubt: { belief: 'Solar does not work here.', answer: 'The FAQ answers cloudy days.', where: 'faq' },
    offer_stack: [{ item: 'A roof check result', status: 'confirmed' }, { item: 'A survey discount', status: 'ask-client' }],
    client_questions: ['Is there a survey discount?'],
    checks: {
      'hook-story-offer': 'Yes, for three steps.', curiosity: 'A question headline.', doubt: 'In the FAQ.', 'not-for': 'The filter line.',
      'proof-near-ask': 'Not yet.', 'smallest-yes': 'One tap.', 'second-yes': 'Battery storage, later.',
    },
  };
  return brand;
};

test('every sample funnel type passes', () => {
  for (const id of ['brightside-solar', 'ironwood-coaching', 'fieldnote-studio', 'kiln-collective']) {
    const result = validateBrand(load(id), []);
    assert.equal(result.ok, true, `${id}: ${result.errors.join('; ')}`);
  }
});

test('a recipe section without content is an error naming it', () => {
  const brand = load('brightside-solar');
  delete brand.content.story;
  assert.ok(has(errorsFor(brand), 'content.story'));
});

test('multi-step recipes must put the first question in the hero', () => {
  const brand = load('brightside-solar');
  brand.layout.hero = 'split';
  assert.ok(has(errorsFor(brand), 'layout.hero'));
});

test('single-page recipes cannot use the question hero', () => {
  const brand = load('gridline');
  brand.layout.hero = 'question';
  assert.ok(has(errorsFor(brand), 'layout.hero'));
});

test('a question with more than 6 answers is rejected', () => {
  const brand = load('brightside-solar');
  brand.content.flow!.questions[0].options = Array.from({ length: 7 }, (_, i) => ({ label: `Answer ${i}` }));
  assert.ok(has(errorsFor(brand), 'content.flow.questions.0.options'));
});

test('more than 6 questions before contact is rejected', () => {
  const brand = load('brightside-solar');
  const q = brand.content.flow!.questions[0];
  brand.content.flow!.questions = Array.from({ length: 7 }, () => q);
  assert.ok(has(errorsFor(brand), 'content.flow.questions'));
});

test('the contact step asks for at most two details and includes email or phone', () => {
  const three = load('brightside-solar');
  three.content.flow!.contact.fields = ['name', 'email', 'phone'];
  assert.ok(has(errorsFor(three), 'content.flow.contact.fields'));

  const nameOnly = load('brightside-solar');
  nameOnly.content.flow!.contact.fields = ['name'];
  assert.ok(has(errorsFor(nameOnly), 'content.flow.contact.fields'));
});

test('a real video needs captions and a src from an allowed host', () => {
  const noCaptions = load('fieldnote-studio');
  noCaptions.content.video = { ...noCaptions.content.video!, placeholder: false, captions: false, src: 'https://www.youtube-nocookie.com/embed/abc' };
  assert.ok(has(errorsFor(noCaptions), 'content.video.captions'));

  const badHost = load('fieldnote-studio');
  badHost.content.video = { ...badHost.content.video!, placeholder: false, src: 'https://example.com/video' };
  assert.ok(has(errorsFor(badHost), 'content.video.src'));
});

test('a token value cannot break out of the style attribute', () => {
  const brand = load('gridline');
  brand.tokens['color-bg'] = 'red;} body{display:none';
  assert.ok(has(errorsFor(brand), 'tokens.color-bg'));
});

test('a missing strategy is a warning and a waiting launch check', () => {
  const brand = load('brightside-solar');
  delete brand.strategy;
  assert.ok(conversionWarnings(brand).some((w) => w.startsWith('No strategy')));
  assert.ok(launchChecks(brand).some((c) => c.label === 'funnel strategy written' && c.status === 'waiting'));
});

test('launch checks list what a flow still needs from the backend', () => {
  const labels = launchChecks(load('brightside-solar')).map((c) => c.label);
  assert.ok(labels.includes('booking calendar not connected'));
  assert.ok(labels.includes('form backend not connected, the demo sends nothing'));
  assert.ok(labels.includes('story still to be written or approved by the client'));
});

// ---- The Brunson pass ----

test('a real client funnel cannot build without a Brunson pass', () => {
  const brand = realClient();
  assert.equal(validateBrand(brand, []).ok, true, validateBrand(brand, []).errors.join('; '));
  delete brand.pass;
  assert.ok(has(errorsFor(brand), 'pass'));
});

test('fictional samples may skip the pass, with a warning', () => {
  const brand = load('brightside-solar');
  assert.equal(validateBrand(brand, []).ok, true);
  assert.ok(conversionWarnings(brand).some((w) => w.startsWith('No Brunson pass')));
});

test('the doubt must be answered in a section the recipe has', () => {
  const brand = realClient();
  brand.pass!.doubt.where = 'agenda'; // the appointment recipe has no agenda section
  assert.ok(has(errorsFor(brand), 'pass.doubt.where'));
});

test('every designer check needs a written answer', () => {
  const brand = realClient();
  delete (brand.pass!.checks as Record<string, string>)['second-yes'];
  assert.ok(has(errorsFor(brand), 'pass.checks.second-yes'));
});

test('a pass needs at least two headlines and three steps', () => {
  const one = realClient();
  one.pass!.headline_options = ['Only one'];
  assert.ok(has(errorsFor(one), 'pass.headline_options'));
  const short = realClient();
  short.pass!.steps = short.pass!.steps.slice(0, 2);
  assert.ok(has(errorsFor(short), 'pass.steps'));
});

test('an offer stack with nothing confirmed is flagged as a weak first yes', () => {
  const brand = realClient();
  for (const item of brand.pass!.offer_stack) item.status = 'ask-client';
  assert.ok(conversionWarnings(brand).some((w) => w.includes('first yes is weak')));
  assert.ok(launchChecks(brand).some((c) => c.label === 'offer stack still to be confirmed by the client'));
});
