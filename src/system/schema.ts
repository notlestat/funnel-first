// One schema for every consumer: Astro's content collections, the MCP server and the tests.
import { z } from 'zod';
import { tokenNames, type TokenName } from './tokens.ts';
import { recipes, variants } from './sections.ts';

const label = z.enum(['FACT', 'OBSERVATION', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN']);

// Same shape as the conversion-design skill's library, so records move between them unchanged.
export const referenceSchema = z.object({
  name: z.string(),
  source_url: z.url(),
  inspected_at: z.iso.date(),
  status: z.enum(['candidate', 'curated', 'rejected']),
  coverage: z.object({
    kind: z.string(),
    viewports: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
  tags: z.object({
    funnel_types: z.array(z.string()),
    pattern_types: z.array(z.string()),
    conversion_roles: z.array(z.string()),
  }),
  mechanism: z.object({ label, statement: z.string(), source: z.string().optional() }),
  evidence: z.object({
    level: z.enum(['visual-only', 'vendor-claim', 'case-study', 'controlled-experiment']),
  }),
});

const tokensSchema = z.object(
  Object.fromEntries(tokenNames.map((name) => [name, z.string().min(1)])) as Record<TokenName, z.ZodString>,
);

const recipeIds = Object.keys(recipes) as [keyof typeof recipes, ...(keyof typeof recipes)[]];

export const brandSchema = z.object({
  name: z.string(),
  fictional: z.boolean(),
  fontsHref: z.url().optional(),
  tokens: tokensSchema,
  recipe: z.enum(recipeIds),
  // Layout variants are how two clients on the same recipe get different pages.
  layout: z.object({
    hero: z.enum(variants.hero),
    benefits: z.enum(variants.benefits),
  }),
  seo: z.object({ title: z.string(), description: z.string().max(160) }),
  content: z.object({
    hero: z.object({ eyebrow: z.string(), headline: z.string(), subhead: z.string(), cta: z.string() }),
    benefits: z.object({
      heading: z.string(),
      items: z.array(z.object({ title: z.string(), body: z.string() })).min(2).max(4),
    }),
    proof: z.object({
      heading: z.string(),
      // A quote without a named, permitted source must be marked as a placeholder.
      quotes: z.array(z.object({ quote: z.string(), source: z.string(), placeholder: z.boolean() })),
    }),
    faq: z.object({
      heading: z.string(),
      items: z.array(z.object({ q: z.string(), a: z.string() })).min(2),
    }),
    capture: z.object({ heading: z.string(), body: z.string(), button: z.string(), consent: z.string() }),
  }),
});

// Only the parts the system sheet reads. The full ledger stays in the file as evidence.
export const captureSchema = z.looseObject({
  status: z.literal('reconstructed-draft'),
  urls: z.array(z.url()),
  captured_at: z.iso.date(),
  limitations: z.array(z.string()),
  proposal: z.looseObject({
    tokens: z.record(
      z.string(),
      z.object({ value: z.string(), confidence: z.enum(['measured', 'recurring', 'inferred', 'default']), source: z.string() }),
    ),
  }),
});

export type Brand = z.infer<typeof brandSchema>;
export type Reference = z.infer<typeof referenceSchema>;
