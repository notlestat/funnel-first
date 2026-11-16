---
name: funnel-blocks
description: Design funnel pages from a measured block library and token set. 21 building blocks with 5 hero variants (heroes, form card, countdown, benefit grid, proof, offer stack, guarantee, FAQ, checkout, order bump, upsell, confirmation), the order each funnel step puts them in, and the token values 127 funnel steps actually use. Use when designing or mocking a funnel step, opt-in, sales page, webinar registration, checkout, upsell or thank-you page, when composing a page from blocks in HTML, Paper or Blueprint, when choosing type sizes, spacing or button styles for a funnel, or when deciding which section or variant the conversion system needs next. Built from a code study of 48 public funnel templates (Swipe Pages gallery, November 2026).
---

# Funnel blocks

A funnel page is a short stack of known blocks in a known order. This skill gives you the blocks, the order and the numbers, so you design the hook, the story and the offer instead of rediscovering where the FAQ goes.

It works next to `funnel-first`. That skill decides the funnel: strategy, funnel type, the Brunson pass. This one decides how each step is built.

## What is in the folder

| Path | Use it for |
|---|---|
| `kit/tokens.css` | The token file. The first 18 names are the conversion system's token contract, the rest are extensions with defaults. |
| `kit/blocks.css` | Every block, styled only from tokens, prefix `fb-`. |
| `kit/index.html` | The gallery. Every block rendered, with three sample brands to show one token file restyling the lot. Open it in a browser. |
| `references/blocks.md` | Each block's job, stage, anatomy, rules, frequency in the study and its conversion-system section. |
| `references/funnels.md` | Step order for each of the nine funnel types, and the block order inside each step. |
| `references/tokens.md` | The measurements behind every token, desktop and phone. |
| `references/evidence.md` | How the study was run, what it can and cannot tell you, and how to repeat it. |
| `references/study.json` | The raw measurements and every page's block sequence. |
| `scripts/` | The block extractor (runs in the page through agent-browser) and the aggregator. |

## Funnel templates in a company's design system

`templates/funnels.mjs` holds ten funnel types as steps of blocks: lead magnet, appointment, quiz, live workshop, video sales letter, low-price offer with upsell, product (gift voucher), application (high-ticket), membership plan and challenge. It holds structure only. A company's content file fills the slots, and `templates/render.mjs` turns each block into `fb-` markup.

To design a company's funnels on the Blueprint board:

1. Capture the company first (`extract_design_system`, `capture_brand`), so its brand file has the 18 tokens, fonts and logo.
2. Put its photos and logo on the board with `add_reference` and note each `/assets/...` src.
3. Write `src/data/brands/<id>.funnels.json`: `images`, extended `tokens` (dark band, highlight, button shape, card style, an `accent-text` shade when the accent fails contrast as text), `shared` slots, one object per funnel step, and a `sheet` with the decisions the designer must approve. Client content stays uncommitted, like the brand file.
4. Run the builder. It renders every step at 1440 and 390, measures each page in Chrome, splits pages over 4,000px into parts, and lays the board out with one row per funnel, desktop then phone, plus a design-system sheet on top:

   ```sh
   node skills/funnel-blocks/blueprint/build.mjs \
     --brand src/data/brands/<id>.json --content src/data/brands/<id>.funnels.json
   ```

   `--only quiz,webinar` rebuilds some funnels, `--dry` renders without touching the board. Re-runs update the same artboards (ids in `.blueprint/funnel-blocks.<id>.json`). A slot with no content shows "Missing content" on the artboard.
5. Review on the board: Keep, Change or Drop per artboard. Change the content file or the tokens, never the rendered HTML, then re-run.

Blocks the templates add to the kit: trust row, question, result, booking slots, plans, challenge days and tasks, amount picker, order summary, before and after, photo frame.

## Build a step in five moves

