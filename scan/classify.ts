// Turns the raw facts from read.ts into funnel labels. Pure functions, no browser,
// so every rule here has a unit test. These are heuristics: each label says what it saw.
import type { RawFunnel } from './read.ts';

export type HeadlineType = 'question' | 'named-doubt' | 'result' | 'curiosity' | 'plain';
export type FirstAsk = 'question' | 'form' | 'video' | 'button' | 'none';
export type BlockKind =
  | 'nav' | 'hero' | 'question' | 'capture' | 'video' | 'proof' | 'logo-strip' | 'faq' | 'offer'
  | 'agenda' | 'story' | 'benefits' | 'cta' | 'footer' | 'content';

// Brunson: curiosity beats clarity on a landing page. These buckets let a scan count which headline types funnels use.
export function headlineType(text: string): HeadlineType {
  const t = text.trim();
  if (!t) return 'plain';
  if (t.endsWith('?')) return 'question';
  if (/\b(despite|even if|even though|without|no matter|trotz|ohne)\b/i.test(t)) return 'named-doubt';
  if (/\d|[$£€%]/.test(t)) return 'result';
  if (/^(how|why|what|discover|find out|the (secret|truth|one)|this|learn)\b|\breveals?\b|\bsecret\b|\bnobody\b/i.test(t)) return 'curiosity';
  return 'plain';
}

export function firstAsk(screen: RawFunnel['first_screen']): { ask: FirstAsk; evidence: string } {
  if (screen.choices >= 2 || (screen.option_buttons >= 2 && screen.text_inputs === 0 && screen.question_text)) {
    return { ask: 'question', evidence: screen.question_text ? `question "${screen.question_text}" with tap answers` : `${Math.max(screen.choices, screen.option_buttons)} tap answers in the first screen` };
  }
  if (screen.text_inputs > 0) return { ask: 'form', evidence: `${screen.text_inputs} text field(s) in the first screen` };
  if (screen.video > 0) return { ask: 'video', evidence: 'video in the first screen' };
  if (screen.ctas > 0) return { ask: 'button', evidence: `${screen.ctas} button(s) in the first screen` };
  return { ask: 'none', evidence: 'no ask in the first screen' };
}

type RawBlock = RawFunnel['blocks'][number];

export function blockKind(b: RawBlock, index: number, total: number): { kind: BlockKind; signals: string[] } {
  const s: string[] = [];
  const h = b.heading.toLowerCase();
  const textInputs = b.inputs.filter((t) => /^(text|email|tel|number|textarea|select|url|date)$/.test(t));
  if (b.tag === 'nav' || (index === 0 && b.height < 140 && !b.heading_tag?.startsWith('h1') && b.chars < 400)) return { kind: 'nav', signals: ['top bar'] };
  if (b.tag === 'footer' || (index >= total - 2 && b.legal)) return { kind: 'footer', signals: ['legal links'] };
  if (textInputs.length) s.push(`${textInputs.length} field(s)`);
  if (b.choices >= 2) s.push(`${b.choices} tap answers`);
  if (b.video) s.push('video');
  if (b.quotes) s.push(`${b.quotes} quote(s)`);
  if (b.rating) s.push(`rating "${b.rating}"`);
  if (b.small_images >= 4) s.push(`${b.small_images} small images`);
  if (b.details >= 2) s.push(`${b.details} expanders`);
  if (b.price) s.push('price');
  if (b.date) s.push('date or time');

  const isFirstContent = index <= 1 && (b.heading_tag === 'h1' || b.top < 200);
  if (b.choices >= 2 && !textInputs.length) return { kind: isFirstContent ? 'hero' : 'question', signals: [...s, isFirstContent ? 'question in the hero' : 'question step'] };
  if (isFirstContent) return { kind: 'hero', signals: [...s, 'first block'] };
  if (textInputs.length) return { kind: 'capture', signals: s };
  if (b.video) return { kind: 'video', signals: s };
  if (b.details >= 2 || /\b(faq|frequently|questions|fragen)\b/.test(h)) return { kind: 'faq', signals: s };
  if (b.quotes || b.rating || /testimonial|review|what .* say|wall of love|success stor|case stud|bewertung|kunden/.test(h)) return { kind: 'proof', signals: s };
  if (b.small_images >= 4 && b.chars < 300) return { kind: 'logo-strip', signals: s };
  if (b.date && (b.list_items >= 2 || /agenda|webinar|masterclass|workshop|live|session/.test(h))) return { kind: 'agenda', signals: s };
  if (b.price || /everything you get|bonus|included|pricing|special offer|your offer|choose (a|your) plan|plans? (and|&) pricing/.test(h)) return { kind: 'offer', signals: s };
  if (/about|who (are|is) we|our story|founder|why we|meet|mission|über uns/.test(h) || b.paragraphs >= 3) return { kind: 'story', signals: [...s, b.paragraphs >= 3 ? `${b.paragraphs} long paragraphs` : 'about heading'] };
  if (b.list_items >= 3 || b.h3s >= 3) return { kind: 'benefits', signals: [...s, `${Math.max(b.list_items, b.h3s)} items`] };
  if (b.ctas >= 1 && b.chars < 500) return { kind: 'cta', signals: [...s, 'short block with a button'] };
  return { kind: 'content', signals: s };
}

