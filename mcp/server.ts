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
import { recipeGuide, recipes, sections } from '../src/system/sections.ts';
import { tokenNames } from '../src/system/tokens.ts';
import { contrastPairs, designerChecks, launchChecks } from '../src/system/rules.ts';
import { slug, validateBrand } from '../src/system/validate.ts';
import { capture } from '../capture/index.ts';
import { scanUrls, summary } from '../scan/run.ts';
import { loadScans, report } from '../scan/report.ts';
import { extractCompany } from '../scan/extract.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const store = fileStore(process.env.CONVERSION_DATA_DIR ?? path.resolve(HERE, '../src/data'));
const SCANS = path.resolve(process.env.SCANS_DIR ?? path.resolve(HERE, '../scans'));
const EXTRACTS = path.resolve(process.env.EXTRACTS_DIR ?? path.resolve(HERE, '../extracts'));

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
      'Start here. Returns the funnel types (recipes) with when to use each, each section with its conversion role, hook/story/offer stage, job and layout variants, every token a brand must define, the contrast rules, the write rules and the checks only a designer can make. Read this before writing a brand.',
    inputSchema: {},
  },
  async () =>
    reply({
      recipes,
      recipeGuide,
      sections: Object.values(sections).map(({ id, name, role, stage, job, variants, referenceIds }) => ({ id, name, role, stage, job, variants, referenceIds })),
      tokens: tokenNames,
      contrastRules: contrastPairs,
      writeRules: [
        'Write the strategy first: dream customer, where they are, hook, the belief that stops them, offer, who it is not for.',
        'Then the Brunson pass (brand.pass, skill brunson-pass): hook, story and offer for every step from the ad to the result, at least two headlines to test, the doubt and the recipe section that answers it, the offer stack (confirmed or ask-client), questions for the client, and a written answer to every designer check by id. Real clients cannot build without it.',
        'Pick the recipe from the client goal and traffic using recipeGuide, not from the last client.',
        'Copy comes from the client. No invented numbers, results or quotes.',
        'A quote without a named source and written permission keeps "placeholder": true. So does a story the client has not approved, and a video not yet supplied.',
        'Multi-step recipes put the first question in the hero (layout.hero "question"). Answers are taps, at most 6 per question, at most 6 questions, contact details last and at most two of them.',
        'Choose layout variants that suit this brand. Do not copy the last client.',
      ],
      designerChecks,
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
  'scan_funnels',
  {
    description:
      'Scan 1 to 20 funnel pages with code, not AI: opens each in Chrome and saves one JSON file per page to scans/ with its tokens, assets and funnel structure (first ask, headline type, block sequence, forms, proof, tracking, builder). Pages behind a bot check come back "blocked" and are never bypassed. For hundreds of URLs, tell the user to run npm run scan -- urls.txt instead. Takes about 2 seconds a page.',
    inputSchema: {
      urls: z.array(z.url()).min(1).max(20),
      viewport: z.enum(['mobile', 'desktop']).optional().describe('Default mobile, 390px: most ad traffic is on phones.'),
    },
  },
  async ({ urls, viewport }) => {
    try {
      const scans = await scanUrls(urls, { outDir: SCANS, viewport: viewport ?? 'mobile', concurrency: 4 });
      return reply({
        ok: true,
        dir: SCANS,
        scans: scans.map(summary),
        next: [
          'Open http://127.0.0.1:4410/scans (npm run app) to see tokens, assets and blocks for each scan.',
          'Labels are heuristics from one page load. Check them against the screenshot before citing them.',
          'To keep a funnel as a pattern, inspect it yourself and save it with add_reference.',
        ],
      });
    } catch (error) {
      return refuse((error as Error).message);
    }
  },
);

server.registerTool(
  'extract_design_system',
  {
    description:
      "Extract a company's design system with code, not AI: visits their start page and up to 11 more pages, scrolls each so lazy images load, and writes extracts/<host>/design-system.json (tokens, fonts, logo, component variants with styles, HTML and cropped screenshots, inline icons), assets.json and assets.csv (every image, icon, logo, favicon, video, stream and font, with the pages it appears on). Files are downloaded only with download: true, which needs the company's permission. Takes 10 to 60 seconds.",
    inputSchema: {
      url: z.url().describe('The company site start page.'),
      pages: z.number().int().min(1).max(12).optional().describe('Pages to visit, default 6. One per kind of path, so templates differ.'),
      viewport: z.enum(['desktop', 'mobile']).optional(),
      download: z.boolean().optional().describe('Save the asset files too. Only with the company\'s permission.'),
    },
  },
  async ({ url, pages, viewport, download }) => {
    try {
      const host = new URL(url).host.replace(/^www\./, '');
      const outDir = path.join(EXTRACTS, host.replace(/[^a-z0-9.-]/gi, '-'));
      const { record } = await extractCompany(url, { outDir, pages: pages ?? 6, viewport: viewport ?? 'desktop', download: download ?? false });
      const kinds: Record<string, number> = {};
      for (const c of record.components) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
      return reply({
        ok: true,
        dir: outDir,
        pages: record.pages,
        logo: record.logo ? record.logo.kind : null,
        assets: record.assets,
        inline_icons: record.icons.length,
        component_variants: kinds,
        fonts: record.tokens.fonts,
        next: [
          'Read design-system.json for tokens and components, and assets.json or assets.csv for the asset list.',
          'Use the measured tokens with capture_brand evidence when drafting a brand file. Fonts and files belong to the company: ask before using them.',
        ],
      });
    } catch (error) {
      return refuse((error as Error).message);
    }
  },
);

server.registerTool(
  'scan_report',
  {
    description: 'Summarise every scan in scans/: how often each first ask, headline type, block, contact field, builder and tracking tag appears, plus common token values. Use it to find which blocks real funnels use.',
    inputSchema: {},
  },
  async () => reply(report(await loadScans(SCANS))),
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
    const check = validateBrand(brand, await otherBrands(id));
    const { ok, errors, warnings } = check;
    return reply({ ok, errors, warnings, launch: check.brand ? launchChecks(check.brand) : [] });
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
    return reply({ ok: true, file, warnings: check.warnings, launch: launchChecks(check.brand), review: [`/${id}/system`, `/${id}/`], designerChecks });
  },
);

await server.connect(new StdioServerTransport());
