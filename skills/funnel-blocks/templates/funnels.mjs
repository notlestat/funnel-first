// Funnel templates: each funnel type is a list of steps, and each step an
// ordered list of [blockType, slot]. A company's content file fills the slots
// (content[funnelId][stepId][slot] = props for that block). No copy lives here.
//
// Block order follows the 48-template study (references/funnels.md): hero first,
// FAQ second to last, the ask repeated at the end, one way out per step.

export const funnels = [
  {
    id: 'lead-magnet', name: 'Lead magnet', goal: 'Email for a free resource',
    steps: [
      { id: 'optin', name: 'Opt-in', blocks: [['brandbar', 'brandbar'], ['hero', 'hero'], ['benefits', 'benefits'], ['feature', 'feature'], ['quotes', 'quotes'], ['faq', 'faq'], ['cta', 'cta'], ['footer', 'footer']] },
      { id: 'thankyou', name: 'Thank you', blocks: [['brandbar', 'brandbar'], ['confirm', 'confirm'], ['benefits', 'next'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'appointment', name: 'Appointment', goal: 'A qualified booking',
    steps: [
      { id: 'landing', name: 'Landing + first question', blocks: [['brandbar', 'brandbar'], ['hero', 'hero'], ['trust', 'trust'], ['beforeafter', 'beforeafter'], ['benefits', 'benefits'], ['quotes', 'quotes'], ['bio', 'bio'], ['faq', 'faq'], ['cta', 'cta'], ['footer', 'footer']] },
      { id: 'contact', name: 'Last step: contact', blocks: [['brandbar', 'brandbar'], ['form', 'form'], ['trust', 'trust'], ['footer', 'footer']] },
      { id: 'book', name: 'Pick a time', blocks: [['brandbar', 'brandbar'], ['slots', 'slots'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'quiz', name: 'Quiz', goal: 'A personal result for contact details',
    steps: [
      { id: 'q1', name: 'Question 1', blocks: [['brandbar', 'brandbar'], ['question', 'question'], ['trust', 'trust'], ['footer', 'footer']] },
      { id: 'q3', name: 'Question 3 of 4', blocks: [['brandbar', 'brandbar'], ['question', 'question'], ['footer', 'footer']] },
      { id: 'result', name: 'Result', blocks: [['brandbar', 'brandbar'], ['result', 'result'], ['beforeafter', 'beforeafter'], ['quotes', 'quotes'], ['faq', 'faq'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'webinar', name: 'Live workshop', goal: 'Registration for a dated session',
    steps: [
      { id: 'register', name: 'Registration', blocks: [['brandbar', 'brandbar'], ['hero', 'hero'], ['benefits', 'benefits'], ['bio', 'bio'], ['faq', 'faq'], ['form', 'form'], ['footer', 'footer']] },
      { id: 'confirmed', name: 'Confirmed', blocks: [['brandbar', 'brandbar'], ['confirm', 'confirm'], ['video', 'video'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'vsl', name: 'Video sales letter', goal: 'A purchase or booking after a video',
    steps: [
      { id: 'video', name: 'Video page', blocks: [['brandbar', 'brandbar'], ['hero', 'hero'], ['benefits', 'benefits'], ['beforeafter', 'beforeafter'], ['quotes', 'quotes'], ['offer', 'offer'], ['guarantee', 'guarantee'], ['faq', 'faq'], ['cta', 'cta'], ['footer', 'footer']] },
      { id: 'checkout', name: 'Checkout', blocks: [['brandbar', 'brandbar'], ['checkout', 'checkout'], ['guarantee', 'guarantee'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'tripwire', name: 'Low-price offer', goal: 'A first small purchase, then an upgrade',
    steps: [
      { id: 'offer', name: 'Offer', blocks: [['announce', 'announce'], ['brandbar', 'brandbar'], ['hero', 'hero'], ['benefits', 'benefits'], ['quotes', 'quotes'], ['guarantee', 'guarantee'], ['faq', 'faq'], ['cta', 'cta'], ['footer', 'footer']] },
      { id: 'checkout', name: 'Checkout + bump', blocks: [['brandbar', 'brandbar'], ['checkout', 'checkout'], ['footer', 'footer']] },
      { id: 'upsell', name: 'Upsell', blocks: [['brandbar', 'brandbar'], ['upsell', 'upsell'], ['footer', 'footer']] },
      { id: 'thankyou', name: 'Thank you', blocks: [['brandbar', 'brandbar'], ['confirm', 'confirm'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'ecommerce', name: 'Product (gift voucher)', goal: 'A product sold online',
    steps: [
      { id: 'product', name: 'Product page', blocks: [['brandbar', 'brandbar'], ['voucher', 'voucher'], ['benefits', 'benefits'], ['quotes', 'quotes'], ['faq', 'faq'], ['footer', 'footer']] },
      { id: 'checkout', name: 'Checkout', blocks: [['brandbar', 'brandbar'], ['checkout', 'checkout'], ['footer', 'footer']] },
      { id: 'thankyou', name: 'Thank you', blocks: [['brandbar', 'brandbar'], ['confirm', 'confirm'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'application', name: 'Application (high-ticket)', goal: 'A qualified consultation for a big job',
    steps: [
      { id: 'landing', name: 'Landing', blocks: [['brandbar', 'brandbar'], ['hero', 'hero'], ['feature', 'feature'], ['feature', 'feature2'], ['steps', 'steps'], ['quotes', 'quotes'], ['faq', 'faq'], ['cta', 'cta'], ['footer', 'footer']] },
      { id: 'apply', name: 'Application', blocks: [['brandbar', 'brandbar'], ['apply', 'apply'], ['footer', 'footer']] },
      { id: 'book', name: 'Book the consultation', blocks: [['brandbar', 'brandbar'], ['slots', 'slots'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'membership', name: 'Membership plan', goal: 'A recurring plan',
    steps: [
      { id: 'plans', name: 'Plans', blocks: [['brandbar', 'brandbar'], ['hero', 'hero'], ['plans', 'plans'], ['steps', 'steps'], ['benefits', 'benefits'], ['faq', 'faq'], ['cta', 'cta'], ['footer', 'footer']] },
      { id: 'signup', name: 'Sign up', blocks: [['brandbar', 'brandbar'], ['checkout', 'checkout'], ['footer', 'footer']] },
      { id: 'welcome', name: 'Welcome', blocks: [['brandbar', 'brandbar'], ['confirm', 'confirm'], ['footer', 'footer']] },
    ],
  },
  {
    id: 'challenge', name: 'Challenge', goal: 'Sign-ups for a short free series',
    steps: [
      { id: 'register', name: 'Registration', blocks: [['brandbar', 'brandbar'], ['hero', 'hero'], ['steps', 'steps'], ['bio', 'bio'], ['faq', 'faq'], ['form', 'form'], ['footer', 'footer']] },
      { id: 'day', name: 'Day page', blocks: [['brandbar', 'brandbar'], ['days', 'days'], ['cta', 'cta'], ['footer', 'footer']] },
    ],
  },
];

// Fills a step from the company's content. A missing slot renders a visible
// notice, so a gap in the content is seen on the board, not hidden.
export function resolveStep(funnel, step, content) {
  const shared = content.shared || {};
  const own = content.funnels?.[funnel.id]?.[step.id] || {};
  return {
    ...step,
    blocks: step.blocks.map(([type, slot]) => {
      const props = own[slot] ?? shared[slot];
      if (props === undefined) return ['steplabel', { text: `Missing content: ${funnel.id}.${step.id}.${slot}` }];
      return [type, props];
    }),
  };
}
