# Block catalogue

21 blocks, in the order a visitor meets them. Each entry gives the block's job, its Brunson stage, its anatomy, the rules that keep it honest, how often the study found it, and where it lives in the conversion system.

Frequencies are the share of pages of that step type with the block (49 front pages, meaning opt-in and sales steps, plus 22 checkouts, 8 upsells and 46 thank-you pages; `references/evidence.md` explains how blocks were labelled). They describe templates, not results.

Class names refer to `kit/blocks.css`. Every block sits in `section.fb-band` → `.fb-container`.

## Hook: the first screen

### 1. Announcement bar
`fb-announce` · hook · optional

One line above everything: a real deadline or a shipping promise, with the key words in `<strong>`.

- Rare in the study (seen on product pages). Use only for a fact that changes the decision.
- **Conversion system:** not in system.

### 2. Brand bar
`fb-brandbar` · hook · on almost every step

Logo centred, nothing else. `is-split` puts the logo at the start and one secondary button ("Make a call") at the end.

- The study headers had zero navigation links. A funnel step has one way out.
- **Conversion system:** part of the page layout, not a section.

### 3. Hero
`fb-hero` · hook · 100% of front pages

Shared anatomy, top to bottom:

1. Eyebrow: a pill (`fb-eyebrow`) or coloured text (`is-plain`) naming who it is for or the format ("Free 5-day workshop"). Found above the headline on 14% of heroes. It does more work than that number suggests: it carries the audience filter.
2. Headline (`fb-hero__title`, `--size-hero`). One phrase gets emphasis: `fb-accent-word` (colour) or `fb-mark` (highlighter strip). Nearly every hero in the contact sheets does one or the other.
3. Lede: one or two sentences, muted.
4. Checklist (`fb-checklist`): three outcomes with check icons. 31% of heroes.
5. The ask: a button with a second line for price or reassurance (`fb-button__sub`), or the form itself.
6. Microcopy under the button: "No card needed", "No experience required".

Five variants:

| Variant | Markup | When | Study |
|---|---|---|---|
| Stacked | `fb-stack is-center` | One clear offer, short copy. Centred is the default: 61% of heroes. | 61% centred |
| Split with form | `fb-split is-copy-wide` + `fb-formcard` | Opt-ins where the ask should be on screen one. On phones the form follows the copy. | 20% of front pages |
| Photo | `fb-band is-photo` + overlay | A service you can photograph: cleaning, dental, fitness, property. | 55% of all first sections |
| Video | `fb-video` under the headline | VSL and webinar replays. The button sits straight under the video. | 18% of front pages |
| Event | `fb-chips` + `fb-countdown` | A dated webinar or workshop. Chips for date and time, the countdown, a button naming the session. | 9% of heroes |

- **Conversion system:** `hero`. `stacked` and `split` exist. `question` puts the first quiz question in the hero, which the templates never did. Photo, video and event are **not in system** as variants.

### 4. Form card
`fb-formcard` · offer · 31% of front pages as a section, 20% in the hero

The opt-in. A dark or accent card, a title that names the result ("Get my written estimate"), two or three fields, a full-width button, a privacy line. `is-light` for light bands.

- Two fields is the most common pop-up form (16 of 26 pop-ups). Name and email, or email and phone.
- Most front pages repeat the form or a CTA band as their last block (34 of 49).
- Labels stay visible above fields. Placeholders are not labels.
- **Conversion system:** `capture` (single pages) and `flow` (multi-step). The contact step allows at most two details.

### 5. Countdown
`fb-countdown` · offer · 14% of front pages, usually webinars and launch offers

Three or four boxes (days, hours, minutes, seconds), tabular digits over small uppercase labels. Inside an offer card it reads "Offer ends in".

- Only for a real, fixed deadline. Give it `role="timer"` and an `aria-label` with the time left in words.
- **Conversion system:** not in system.

## Story: value and trust

### 6. Logo strip
`fb-logos` · story · 10% of front pages

"Used by teams at" and four to six greyed logos. Only with permission.

- **Conversion system:** not in system (the scanner already labels it `logo-strip`).

### 7. Benefit grid
`fb-grid` + `fb-card` · story · 94% of front pages

Three icon cards: icon tile, title (20px, 600), one or two muted lines. The most frequent block in the study after the hero, often used twice on one page. Columns run 35 / 35 / 35 on desktop and stack on phones.

- Write outcomes, not features. Three cards is the norm, four is fine, more becomes a list.
- **Conversion system:** `benefits`, variant `cards`. The checklist form is variant `list`.

### 8. Feature split
`fb-split fb-feature` · story · 53% of front pages

