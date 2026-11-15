// Turn an evidence ledger into a token proposal for the system's token contract.
// Pure: no browser, no files. Every token says where it came from and how sure we are.
import { tokenNames, type TokenName } from '../src/system/tokens.ts';
import { contrastErrors } from '../src/system/rules.ts';
import type { Ledger, Sample } from './collect.ts';

export type Confidence = 'measured' | 'recurring' | 'inferred' | 'default';

export interface ProposedToken {
  value: string;
  confidence: Confidence;
  source: string;
}

export interface Proposal {
  tokens: Record<TokenName, ProposedToken>;
  fontsHref?: string;
  needsReview: string[];
  contrastErrors: string[];
}

// Used only when the page gave no evidence. Always reported as "default".
const defaults: Record<TokenName, string> = {
  'color-bg': '#FFFFFF',
  'color-surface': '#F4F4F5',
  'color-text': '#111111',
  'color-muted': '#52525B',
  'color-accent': '#1D4ED8',
  'color-on-accent': '#FFFFFF',
  'color-border': '#E4E4E7',
  'font-display': 'system-ui, sans-serif',
  'font-body': 'system-ui, sans-serif',
  'weight-display': '600',
  'size-hero': 'clamp(2.25rem, 6vw, 4rem)',
  'size-heading': 'clamp(1.5rem, 3.5vw, 2.25rem)',
  'size-body': '1rem',
  'size-small': '0.875rem',
  'space-section': 'clamp(3.5rem, 8vw, 6rem)',
  'space-block': '2rem',
  radius: '6px',
  measure: '72rem',
};

interface Ranked {
  value: string;
  weight: number;
  count: number;
  pages: number;
  viewports: Set<string>;
}

function rank(samples: Sample[], role: string, property: string, viewport?: string): Ranked[] {
  const byValue = new Map<string, Ranked & { pageSet: Set<string> }>();
  for (const s of samples) {
    if (s.role !== role || s.property !== property || (viewport && s.viewport !== viewport)) continue;
    const r = byValue.get(s.value) ?? { value: s.value, weight: 0, count: 0, pages: 0, viewports: new Set(), pageSet: new Set() };
    r.weight += s.weight;
    r.count += s.count;
    r.pageSet.add(s.page);
    r.viewports.add(s.viewport);
    r.pages = r.pageSet.size;
    byValue.set(s.value, r);
  }
  return [...byValue.values()].sort((a, b) => b.weight - a.weight);
}

const px = (v: string) => parseFloat(v);
const rem = (n: number) => `${+(n / 16).toFixed(4)}rem`;

// A fluid size from the desktop and mobile measurements, e.g. 36px and 64px -> clamp(2.25rem, 4.44vw, 4rem)
function fluid(mobile: number, desktop: number): string {
  if (Math.abs(desktop - mobile) < 1) return rem(desktop);
  const [lo, hi] = [Math.min(mobile, desktop), Math.max(mobile, desktop)];
  return `clamp(${rem(lo)}, ${+((hi / 1440) * 100).toFixed(2)}vw, ${rem(hi)})`;
}

