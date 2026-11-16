// One schema for every consumer: Astro's content collections, the MCP server and the tests.
import { z } from 'zod';
import { tokenNames, type TokenName } from './tokens.ts';
import { recipes, usesFlow, variants, type RecipeId, type SectionId } from './sections.ts';
import { designerCheckIds } from './rules.ts';

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

// A token value is dropped into a style attribute, so it must not be able to close the declaration.
const tokenValue = z.string().min(1).regex(/^[^;{}<>]+$/, 'needs a plain CSS value');
const tokensSchema = z.object(
  Object.fromEntries(tokenNames.map((name) => [name, tokenValue])) as Record<TokenName, typeof tokenValue>,
);

const recipeIds = Object.keys(recipes) as [RecipeId, ...RecipeId[]];

// The client's own images, copied into public/brands/<client>/ with their permission.
// Local files only, so the page never hotlinks another site. Width and height reserve
// the space before the file loads, so the page does not jump. Alt may be empty only
// for a purely decorative image; the build checks the file exists.
const image = z.object({
  src: z.string().regex(/^\/brands\/[a-z0-9-]+\/[\w.-]+\.(webp|avif|jpe?g|png|svg)$/, 'use a local file: /brands/<client>/<name>.webp'),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const describedImage = image.extend({ alt: z.string().min(1, 'describe what the image shows') });
export type BrandImage = z.infer<typeof image>;

// ---- Section content. Each is optional here; the recipe decides which are required. ----

const heroContent = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  subhead: z.string(),
  // Not used by the "question" variant, where the first question replaces the button.
  cta: z.string().optional(),
  // Sits behind the eyebrow, headline and subhead under a fixed dark scrim. The ask stays below it.
  image: image.optional(),
});

const option = z.object({ label: z.string().min(1).max(60), hint: z.string().max(80).optional() });
const question = z.object({
  q: z.string().min(1),
  // Single-choice questions advance on tap. Multi-choice adds a Continue button.
  multi: z.boolean().default(false),
  options: z.array(option).min(2, 'a question needs at least 2 answers').max(6, 'more than 6 answers is a menu, not a question'),
});
export const contactFields = ['name', 'email', 'phone'] as const;

const flowContent = z.object({
  questions: z.array(question).min(1).max(6, 'more than 6 questions before contact loses people; split the funnel'),
  // An optional authority screen shown after the first question, such as a short expert note.
  note: z.object({ heading: z.string(), body: z.string(), button: z.string() }).optional(),
  contact: z.object({
    heading: z.string(),
    body: z.string(),
    fields: z
      .array(z.enum(contactFields))
      .min(1)
      .max(2, 'ask for at most two contact details')
      .refine((f) => f.includes('email') || f.includes('phone'), 'include email or phone')
      .refine((f) => new Set(f).size === f.length, 'list each field once'),
    button: z.string(),
    consent: z.string(),
    // Brunson's "who this is not for": pushes unserious visitors away before they book.
    filter: z.string().optional(),
  }),
  // What the visitor is told comes next. The demo never claims it happened.
  after: z.enum(['booking', 'result', 'thanks']),
});

const videoContent = z.object({
  heading: z.string().optional(),
  // Embeds come only from these hosts, in their privacy-friendly form.
  src: z
    .url()
    .refine((u) => /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/.test(u), 'use a youtube-nocookie.com/embed or player.vimeo.com/video URL')
    .optional(),
  title: z.string(),
  captions: z.boolean(),
  placeholder: z.boolean(),
  cta: z.string(),
});

const listContent = z.object({
  heading: z.string(),
  items: z.array(z.object({ title: z.string(), body: z.string() })).min(2).max(4),
});

const offerContent = z.object({
  heading: z.string(),
  // Values are written by the client. The system never invents a price or a "worth".
  items: z.array(z.object({ title: z.string(), body: z.string(), value: z.string().optional() })).min(2).max(8),
  note: z.string().optional(),
});

const storyContent = z.object({
  heading: z.string(),
  paragraphs: z.array(z.string()).min(1).max(6),
  signed: z.object({ name: z.string(), role: z.string() }),
  // A story not yet written or approved by the client stays marked.
  placeholder: z.boolean(),
});

const proofContent = z.object({
  heading: z.string(),
  // A quote without a named, permitted source must be marked as a placeholder.
  quotes: z.array(z.object({ quote: z.string(), source: z.string(), placeholder: z.boolean() })),
  // Before and after photos of the client's own work, side by side. Not a slider: no motion.
  // A pair the client has not confirmed as their own work stays a placeholder.
  pairs: z
    .array(z.object({ before: describedImage, after: describedImage, caption: z.string().min(1), placeholder: z.boolean() }))
    .max(3, 'three before/after pairs at most; pick the strongest')
    .optional(),
});

const agendaContent = z.object({
  heading: z.string(),
  when: z.string().min(1),
  items: z.array(z.string()).min(2).max(6),
});

const faqContent = z.object({ heading: z.string(), items: z.array(z.object({ q: z.string(), a: z.string() })).min(2) });
const captureContent = z.object({ heading: z.string(), body: z.string(), button: z.string(), consent: z.string() });
const ctaContent = z.object({ heading: z.string(), body: z.string().optional(), button: z.string() });