Image one side, heading, text and a checklist the other. 50 / 50 or 45 / 55. Repeat it two or three times down the page and flip sides each time.

- `is-flipped` swaps sides only at 900px and up, so phones always read copy first.
- **Conversion system:** not in system as its own section. Closest is `benefits`.

### 9. Steps
`fb-steps` · story · 4% of front pages, 7% of thank-you pages

Numbered 01, 02, 03. Use it for "how it works" before the ask, or "what happens next" after it.

- **Conversion system:** not in system.

### 10. Testimonials
`fb-quote` in `fb-grid` · story · 47% of front pages

Quote cards: stars, the quote, a named person with role and avatar.

- No named source and written permission means the card keeps `fb-placeholder-flag`. The kit shows it on purpose.
- **Conversion system:** `proof`.

### 11. Rating stack
`fb-ratings` · story · seen in heroes and beside forms

Three short starred lines stacked vertically, placed above the headline or under the form. Proof next to the ask.

- **Conversion system:** not in system as a variant. Closest is `proof`.

### 12. Bio
`fb-split` + `fb-bio` · story · 33% of front pages

The person behind the promise: portrait, a credential line in accent caps, two or three sentences in their own words.

- **Conversion system:** `story`.

### 13. Video
`fb-video` · story · 45% of front pages (hero video included)

16:9 frame, poster, a round play button with an accessible name. On sales pages a second video often sits mid-page.

- A real video needs captions and an allowed host (the conversion system allows youtube-nocookie.com and player.vimeo.com).
- **Conversion system:** `video`.

### 14. FAQ
`fb-faq` · story · 78% of front pages

Native `details` / `summary`, so it works without JavaScript. Three to six questions, each one a doubt that stops the sale.

- Placement is the strongest pattern in the study. On 31 of the 38 front pages with an FAQ, it is the second-to-last block, right before the final ask.
- **Conversion system:** `faq`.

## Offer: the stack and the ask

### 15. Offer stack
`fb-offer` · offer · 27% of front pages, rising on sales pages

Every item with its value, bonuses marked free with the old value struck through, a total value line, then today's price in the highlight colour and the button.

- Every value must be real and confirmed by the client. Otherwise it goes in the Brunson pass as `ask-client`.
- **Conversion system:** `offer`, variants `list` and `cards`.

### 16. Guarantee
`fb-guarantee` · offer · 10% of front pages, 32% of checkouts

A round seal and the promise in plain words. Put it beside the price or right under the pay button.

- **Conversion system:** not in system.

### 17. CTA band
`fb-ctaband` · offer · 43% of front pages

A heading and the button, on an accent or dark band. It is the last block on 19 of the 49 front pages. Use the same label as the hero button.

- **Conversion system:** `cta`.

## After the first yes

### 18. Checkout
`fb-progress`, `fb-steptabs`, `fb-product`, `fb-form`, `fb-bump`, `fb-secure` · after · 100% of checkouts

One tall section (about 1,600px on desktop) on a coloured band:

1. Progress bar with a label ("One step left").
2. Two-step tabs: 1 Your details, 2 Payment. The current tab has `aria-current="step"`.
3. Product row: thumbnail, name, price.
4. Fields: name, email, phone, then billing.
5. Order bump: a dashed box, one checkbox, "Yes, add …" in bold, one line of value.
6. Pay button and a secure line.

- **Conversion system:** not in system. The backend owns payment.

### 19. Upsell
`fb-steppill`, `fb-price`, `fb-decision`, `fb-decline` · after · 100% of upsells

A step pill ("Order step 2 of 3"), a headline saying the order is not finished, often a video, the was / now price, one big yes button and a plain underlined no ("No thanks, I'll …"). 75% show the explicit no.

- The no must be a real, visible choice. Same size text as the body, never hidden.
- **Conversion system:** not in system.

### 20. Confirmation
`fb-confirm`, `fb-nextsteps` · after · 100% of thank-you pages

A check, what just happened, numbered next steps (add to calendar, whitelist the email, join the group), and help if the email does not arrive. 20% add a benefit grid and 9% a host bio below.

- **Conversion system:** not in system (launch readiness lists a missing results page as a backend item).

### 21. Footer
`fb-footer` · after

Privacy, terms, contact, and a results disclaimer where income or health is mentioned. Nothing else.

- **Conversion system:** part of the page layout.

## Parts used across blocks

`fb-eyebrow`, `fb-accent-word`, `fb-mark`, `fb-button` (`is-yes`, `is-ghost`, `is-block`, `__sub`), `fb-decline`, `fb-microcopy`, `fb-checklist`, `fb-chip`, `fb-stars`, `fb-price`, `fb-field`, `fb-consent`, `fb-placeholder-flag`.
