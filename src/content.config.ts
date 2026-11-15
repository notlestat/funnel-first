// The data layer. Astro validates every brand and reference file against the shared schema.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { brandSchema, captureSchema, referenceSchema } from './system/schema.ts';

const references = defineCollection({
  loader: glob({ pattern: '[!_]*.json', base: './src/data/references' }),
  schema: referenceSchema,
});

const brands = defineCollection({
  loader: glob({ pattern: '[!_]*.json', base: './src/data/brands' }),
  schema: brandSchema,
});

// Brand captures: the evidence behind a client's tokens, keyed by the same id as the brand.
const captures = defineCollection({
  loader: glob({ pattern: '[!_]*.json', base: './src/data/captures' }),
  schema: captureSchema,
});

export const collections = { references, brands, captures };
