// The section registry: what each section is for, its layout variants, and which
// references it was built from. Humans add sections and variants. Agents choose between them.
export const conversionRoles = ['attention', 'value', 'trust', 'objection', 'commitment'] as const;
export type ConversionRole = (typeof conversionRoles)[number];

export type SectionId = 'hero' | 'benefits' | 'proof' | 'faq' | 'capture';

export interface SectionSpec {
  id: SectionId;
  name: string;
  role: ConversionRole;
  job: string;
  variants: readonly string[];
  referenceIds: string[];
}

export const variants = {
  hero: ['stacked', 'split'],
  benefits: ['cards', 'list'],
} as const;

export const sections: Record<SectionId, SectionSpec> = {
  hero: { id: 'hero', name: 'Hero', role: 'attention', job: 'Say what the visitor gets and give one clear next step.', variants: variants.hero, referenceIds: [] },
  benefits: { id: 'benefits', name: 'Benefits', role: 'value', job: 'Show what is inside and who it is for.', variants: variants.benefits, referenceIds: [] },
  proof: { id: 'proof', name: 'Proof', role: 'trust', job: 'Real quotes with named sources. Placeholders stay visible until supplied.', variants: [], referenceIds: [] },
  faq: { id: 'faq', name: 'FAQ', role: 'objection', job: 'Answer the doubts that stop someone signing up.', variants: [], referenceIds: [] },
  capture: { id: 'capture', name: 'Capture', role: 'commitment', job: 'Ask only for what is needed. Consent is separate and optional.', variants: [], referenceIds: [] },
};

export const recipes = {
  'lead-magnet': ['hero', 'benefits', 'proof', 'faq', 'capture'],
} as const satisfies Record<string, readonly SectionId[]>;