1. **Pick the step.** Use `references/funnels.md` to find the steps for your funnel type and the job of this one. One step, one yes.
2. **Lay out the blocks in order.** Start from the step's default sequence. Cut any block you have no real content for. A missing testimonial is better than an invented one.
3. **Set the tokens.** Copy `kit/tokens.css`, change the base 18 to the brand's values and leave the extensions at their defaults unless the brand needs otherwise. In the conversion system, the brand file's `tokens` already supply the 18.
4. **Compose.** Use the markup patterns in `kit/index.html`. Each block is a `section.fb-band` with an optional tone (`is-dark`, `is-surface`, `is-accent`, `is-photo`), a `.fb-container`, then the block's own elements.
5. **Check at 390px and 1440px.** Tap through the form, Back and the keyboard. Run the checks in "Rules" below.

## The defaults the study supports

These are what the templates do, measured. They are design defaults, not conversion results. See `references/evidence.md`.

- **Phone first.** Sections pad 60px top and bottom on phones, 90px on desktop. Containers are 1180px. On phones about half of primary buttons span the column. The kit makes them all span it.
- **Type scale.** H1 52 desktop / 36 phone, section heading 42 / 30, card title 20, body 18 / 17. Display line height 1.2, body 1.5. Display weight 700, card titles 600.
- **One display face.** About half the pages use one family for everything. Geometric sans faces dominate: Sora, Manrope, Plus Jakarta Sans, Inter, Poppins.
- **Buttons.** 57px tall on desktop, 62 on phones where labels wrap to two lines. 68% uppercase, 600 to 700 weight, 18px type, five words. A third are pills, most of the rest are nearly square (3px). 26% put the price in the label and 26% speak in first person ("Send my guide").
- **Fields.** 44 to 48px tall, 6px radius. Text, email and phone, in that order of frequency.
- **Pop-up forms.** Two fields is by far the most common pop-up form. Most opt-in buttons open a form instead of carrying one.
- **The hero.** 55% of first sections sit on a photo under a dark overlay, 21% on a dark band. 61% are centred. A third carry a checklist. A quarter carry the form itself.
- **Page length.** Opt-in steps run about 6,000px on desktop, sales steps about 7,700px, checkouts 1,600px, upsells 2,300px and thank-you pages 1,100px.
- **Tone changes.** Adjacent sections change background on 70% of boundaries. Alternate light, tint and dark so each block reads as its own unit.

## Rules

The study shows what templates do. These rules come from the conversion system and from accessibility, and they override the study.

- **No invented proof.** Quotes need a named source and written permission. Logos need permission. Until then the block keeps `.fb-placeholder-flag`. The same goes for "Total value" numbers and "10,000 customers" claims.
- **A countdown needs a real deadline.** No evergreen timers that reset on reload. If the date is not fixed, drop the block.
- **Contrast.** Text, muted text and button text pass WCAG AA against their band. Check every tone the block appears on, especially the highlight colour on photo heroes.
- **Targets and focus.** Buttons and fields are at least 44px tall. Every control shows a visible focus ring.
- **Reading order.** Visual order matches DOM order on phones. `.fb-feature.is-flipped` swaps sides only at 900px and up.
- **Motion.** Respect `prefers-reduced-motion`. The kit already turns transitions off.
- **One way out.** No navigation in the brand bar. The only links are the ask, the footer's legal links and contact.
- **Demo forms never claim success.** The kit's forms do nothing on submit, and the page says so.

## Using it with the conversion system

The conversion system renders client pages from a brand file, and its section list is fixed. Use this skill to design within it and to see what it lacks.

- Blocks that map to an existing section are listed in `references/blocks.md` with the section id and variant.
- Blocks marked **not in system** (countdown, guarantee, logo strip, steps, checkout, upsell, confirmation and others) do not exist as sections yet. Do not hack them into a brand file. Name the missing section and route it through the Skills Atlas workflow "Add a section or variant to the conversion system". This skill is the reference and evidence for that work.

## Repeat or extend the study

`references/evidence.md` has the method. In short, list step URLs, run `npm run scan` for the repo's code-only scan, then run the block extractor through agent-browser at 1440 and 390, then aggregate. Scans and screenshots stay in `scans/`, which is not committed: they hold other companies' pages. Commit only measurements and original code.
