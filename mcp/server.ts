// The conversion system's MCP server. Any agent connects here to read the system,
// search and add references, and validate or write a client's brand file.
// Every write goes through the same rules as the build.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fileStore } from './store.ts';
import { brandSchema, referenceSchema, type Brand } from '../src/system/schema.ts';
import { recipes, sections } from '../src/system/sections.ts';
import { tokenNames } from '../src/system/tokens.ts';
import { contrastPairs } from '../src/system/rules.ts';
import { slug, validateBrand } from '../src/system/validate.ts';
import { capture } from '../capture/index.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const store = fileStore(process.env.CONVERSION_DATA_DIR ?? path.resolve(HERE, '../src/data'));

const server = new McpServer({ name: 'conversion-system', version: '0.1.0' });

const reply = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const refuse = (message: string, extra: object = {}) => ({ ...reply({ ok: false, message, ...extra }), isError: true });
const idInput = z.string().describe('Lowercase slug, letters, numbers and hyphens, like "acme-dental".');

async function otherBrands(except: string) {
  const all = await store.list('brands');
  return all
    .filter((b) => b.id !== except)
    .flatMap((b) => {
      const parsed = brandSchema.safeParse(b.data);
      return parsed.success ? [{ id: b.id, data: parsed.data as Brand }] : [];
    });
}

server.registerTool(
  'system_overview',
  {
    description:
      'Start here. Returns the recipes, each section with its conversion role, job and layout variants, every token a brand must define, and the contrast rules. Read this before writing a brand.',
    inputSchema: {},
  },
  async () =>
    reply({
      recipes,
      sections: Object.values(sections).map(({ id, name, role, job, variants, referenceIds }) => ({ id, name, role, job, variants, referenceIds })),
      tokens: tokenNames,
      contrastRules: contrastPairs,
      writeRules: [
        'Copy comes from the client. No invented numbers, results or quotes.',
        'A quote without a named source and written permission keeps "placeholder": true.',
        'Choose layout variants that suit this brand. Do not copy the last client.',
      ],
    }),
);

server.registerTool(
  'search_references',
  {
    description: 'Search the reference library. All filters are optional and combine with AND.',
    inputSchema: {
      funnel_type: z.string().optional().describe('For example "lead-magnet" or "appointment".'),
      conversion_role: z.string().optional().describe('For example "trust" or "commitment".'),
      status: z.enum(['candidate', 'curated', 'rejected']).optional(),
      query: z.string().optional().describe('Words to match in the name or mechanism.'),
    },
  },
  async ({ funnel_type, conversion_role, status, query }) => {
    const q = query?.toLowerCase();
    const results = (await store.list('references')).filter(({ data }) => {
      const r = referenceSchema.safeParse(data);
      if (!r.success) return false;
      const d = r.data;
      return (
        (!funnel_type || d.tags.funnel_types.includes(funnel_type)) &&
        (!conversion_role || d.tags.conversion_roles.includes(conversion_role)) &&
        (!status || d.status === status) &&
        (!q || `${d.name} ${d.mechanism.statement}`.toLowerCase().includes(q))
      );
    });
    return reply({ count: results.length, references: results });
  },
);

server.registerTool(
  'add_reference',
  {
    description:
      'Add a reference you have inspected yourself. It is saved as "candidate"; only the designer marks it "curated". Refuses to overwrite an existing id.',
    inputSchema: { id: idInput, reference: z.record(z.string(), z.unknown()) },
  },
  async ({ id, reference }) => {
    if (!slug.test(id)) return refuse('id must be a lowercase slug.');
    if (await store.exists('references', id)) return refuse(`Reference "${id}" already exists.`);
    const parsed = referenceSchema.safeParse({ ...reference, status: 'candidate' });
    if (!parsed.success) return refuse('Reference does not match the schema.', { errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    const file = await store.put('references', id, parsed.data);
    return reply({ ok: true, id, status: 'candidate', file });
  },
);

server.registerTool(
  'capture_brand',
  {
    description:
      "Capture a client's existing brand from their live site. Opens 1 to 3 pages in real Chrome at 1440px and 390px, reads computed styles, saves the evidence to src/data/captures/<id>.json and returns a token proposal. Each token is marked measured, recurring, inferred or default. Use the same id for the brand file. Takes 10 to 60 seconds.",
    inputSchema: {
      id: idInput,
      urls: z.array(z.url()).min(1).max(3).describe('The main landing page first, then up to two pages that use different templates.'),
    },
  },
  async ({ id, urls }) => {
    if (!slug.test(id)) return refuse('id must be a lowercase slug.');
    try {
      const { file, record } = await capture(store, id, urls);
      const { tokens, fontsHref, needsReview, contrastErrors } = record.proposal;
      return reply({
        ok: true,
        file,
        status: record.status,
        tokens,
        fontsHref,
        needsReview,
        contrastErrors,
        limitations: record.limitations,
        next: [
          'Show needsReview and contrastErrors to the designer. Do not quietly fix a client colour.',
          'Draft the brand with these token values, the client copy and layout variants, then validate_brand and write_brand with the same id.',
          'If fontsHref is missing the fonts may be self-hosted or licensed. Ask the client before using them.',
        ],
      });
    } catch (error) {
      return refuse((error as Error).message);
    }
  },
);

server.registerTool(
  'list_brands',
  { description: 'List client brands with their recipe and layout variants.', inputSchema: {} },
  async () => {
    const brands = await store.list('brands');
    return reply(
      brands.map(({ id, data }) => {
        const b = data as Partial<Brand>;
        return { id, name: b.name, fictional: b.fictional, recipe: b.recipe, layout: b.layout };
      }),
    );
  },
);

server.registerTool(
  'get_brand',
  { description: 'Read one brand file in full.', inputSchema: { id: idInput } },
  async ({ id }) => {
    if (!slug.test(id)) return refuse('id must be a lowercase slug.');
    const data = await store.get('brands', id);
    return data === undefined ? refuse(`No brand "${id}".`) : reply(data);
  },
);

server.registerTool(
  'validate_brand',
  {
    description:
      'Check a brand without saving it. Errors (schema, contrast) block a write. Warnings flag conversion risks and clients that look too alike.',
    inputSchema: { id: idInput, brand: z.record(z.string(), z.unknown()) },
  },
  async ({ id, brand }) => {
    if (!slug.test(id)) return refuse('id must be a lowercase slug.');
    const { ok, errors, warnings } = validateBrand(brand, await otherBrands(id));
    return reply({ ok, errors, warnings });
  },
);

server.registerTool(
  'write_brand',
  {
    description:
      'Validate and save a brand file. Refuses when there are errors, or when the id exists and overwrite is not true. Returns warnings and the pages to review.',
    inputSchema: {
      id: idInput,
      brand: z.record(z.string(), z.unknown()),
      overwrite: z.boolean().optional().describe('Set true to replace an existing brand.'),
    },
  },
  async ({ id, brand, overwrite }) => {
    if (!slug.test(id)) return refuse('id must be a lowercase slug.');
    if (!overwrite && (await store.exists('brands', id))) return refuse(`Brand "${id}" exists. Pass overwrite: true to replace it.`);
    const check = validateBrand(brand, await otherBrands(id));
    if (!check.ok) return refuse('Brand not saved.', { errors: check.errors, warnings: check.warnings });
    const file = await store.put('brands', id, check.brand);
    return reply({ ok: true, file, warnings: check.warnings, review: [`/${id}/system`, `/${id}/`] });
  },
);

await server.connect(new StdioServerTransport());
