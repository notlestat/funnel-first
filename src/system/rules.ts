// Conversion and accessibility rules the build enforces on every brand.
// A brand that breaks one fails `npm run build`, so no page ships without passing.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { contrast } from './contrast.ts';
import type { TokenName } from './tokens.ts';
import type { Brand, BrandImage } from './schema.ts';

type Tokens = Record<TokenName, string>;

export const contrastPairs = [
  { label: 'Body text on background', fg: 'color-text', bg: 'color-bg', min: 4.5 },
  { label: 'Muted text on background', fg: 'color-muted', bg: 'color-bg', min: 4.5 },
  { label: 'Muted text on surface', fg: 'color-muted', bg: 'color-surface', min: 4.5 },
  { label: 'Button text on accent', fg: 'color-on-accent', bg: 'color-accent', min: 4.5 },
] as const satisfies readonly { label: string; fg: TokenName; bg: TokenName; min: number }[];

const hex = /^#[0-9a-f]{6}$/i;

export function checkContrast(tokens: Tokens) {
  return contrastPairs.map((pair) => {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    if (!hex.test(fg) || !hex.test(bg)) {
      return { ...pair, ratio: 0, pass: false, note: 'Colour tokens must be 6-digit hex' };
    }
    const ratio = contrast(fg, bg);
    return { ...pair, ratio, pass: ratio >= pair.min, note: '' };
  });
}

export function assertBrandPasses(id: string, tokens: Tokens) {
  const failures = checkContrast(tokens).filter((r) => !r.pass);
  if (failures.length) {
    const lines = failures.map((f) => `  ${f.label}: ${f.ratio.toFixed(2)} (needs ${f.min}) ${f.note}`);
    throw new Error(`Brand "${id}" fails contrast:\n${lines.join('\n')}`);
  }
}

// Every image a brand points at.
export function brandImages(brand: Brand): BrandImage[] {
  const { hero, proof } = brand.content;
  const pairs = (proof?.pairs ?? []).flatMap((p) => [p.before, p.after]);
  return [brand.logo, hero?.image, ...pairs].filter((i): i is BrandImage => i !== undefined);
}

// Images live in the brand's own folder, so one client can never show another client's files.
export function imageErrors(id: string, brand: Brand, publicDir: string): string[] {
  return brandImages(brand).flatMap((img) => {
    if (!img.src.startsWith(`/brands/${id}/`)) return [`${img.src}: keep this brand's images in /brands/${id}/`];
    if (!existsSync(path.join(publicDir, img.src))) return [`${img.src}: file not found in public${img.src}`];
    return [];
  });
}

export function assertImagesExist(id: string, brand: Brand, publicDir: string) {
  const errors = imageErrors(id, brand, publicDir);
  if (errors.length) throw new Error(`Brand "${id}" has image errors:\n  ${errors.join('\n  ')}`);
}

// ---- Conversion checks: risks a reviewer should see, not hard failures ----

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function conversionWarnings(brand: Brand): string[] {
  const { hero, proof, capture, flow, story, video, cta } = brand.content;
  const out: string[] = [];
  if (!brand.strategy) {
    out.push('No strategy. Write the dream customer, where they are, the hook, the belief that stops them, the offer and who it is not for.');
  }
  if (hero) {
    if (words(hero.headline) > 10) out.push(`Hero headline is ${words(hero.headline)} words. Aim for 10 or fewer.`);
    if (words(hero.subhead) > 35) out.push(`Hero subhead is ${words(hero.subhead)} words. Aim for 35 or fewer.`);
    if (hero.cta && words(hero.cta) > 4) out.push(`Hero button "${hero.cta}" is long. Aim for 4 words or fewer.`);
  }
  for (const [label, text] of [['Form button', capture?.button], ['Closing button', cta?.button], ['Contact button', flow?.contact.button]] as const) {
    if (text && words(text) > 5) out.push(`${label} "${text}" is long. Aim for 5 words or fewer.`);
  }
  if (flow) {
    if (flow.questions.length > 5) out.push(`The flow asks ${flow.questions.length} questions before contact. Four is usually enough to qualify.`);
    for (const q of flow.questions) {
      const long = q.options.filter((o) => words(o.label) > 5);
      if (long.length) out.push(`"${q.q}" has answers over 5 words. Answers should read at a glance.`);
    }
    if (!flow.contact.filter && brand.recipe === 'appointment') out.push('No filter line on the contact step. Say who should not book.');
  }
  if (proof) {
    const pending = proof.quotes.filter((q) => q.placeholder).length;
    if (proof.quotes.length === 0) out.push('No proof. Add at least one real quote or a placeholder for the client.');
    if (pending) out.push(`${pending} proof quote${pending === 1 ? ' is a placeholder' : 's are placeholders'}. Not launch-ready.`);
    const pendingPairs = (proof.pairs ?? []).filter((p) => p.placeholder).length;
    if (pendingPairs) out.push(`${pendingPairs} before/after pair${pendingPairs === 1 ? ' is a placeholder' : 's are placeholders'}. Not launch-ready.`);
  }
  if (!brand.pass) {
    out.push('No Brunson pass. Write hook, story and offer for every step, the doubt and where it is answered, the offer stack, and answers to the designer checks. Required for real clients.');
  } else {
    const unconfirmed = brand.pass.offer_stack.filter((i) => i.status === 'ask-client').length;
    if (unconfirmed === brand.pass.offer_stack.length) out.push('No item in the offer stack is confirmed by the client yet. The first yes is weak. Not launch-ready.');
    if (brand.pass.client_questions.length) out.push(`${brand.pass.client_questions.length} question(s) for the client in the Brunson pass.`);
  }
  if (story?.placeholder) out.push('The story is a placeholder. The client must write or approve it. Not launch-ready.');
  if (video?.placeholder) out.push('The video is a placeholder. Not launch-ready.');
  return out;
}

