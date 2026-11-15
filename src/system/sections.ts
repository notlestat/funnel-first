// The section registry: what each section is for, its layout variants, which part of
// hook → story → offer it plays, and which references it was built from.
// Humans add sections and variants. Agents choose between them.
export const conversionRoles = ['attention', 'qualification', 'value', 'persuasion', 'trust', 'objection', 'commitment'] as const;
export type ConversionRole = (typeof conversionRoles)[number];

// Brunson's diagnostic: when a funnel step fails, it is the hook, the story or the offer.
export type Stage = 'hook' | 'story' | 'offer';

export type SectionId = 'hero' | 'flow' | 'video' | 'benefits' | 'offer' | 'story' | 'proof' | 'agenda' | 'faq' | 'capture' | 'cta';

export interface SectionSpec {
  id: SectionId;
  name: string;
  role: ConversionRole;
  stage: Stage;
  job: string;
  variants: readonly string[];
  referenceIds: string[];
}

export const variants = {
  // "question" puts the first question of the flow in the hero instead of a button.
  hero: ['stacked', 'split', 'question'],
  benefits: ['cards', 'list'],
  offer: ['list', 'cards'],
} as const;

export const sections: Record<SectionId, SectionSpec> = {
  hero: {
    id: 'hero', name: 'Hero', role: 'attention', stage: 'hook',
    job: 'Stop the scroll: a result, a curiosity gap or the visitor\'s own doubt, and one clear next step.',
    variants: variants.hero, referenceIds: [],
  },
  flow: {
    id: 'flow', name: 'Question flow', role: 'qualification', stage: 'offer',
    job: 'One tap-to-answer question per screen, progress shown, contact details last. Qualifies before it asks.',
    variants: [], referenceIds: [],
  },
  video: {
    id: 'video', name: 'Video', role: 'persuasion', stage: 'story',
    job: 'The one-to-many presentation: break the belief that stops them buying. Captioned, with the next step right under it.',
    variants: [], referenceIds: [],
  },
  benefits: {
    id: 'benefits', name: 'Benefits', role: 'value', stage: 'offer',
    job: 'Show what is inside and who it is for.',
    variants: variants.benefits, referenceIds: [],
  },
  offer: {
    id: 'offer', name: 'Offer stack', role: 'value', stage: 'offer',
    job: 'Everything they get, each item solving the problem the last one creates, until it is a complete solution.',
    variants: variants.offer, referenceIds: [],
  },
  story: {
    id: 'story', name: 'Story', role: 'trust', stage: 'story',
    job: 'Who is behind this and why they can make the promise. Signed by a real person.',
    variants: [], referenceIds: [],
  },
  proof: {
    id: 'proof', name: 'Proof', role: 'trust', stage: 'story',
    job: 'Real quotes with named sources. Placeholders stay visible until supplied.',
    variants: [], referenceIds: [],
  },
  agenda: {
    id: 'agenda', name: 'Agenda', role: 'value', stage: 'offer',
    job: 'When it is and what they will leave with.',
    variants: [], referenceIds: [],
  },
  faq: {
    id: 'faq', name: 'FAQ', role: 'objection', stage: 'story',
    job: 'Answer the doubts that stop someone signing up.',
    variants: [], referenceIds: [],
  },
  capture: {
    id: 'capture', name: 'Capture', role: 'commitment', stage: 'offer',
    job: 'Ask only for what is needed. Consent is separate and optional.',
    variants: [], referenceIds: [],
  },
  cta: {
    id: 'cta', name: 'Closing call to action', role: 'commitment', stage: 'offer',
    job: 'Repeat the ask for people who needed the whole page first.',
    variants: [], referenceIds: [],
  },
};

// Section order per funnel type. The build renders sections in exactly this order.
export const recipes = {
  'lead-magnet': ['hero', 'benefits', 'proof', 'faq', 'capture'],
  appointment: ['hero', 'flow', 'benefits', 'proof', 'story', 'faq', 'cta'],
  quiz: ['hero', 'flow', 'benefits', 'story', 'proof', 'cta'],
  vsl: ['hero', 'video', 'capture', 'offer', 'proof', 'faq'],
  webinar: ['hero', 'agenda', 'proof', 'faq', 'capture'],
} as const satisfies Record<string, readonly SectionId[]>;

export type RecipeId = keyof typeof recipes;

// When to use each funnel type. Agents read this through system_overview.
export const recipeGuide: Record<RecipeId, { goal: string; firstAsk: string; when: string }> = {
  'lead-magnet': {
    goal: 'Email address in exchange for a free resource.',
    firstAsk: 'A button that jumps to a one-field form.',
    when: 'Warm traffic, a clear free resource, and a plan to follow up by email.',
  },
  appointment: {
    goal: 'A qualified call or visit booked.',
    firstAsk: 'A one-tap question in the hero.',
    when: 'High-value services where lead quality matters more than volume: budget, role and fit questions filter before the call.',
  },
  quiz: {
    goal: 'A personal result in exchange for contact details.',
    firstAsk: 'A one-tap question in the hero.',
    when: 'Cold social traffic, a problem people want diagnosed, and answers that can segment follow-up.',
  },
  vsl: {
    goal: 'A booked call or sign-up after a video presentation.',
    firstAsk: 'Watch the video, then a short form under it.',
    when: 'The buyer holds a belief that stops them, and a 2 to 20 minute video can break it.',
  },
  webinar: {
    goal: 'Registration for a dated live session.',
    firstAsk: 'A button that names the date and time.',
    when: 'A one-to-many presentation will do the selling, and a fixed date gives a reason to act now.',
  },
};

export const usesFlow = (recipe: RecipeId) => (recipes[recipe] as readonly SectionId[]).includes('flow');
