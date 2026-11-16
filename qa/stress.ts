import { brandSchema, type Brand } from '../src/system/schema.ts';

export interface StressCase { id: string; brand: Brand | null; notes: string[] }
const button = 'Review your next step today!'; // Exactly 28 characters.

function repeat<T>(items: T[], count: number): T[] {
  return Array.from({ length: count }, (_, i) => structuredClone(items[i % items.length]));
}

export function stressCases(input: Brand, portraitSrc: string): StressCase[] {
  const cases: StressCase[] = [];
  const add = (id: string, mutate: (brand: Brand, notes: string[]) => void) => {
    const draft = structuredClone(input);
    const notes: string[] = [];
    mutate(draft, notes);
    const parsed = brandSchema.safeParse(draft);
    cases.push({ id, brand: parsed.success ? parsed.data : null, notes: parsed.success ? notes : [...notes, ...parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)] });
  };
  add('headline-short', b => { if (b.content.hero) b.content.hero.headline = 'Find your answer'; });
  add('headline-long', b => { if (b.content.hero) b.content.hero.headline = 'Find the answer to your biggest question and discover a clearer way to take action today'; });
  add('body-doubled', b => {
    const double = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(double);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).map(([key, v]) => [key,
        ['body', 'subhead', 'a', 'quote', 'consent', 'filter'].includes(key) && typeof v === 'string' ? `${v} ${v}` :
        key === 'paragraphs' && Array.isArray(v) ? v.map(p => `${p} ${p}`) : double(v),
      ]));
    };
    b.content = brandSchema.shape.content.parse(double(b.content));
  });
  add('optional-images-missing', b => {
    delete b.logo;
    if (b.content.hero) delete b.content.hero.image;
    if (b.content.proof) delete b.content.proof.pairs;
  });
  add('portrait-image', b => {
    const image = { src: portraitSrc, alt: 'QA portrait fixture, 600 by 1200 pixels', width: 600, height: 1200 };
    b.logo = image;
    if (b.content.hero) b.content.hero.image = image;
    if (b.content.proof) b.content.proof.pairs = [{ before: image, after: image, caption: 'QA portrait fixture', placeholder: true }];
  });
  const counts = (b: Brand, max: boolean, notes: string[]) => {
    const c = b.content;
    if (c.benefits) c.benefits.items = repeat(c.benefits.items, max ? 4 : 2);
    if (c.offer) c.offer.items = repeat(c.offer.items, max ? 8 : 2);
    if (c.agenda) c.agenda.items = repeat(c.agenda.items, max ? 6 : 2);
    if (c.story) c.story.paragraphs = repeat(c.story.paragraphs, max ? 6 : 1);
    if (c.proof) {
      if (max && c.proof.quotes.length) c.proof.quotes = repeat(c.proof.quotes, 12);
      else if (!max) c.proof.quotes = [];
      if (c.proof.pairs?.length) c.proof.pairs = repeat(c.proof.pairs, max ? 3 : 0);
      if (max) notes.push('Testimonials have no schema maximum. Exercised 12 when a source quote exists; no quote invented for an empty list.');
    }
    if (c.faq) {
      c.faq.items = repeat(c.faq.items, max ? 12 : 2);
      if (max) notes.push('FAQ has no schema maximum. Exercised 12 items.');
    }
    if (c.flow) {
      c.flow.questions = repeat(c.flow.questions, max ? 6 : 1);
      for (const q of c.flow.questions) q.options = repeat(q.options, max ? 6 : 2);
      c.flow.contact.fields = max ? ['name', 'email'] : ['email'];
    }
  };
  add('lists-maximum', (b, notes) => counts(b, true, notes));
  add('lists-minimum', (b, notes) => counts(b, false, notes));
  add('button-long', b => {
    if (b.content.hero?.cta) b.content.hero.cta = button;
    if (b.content.capture) b.content.capture.button = button;
    if (b.content.cta) b.content.cta.button = button;
    if (b.content.video) b.content.video.cta = button;
    if (b.content.flow) {
      b.content.flow.contact.button = button;
      if (b.content.flow.note) b.content.flow.note.button = button;
    }
  });
  add('brand-name-long', b => {
    b.name = 'The exceptionally long international collective for thoughtful practical progress and better everyday decisions';
    if (b.logo) b.logo.alt = b.name;
  });
  return cases;
}