// ---- Launch readiness: one list for the system sheet and the agent tools ----

export type Check = { status: 'pass' | 'waiting' | 'fail'; label: string };

export function launchChecks(brand: Brand): Check[] {
  const { proof, story, video, flow } = brand.content;
  const checks: Check[] = [];
  const contrastOk = checkContrast(brand.tokens).every((r) => r.pass);
  checks.push({ status: contrastOk ? 'pass' : 'fail', label: 'colour contrast (WCAG AA)' });
  checks.push({ status: brand.strategy ? 'pass' : 'waiting', label: 'funnel strategy written' });
  checks.push({ status: brand.pass ? 'pass' : 'waiting', label: 'Brunson pass written' });
  if (brand.pass) {
    const confirmed = brand.pass.offer_stack.some((i) => i.status === 'confirmed');
    checks.push({ status: confirmed ? 'pass' : 'waiting', label: confirmed ? 'offer stack has confirmed items' : 'offer stack still to be confirmed by the client' });
    if (brand.pass.client_questions.length) checks.push({ status: 'waiting', label: `${brand.pass.client_questions.length} question(s) for the client still open` });
  }
  if (proof) {
    const n = proof.quotes.filter((q) => q.placeholder).length;
    checks.push({ status: n ? 'waiting' : 'pass', label: `proof, ${n} placeholder quote${n === 1 ? '' : 's'} still to be supplied` });
    const pairs = proof.pairs ?? [];
    const p = pairs.filter((x) => x.placeholder).length;
    if (pairs.length) checks.push({ status: p ? 'waiting' : 'pass', label: p ? `${p} before/after pair${p === 1 ? '' : 's'} still to be confirmed by the client` : 'before/after photos confirmed' });
  }
  if (story) checks.push({ status: story.placeholder ? 'waiting' : 'pass', label: story.placeholder ? 'story still to be written or approved by the client' : 'story approved' });
  if (video) checks.push({ status: video.placeholder ? 'waiting' : 'pass', label: video.placeholder ? 'video still to be supplied' : 'video supplied with captions' });
  checks.push({ status: 'waiting', label: 'form backend not connected, the demo sends nothing' });
  checks.push(brand.analytics ? { status: 'pass', label: 'analytics sends to PostHog' } : { status: 'waiting', label: 'analytics not set, nothing is measured' });
  if (flow?.after === 'booking') checks.push({ status: 'waiting', label: 'booking calendar not connected' });
  if (flow?.after === 'result') checks.push({ status: 'waiting', label: 'quiz results page not built' });
  return checks;
}

// What a passing build cannot check. The Brunson pass answers each one in writing (brand.pass.checks),
// and the designer judges the answers on the board.
export const designerChecks = [
  { id: 'hook-story-offer', q: 'Can you name the hook, the story and the offer on every step? When a step fails, it is one of those three.' },
  { id: 'curiosity', q: 'Does the headline make the visitor curious, or do they already know what they will get?' },
  { id: 'doubt', q: 'Does the page name the belief that stops this customer, and answer it?' },
  { id: 'not-for', q: 'Does the page say who it is not for?' },
  { id: 'proof-near-ask', q: 'Is proof next to every ask: a logo strip under the form, a rating by the button?' },
  { id: 'smallest-yes', q: 'Is the first ask the smallest possible yes?' },
  { id: 'second-yes', q: 'Is there a second yes after this one? It belongs to the backend, but plan it now.' },
] as const;
export type DesignerCheckId = (typeof designerChecks)[number]['id'];
export const designerCheckIds = designerChecks.map((c) => c.id) as DesignerCheckId[];

// ---- Distinctness checks: keep every client's system visibly its own ----

function hexDistance(a: string, b: string): number {
  const rgb = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const firstFont = (stack: string) => stack.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();

export function distinctnessWarnings(brand: Brand, others: { id: string; data: Brand }[]): string[] {
  const out: string[] = [];
  for (const other of others) {
    const o = other.data;
    const shared: string[] = [];
    if (brand.recipe === o.recipe && JSON.stringify(brand.layout) === JSON.stringify(o.layout)) shared.push('the same layout variants');
    if (hexDistance(brand.tokens['color-accent'], o.tokens['color-accent']) < 40) shared.push('a near-identical accent colour');
    if (firstFont(brand.tokens['font-display']) === firstFont(o.tokens['font-display'])) shared.push('the same display font');
    if (shared.length >= 2) out.push(`Looks close to "${other.id}": ${shared.join(', ')}.`);
  }
  return out;
}

// ---- Everything at once, as the MCP server and tests use it ----

export function contrastErrors(tokens: Tokens): string[] {
  return checkContrast(tokens)
    .filter((r) => !r.pass)
    .map((f) => `${f.label}: ${f.ratio.toFixed(2)}, needs ${f.min}. ${f.note}`.trim());
}
