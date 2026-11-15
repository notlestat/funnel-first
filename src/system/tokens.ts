// The token contract: every brand must define every name here.
// Sections may only style themselves with these variables.
export const tokenNames = [
  'color-bg',
  'color-surface',
  'color-text',
  'color-muted',
  'color-accent',
  'color-on-accent',
  'color-border',
  'font-display',
  'font-body',
  'weight-display',
  'size-hero',
  'size-heading',
  'size-body',
  'size-small',
  'space-section',
  'space-block',
  'radius',
  'measure',
] as const;

export type TokenName = (typeof tokenNames)[number];

export function toCssVars(tokens: Record<TokenName, string>): string {
  return tokenNames.map((name) => `--${name}: ${tokens[name]};`).join(' ');
}
