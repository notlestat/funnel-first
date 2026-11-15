// Conversion and accessibility rules the build enforces on every brand.
// A brand that breaks one fails `npm run build`, so no page ships without passing.
import { contrast } from './contrast.ts';
import type { TokenName } from './tokens.ts';
import type { Brand } from './schema.ts';

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

// ---- Conversion checks: risks a reviewer should see, not hard failures ----

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function conversionWarnings(brand: Brand): string[] {
  const { hero, proof, capture } = brand.content;
  const out: string[] = [];
  if (words(hero.headline) > 10) out.push(`Hero headline is ${words(hero.headline)} words. Aim for 10 or fewer.`);
  if (words(hero.subhead) > 35) out.push(`Hero subhead is ${words(hero.subhead)} words. Aim for 35 or fewer.`);
  if (words(hero.cta) > 4) out.push(`Hero button "${hero.cta}" is long. Aim for 4 words or fewer.`);
  if (words(capture.button) > 4) out.push(`Form button "${capture.button}" is long. Aim for 4 words or fewer.`);
  const pending = proof.quotes.filter((q) => q.placeholder).length;
  if (proof.quotes.length === 0) out.push('No proof. Add at least one real quote or a placeholder for the client.');
  if (pending) out.push(`${pending} proof quote${pending === 1 ? ' is a placeholder' : 's are placeholders'}. Not launch-ready.`);
  return out;
}

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
    if (brand.layout.hero === o.layout.hero && brand.layout.benefits === o.layout.benefits) shared.push('the same layout variants');
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