// The thinking behind the funnel, from Brunson's seven steps. Shown on the system sheet.
const strategySchema = z.object({
  dream_customer: z.string().min(1),
  where_they_are: z.string().min(1),
  hook: z.string().min(1),
  false_belief: z.string().min(1),
  offer: z.string().min(1),
  not_for: z.string().min(1),
  second_yes: z.string().optional(),
});

// The Brunson pass: the judgement work the build cannot do, written down so it can be reviewed.
// Required for real clients. See skills/brunson-pass/SKILL.md.
const passSchema = z.object({
  // Hook, story and offer for every step, from the ad to the result. When a step fails, one of the three is wrong.
  steps: z
    .array(z.object({ step: z.string().min(1), hook: z.string().min(1), story: z.string().min(1), offer: z.string().min(1) }))
    .min(3, 'cover at least the ad, the first screen and the contact step'),
  // Brunson: if visitors already know what they get, opt-ins fall. Two or more headlines to test.
  headline_options: z.array(z.string().min(1)).min(2, 'write at least two headlines to test'),
  // The belief that stops them, how the page answers it, and the section where it is answered.
  doubt: z.object({ belief: z.string().min(1), answer: z.string().min(1), where: z.string().min(1) }),
  // The first yes: everything they get. Items the client has not confirmed stay "ask-client".
  offer_stack: z.array(z.object({ item: z.string().min(1), status: z.enum(['confirmed', 'ask-client']) })).min(1),
  client_questions: z.array(z.string().min(1)),
  // A written answer to every designer check, by id.
  checks: z.record(z.string(), z.string().min(1)),
});

export const brandSchema = z
  .object({
    name: z.string(),
    fictional: z.boolean(),
    fontsHref: z.url().optional(),
    // Shown small at the top of the hero. Never a link: the page has one way forward.
    logo: describedImage.optional(),
    tokens: tokensSchema,
    recipe: z.enum(recipeIds),
    strategy: strategySchema.optional(),
    pass: passSchema.optional(),
    // Layout variants are how two clients on the same recipe get different pages.
    layout: z.object({
      hero: z.enum(variants.hero).optional(),
      benefits: z.enum(variants.benefits).optional(),
      offer: z.enum(variants.offer).optional(),
    }),
    seo: z.object({ title: z.string(), description: z.string().max(160) }),
    content: z.object({
      hero: heroContent.optional(),
      flow: flowContent.optional(),
      video: videoContent.optional(),
      benefits: listContent.optional(),
      offer: offerContent.optional(),
      story: storyContent.optional(),
      proof: proofContent.optional(),
      agenda: agendaContent.optional(),
      faq: faqContent.optional(),
      capture: captureContent.optional(),
      cta: ctaContent.optional(),
    }),
  })
  .superRefine((brand, ctx) => {
    const used = recipes[brand.recipe] as readonly SectionId[];
    const content = brand.content as Record<string, unknown>;
    const layout = brand.layout as Record<string, string | undefined>;
    for (const id of used) {
      if (!content[id]) ctx.addIssue({ code: 'custom', path: ['content', id], message: `the ${brand.recipe} recipe needs a ${id} section` });
      if (id in variants && !layout[id]) ctx.addIssue({ code: 'custom', path: ['layout', id], message: `choose a ${id} variant: ${variants[id as keyof typeof variants].join(', ')}` });
    }
    // Multi-step funnels put the first question in the hero; single pages never do.
    const question = brand.layout.hero === 'question';
    if (usesFlow(brand.recipe) && !question) ctx.addIssue({ code: 'custom', path: ['layout', 'hero'], message: `the ${brand.recipe} recipe puts the first question in the hero: use "question"` });
    if (!usesFlow(brand.recipe) && question) ctx.addIssue({ code: 'custom', path: ['layout', 'hero'], message: '"question" needs a recipe with a question flow' });
    if (!question && content.hero && !brand.content.hero?.cta) ctx.addIssue({ code: 'custom', path: ['content', 'hero', 'cta'], message: 'the hero needs a button label' });
    // Every real client funnel carries a strategy and a Brunson pass. Fictional samples may skip them.
    if (!brand.fictional && !brand.strategy) ctx.addIssue({ code: 'custom', path: ['strategy'], message: 'real client funnels need a strategy' });
    if (!brand.fictional && !brand.pass) ctx.addIssue({ code: 'custom', path: ['pass'], message: 'real client funnels need a Brunson pass (skills/brunson-pass/SKILL.md)' });
    if (brand.pass) {
      if (!used.includes(brand.pass.doubt.where as SectionId)) {
        ctx.addIssue({ code: 'custom', path: ['pass', 'doubt', 'where'], message: `the doubt must be answered in a section of this recipe: ${used.join(', ')}` });
      }
      for (const id of designerCheckIds) {
        if (!brand.pass.checks[id]) ctx.addIssue({ code: 'custom', path: ['pass', 'checks', id], message: `answer the designer check "${id}"` });
      }
    }
    const video = brand.content.video;
    if (video && !video.placeholder && !video.src) ctx.addIssue({ code: 'custom', path: ['content', 'video', 'src'], message: 'a real video needs a src; otherwise mark it placeholder' });
    if (video && !video.placeholder && !video.captions) ctx.addIssue({ code: 'custom', path: ['content', 'video', 'captions'], message: 'videos must have captions' });
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
export type BrandContent = Brand['content'];
export type Reference = z.infer<typeof referenceSchema>;
