# Token measurements

Computed styles from 127 funnel steps (48 templates), read in Chrome at 1440 × 900 and 390 × 844. p25 / median / p75 where the spread matters. `n` is the number of elements measured.

## Type

| Role | Element | Desktop px (p25 / med / p75) | Phone px (med) | Line height | Weight | Token |
|---|---|---|---|---|---|---|
| Hero headline | H1 | 48 / 52 / 55 (n 84) | 36 | 1.2 | 700 | `--size-hero` |
| Section heading | H2 | 40 / 42 / 45 (n 306) | 30 | 1.2 | 700 | `--size-heading` |
| Sub-heading | H3 | 34 / 37 / 40 (n 160) | 30 | 1.2 | 700 | use `--size-heading` |
| Small heading | H4 | 23 / 26 / 26 (n 136) | 22.5 | 1.2 | 600 | between the two |
| Card title | H5 | 20 / 20 / 22 (n 294) | 20 | 1.5 | 600 | `--size-subheading` |
| Lede, label | H6 | 18 / 18 / 19 (n 116) | 18 | 1.5 | 600 | `--size-body` |
| Body | p, li | 18 / 18 / 20 (n 475) | 17 | 1.5 | 400 | `--size-body` |

- The H1-to-H2 ratio is small (52 to 42), and sizes shrink by about 30% on phones. Hierarchy comes from weight, colour and the accented phrase more than from size.
- Only 5% of headings are uppercase. Uppercase belongs to buttons and eyebrows.
- Card titles stay 20px at both widths.

### Faces

- About half the pages use one family for everything. The most common pairs were Sora / Sora (16), Manrope / Manrope (8), Plus Jakarta Sans / Plus Jakarta Sans (5) and Barlow Semi Condensed with Barlow (10 together).
- Display faces: Sora, Barlow Semi Condensed, Manrope, Poppins, Raleway, Inter, Space Grotesk, Plus Jakarta Sans, Red Hat Display. Three serif pages (IBM Plex Serif, Merriweather) stood out precisely because they were rare.
- Condensed uppercase display (Barlow Semi Condensed) was the one loud alternative, used on challenge and course pages.

## Space and layout

| Measure | Value | Token |
|---|---|---|
| Section padding, desktop | 90 top and bottom (p25 to p75 all 90, n 1,106) | `--space-section` |
| Section padding, phone | 60 (n 1,106) | `--space-section` |
| Content width | 1180 on 552 of 552 measured rows | `--container` |
| Column patterns | 100 (single), 50 / 50, 35 / 35 / 35, 45 / 55 | `.fb-split`, `.fb-grid` |
| Card inner padding | 10 builder default, cards usually add their own | `--card-padding` |

The builder default does most of this work: every section pads the same and every row is 1180 wide. Rhythm comes from background changes instead. Adjacent sections switch tone on 70% of boundaries (median per page).

## Colour roles

Section tones across all 553 sections: photo 203, light 113, page default 102, dark 84, tint 49, gradient 2.

| Role | What the templates do | Token |
|---|---|---|
| Page | White or off-white | `--color-bg` |
| Tint band | Pale brand tint or grey for alternating sections | `--color-surface` |
| Dark band | Navy, near-black or deep brand colour. Hero, form card, offer card. | `--color-dark` |
| Accent | One saturated brand colour for buttons and the accented headline word | `--color-accent` |
| Highlight | Yellow or lime. Marker strips, eyebrow pills, the yes button on dark bands. | `--color-highlight` |
| Success | Green checks in lists | `--color-success` |
| Danger | Struck-through old prices, the order-bump border | `--color-danger` |

First sections: 55% photo with a black overlay at 40 to 60%, 21% dark band, 15% tint, 6% light.

## Buttons

| Measure | Value |
|---|---|
| Height, desktop | 53 / 57 / 61 (n 272) |
| Height, phone | 57 / 62 / 81. Labels wrap to two lines |
| Horizontal padding | 36 / 42 / 51 |
| Type | 18px, 600 to 700 weight |
| Uppercase | 68% |
| Radius | Two camps. Most are nearly square (3px median); 33% are pills |
| Hard offset shadow | 5% (a brutalist accent, not the norm) |
| Price in the label | 26% |
| First person ("my", "me", "I") | 26% |
| Starts with "Yes" | 10%, mostly on upsells and order bumps |
| Words in the label | 4 / 5 / 7 |
| Full width on phones | 49% |
| Buttons per page | median 1, p75 4. Many pages repeat one CTA down the page |

Tokens: `--button-height`, `--button-radius`, `--button-case`, `--button-weight`, `--button-shadow`.

## Fields and cards

| Measure | Value | Token |
|---|---|---|
| Field height | 44 / 44 / 48, same on phones | `--field-height` (kit uses 48) |
| Field radius | 5 / 6 / 6 | `--field-radius` |
| Field types | text 91, email 49, tel 36, select 30 | |
| Pop-up form fields | 2 fields on 16 of 26 pop-ups; 1 field on 5 | |
| Card radius | 0 / 10 / 15 | `--card-radius` |
| Card border | 27% have one | |
| Card shadow | 6% have one. Cards separate by fill, not shadow | `--card-shadow` |

## What the measurements leave out

- Hover and focus states. The extractor read one static load.
- Brand colours as values. Every template uses its own palette, so the study gives roles, not a palette. The kit's sample colours are original.
- Animation. Entrance animations exist in the builder but were not measured.