const builderSignals: [string, RegExp][] = [
  ['perspective', /perspectivefunnel|perspective\.imgix|perspective\.co/],
  ['clickfunnels', /clickfunnels|myclickfunnels|cf-builder|cfcdn/],
  ['gohighlevel', /leadconnectorhq|msgsndr|highlevel|gohighlevel/],
  ['unbounce', /unbounce|ubembed|ub-emb/],
  ['leadpages', /leadpages|lpages/],
  ['instapage', /instapage/],
  ['systeme.io', /systeme\.io/],
  ['kajabi', /kajabi/],
  ['webflow', /webflow|data-wf-/],
  ['framer', /framer(usercontent)?\.(com|app|website)|data-framer/],
  ['wix', /wix(static)?\.com|_wix/],
  ['squarespace', /squarespace/],
  ['shopify', /cdn\.shopify|shopify/],
  ['hubspot', /hs-scripts|hubspot|hsforms/],
  ['elementor', /elementor/],
  ['wordpress', /wp-content|wp-includes|wordpress/],
  ['carrd', /carrd\.co/],
  ['astro', /astro/],
  ['next.js', /_next\/static/],
];

export function builder(stack: RawFunnel['stack']): string[] {
  const haystack = [
    stack.markers.generator ?? '',
    stack.markers.html_class,
    stack.markers.data_attrs.join(' '),
    stack.markers.link_hosts.join(' '),
    stack.script_srcs.join(' '),
  ].join(' ').toLowerCase();
  return builderSignals.filter(([, re]) => re.test(haystack)).map(([name]) => name);
}

const trackingSignals: [string, RegExp, keyof RawFunnel['stack']['inline'] | null][] = [
  ['meta-pixel', /connect\.facebook\.net\/.*fbevents/, 'fbq'],
  ['google-tag-manager', /googletagmanager\.com\/gtm\.js/, 'gtm'],
  ['google-analytics', /googletagmanager\.com\/gtag|google-analytics\.com/, 'gtag'],
  ['tiktok-pixel', /analytics\.tiktok\.com/, 'ttq'],
  ['hotjar', /static\.hotjar\.com/, 'hotjar'],
  ['microsoft-clarity', /clarity\.ms/, 'clarity'],
  ['linkedin-insight', /snap\.licdn\.com/, 'linkedin'],
  ['segment', /cdn\.segment\.com/, 'segment'],
  ['snap-pixel', /sc-static\.net\/scevent/, 'snap'],
  ['pinterest-tag', /s\.pinimg\.com\/ct/, 'pinterest'],
];

export function tracking(stack: RawFunnel['stack']): string[] {
  const srcs = stack.script_srcs.join(' ');
  return trackingSignals.filter(([, re, flag]) => re.test(srcs) || (flag && stack.inline[flag])).map(([name]) => name);
}

// How many calls to action point at the same ask: the same label, or the same in-page target.
export function ctaRepeats(ctas: RawFunnel['ctas']): number {
  const counts = new Map<string, number>();
  for (const c of ctas) {
    const key = c.href?.startsWith('#') ? c.href : c.text.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

const blockedRe = /just a moment|attention required|verify you are human|performing security verification|checking your browser|captcha|access denied|request blocked/i;

// Bot checks are recorded, never bypassed.
export function blockedReason(title: string, bodyText: string): string | null {
  const hit = `${title}\n${bodyText.slice(0, 2000)}`.match(blockedRe);
  return hit ? `bot check: "${hit[0]}"` : null;
}