export function propose(ledger: Ledger): Proposal {
  const s = ledger.samples;
  const pages = ledger.urls.length;
  const tokens = {} as Record<TokenName, ProposedToken>;
  const set = (name: TokenName, value: string | undefined, confidence: Confidence, source: string) => {
    tokens[name] = value === undefined ? { value: defaults[name], confidence: 'default', source: 'No evidence on the page. System default.' } : { value, confidence, source };
  };
  // A value seen on every page at both widths is measured; seen more than once, recurring.
  const strength = (r: Ranked): Confidence => (r.pages === pages && r.viewports.size === 2 ? 'measured' : r.count > 1 ? 'recurring' : 'inferred');
  const fromTop = (name: TokenName, role: string, property: string, label: string) => {
    const top = rank(s, role, property)[0];
    set(name, top?.value, top ? strength(top) : 'default', top ? `${label}, seen ${top.count}× on ${top.pages}/${pages} page(s)` : '');
  };

  fromTop('color-bg', 'page', 'background-color', 'Page background');
  fromTop('color-text', 'page', 'color', 'Body text colour');
  fromTop('font-body', 'page', 'font-family', 'Body font');

  const accent = rank(s, 'action', 'background-color')[0];
  set('color-accent', accent?.value, accent ? strength(accent) : 'default', accent ? `Most common filled button, ${accent.count} button(s)` : '');
  fromTop('color-on-accent', 'action', 'color', 'Button text colour');

  // Display type comes from the largest text near the top, falling back to h1
  const displayFont = rank(s, 'display', 'font-family')[0] ?? rank(s, 'h1', 'font-family')[0];
  set('font-display', displayFont?.value, displayFont ? strength(displayFont) : 'default', displayFont ? 'Font of the largest text near the top of the page' : '');
  const displayWeight = rank(s, 'display', 'font-weight')[0] ?? rank(s, 'h1', 'font-weight')[0];
  set('weight-display', displayWeight?.value, displayWeight ? strength(displayWeight) : 'default', displayWeight ? 'Weight of the largest text near the top' : '');

  // Sizes need both widths to build a fluid value. Measured only when every page agrees.
  const largest = (role: string, viewport: string) =>
    rank(s, role, 'font-size', viewport).sort((a, b) => px(b.value) - px(a.value))[0];
  for (const [name, role, label] of [['size-hero', 'display', 'Largest text near the top'], ['size-heading', 'h2', 'h2']] as const) {
    const d = role === 'display' ? largest(role, 'desktop') : rank(s, role, 'font-size', 'desktop')[0];
    const m = role === 'display' ? largest(role, 'mobile') : rank(s, role, 'font-size', 'mobile')[0];
    if (d && m) set(name, fluid(px(m.value), px(d.value)), d.pages === pages && m.pages === pages ? 'measured' : 'recurring', `${label} at 390px (${m.value}) and 1440px (${d.value})`);
    else set(name, undefined, 'default', '');
  }

  const bodySize = rank(s, 'page', 'font-size')[0];
  const textSize = rank(s, 'text', 'font-size')[0];
  const body = textSize ?? bodySize;
  set('size-body', body ? rem(px(body.value)) : undefined, body ? 'recurring' : 'default', body ? `Most common running-text size (${body.value})` : '');

  const small = body ? rank(s, 'text', 'font-size').find((r) => px(r.value) < px(body.value) && px(r.value) >= 11) : undefined;
  set('size-small', small ? rem(px(small.value)) : undefined, small ? 'inferred' : 'default', small ? `Most common text smaller than body (${small.value})` : '');

  // Muted: the most-used text colour that is not the body colour
  const muted = rank(s, 'text', 'color').find((r) => r.value !== tokens['color-text'].value);
  set('color-muted', muted?.value, muted ? 'inferred' : 'default', muted ? `Most-used secondary text colour (${Math.round(muted.weight)} characters)` : '');

  const surface = rank(s, 'surface', 'background-color').find((r) => ![tokens['color-accent'].value, tokens['color-bg'].value].includes(r.value));
  set('color-surface', surface?.value, surface ? 'inferred' : 'default', surface ? 'Largest filled area that is not the page background' : '');

  const border =
    rank(s, 'border', 'color').find((r) => ![tokens['color-text'].value, tokens['color-accent'].value].includes(r.value)) ??
    rank(s, 'input', 'border-color')[0];
  set('color-border', border?.value, border ? 'recurring' : 'default', border ? `Most common divider colour, seen ${border.count}×` : '');

  const radius = rank(s, 'action', 'border-radius')[0] ?? rank(s, 'input', 'border-radius')[0];
  set('radius', radius?.value, radius ? strength(radius) : 'default', radius ? 'Button corner radius' : '');

  const width = rank(s, 'container', 'max-width')[0];
  set('measure', width ? rem(px(width.value)) : undefined, width ? 'inferred' : 'default', width ? `Width of the container around the main heading (${width.value})` : '');

  const padD = rank(s, 'section', 'padding-top', 'desktop')[0];
  const padM = rank(s, 'section', 'padding-top', 'mobile')[0];
  if (padD && padM) set('space-section', fluid(px(padM.value), px(padD.value)), 'recurring', `Section padding at 390px (${padM.value}) and 1440px (${padD.value})`);
  else set('space-section', undefined, 'default', '');

  set('space-block', undefined, 'default', '');

  // A computed colour that matches a declared custom property is the strongest evidence.
  for (const name of tokenNames.filter((n) => n.startsWith('color-'))) {
    const t = tokens[name];
    if (t.confidence === 'default') continue;
    const declared = Object.entries(ledger.customProperties).find(([, v]) => v.toUpperCase() === t.value.toUpperCase());
    if (declared) tokens[name] = { ...t, confidence: 'measured', source: `${t.source}. Matches ${declared[0]} declared by the site` };
  }

  const needsReview = tokenNames
    .filter((n) => tokens[n].confidence === 'default' || tokens[n].confidence === 'inferred')
    .map((n) => `${n}: ${tokens[n].confidence}. ${tokens[n].source}`);

  const values = Object.fromEntries(tokenNames.map((n) => [n, tokens[n].value])) as Record<TokenName, string>;
  return { tokens, fontsHref: ledger.fontsHref, needsReview, contrastErrors: contrastErrors(values) };
}

export const tokenValues = (p: Proposal) => Object.fromEntries(tokenNames.map((n) => [n, p.tokens[n].value])) as Record<TokenName, string>;

// Every solid colour the site used, most-used first, with the roles it played.
// The capture page offers these as one-click swaps for a colour token.
export function palette(ledger: Ledger, limit = 16) {
  const byValue = new Map<string, { value: string; count: number; roles: Set<string> }>();
  for (const s of ledger.samples) {
    if (!/color/.test(s.property) || !/^#[0-9A-F]{6}$/i.test(s.value)) continue;
    const entry = byValue.get(s.value) ?? { value: s.value, count: 0, roles: new Set() };
    entry.count += s.count;
    entry.roles.add(s.role);
    byValue.set(s.value, entry);
  }
  return [...byValue.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ value, count, roles }) => ({ value, count, roles: [...roles] }));
}
