// The measurement contract: every event a funnel page can send, and what each one carries.
// Sections call track(). Nothing else decides what leaves the page.
// Privacy: no answer text and no contact details. Steps travel as numbers. See docs/measurement/plan.md.

export const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type UtmKey = (typeof utmKeys)[number];
export type Utm = Partial<Record<UtmKey, string>>;

// Pages hand these over as data-* strings, so they come with guards that check the string.
export const ctaLocations = ['hero', 'video', 'cta'] as const;
export type CtaLocation = (typeof ctaLocations)[number];
export const isCtaLocation = (value: unknown): value is CtaLocation => ctaLocations.some((l) => l === value);

export const stepKinds = ['question', 'note', 'contact'] as const;
export type StepKind = (typeof stepKinds)[number];
export const isStepKind = (value: unknown): value is StepKind => stepKinds.some((k) => k === value);

export interface FunnelEvents {
  funnel_viewed: Record<string, never>;
  cta_clicked: { location: CtaLocation };
  // step is the 1-based position in the whole flow, notes and the contact step included.
  flow_step_reached: { step: number; kind: StepKind };
  // No backend yet, so a form that passes validation is an attempt, never a delivered lead.
  capture_attempted: { form: 'flow' | 'capture'; delivered: false };
  flow_back: { from: number };
}
export type EventName = keyof FunnelEvents;

// What leaves the page: the event's own properties plus the brand, the recipe and any UTMs.
export interface SentEvent {
  name: EventName;
  props: Record<string, string | number | boolean>;
}

declare global {
  interface Window {
    __funnelEvents?: SentEvent[];
  }
}

const maxUtmLength = 100;

// Reads the five UTM keys from a query string. Everything else in the URL is ignored,
// and values are trimmed and capped, because anyone can put anything in a link.
export function readUtm(search: string): Utm {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of utmKeys) {
    const value = params.get(key)?.trim().slice(0, maxUtmLength);
    if (value) utm[key] = value;
  }
  return utm;
}

export function track<E extends EventName>(name: E, props: FunnelEvents[E]): void {
  // The funnel page marks <main> with its brand and recipe. Other pages, like the system sheet, send nothing.
  const main = document.querySelector<HTMLElement>('[data-funnel-brand]');
  if (!main) return;
  const { funnelBrand = '', funnelRecipe = '' } = main.dataset;
  // A funnel is one page, so the UTMs are still in the address bar. Nothing is stored in the browser.
  const event: SentEvent = { name, props: { ...props, ...readUtm(location.search), brand: funnelBrand, recipe: funnelRecipe } };
  (window.__funnelEvents ??= []).push(event);
}
