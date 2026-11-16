# Evidence: how the study was run

## Source

The Swipe Pages funnel template gallery, `https://swipepages.com/funnel-templates/`, read on 16 November 2026. The gallery page links 12 templates and claims "45+". The site's public sitemap lists 48 template pages across nine types. Each template page links its steps, and each step page frames the live template from `templates.swipepages.com/<funnel>/<step>`.

- 48 templates, 132 step pages, 130 step URLs resolved, 127 unique pages scanned. Two step pages had no preview; two steps share a URL.
- `robots.txt` allows everything except `/api/` and `/design/`. No login, bot check or form submission was involved.

## Tools and what each established

| Tool | What it did | What it established |
|---|---|---|
| agent-browser (Vercel) | Opened the gallery, template and step pages; ran the block extractor at 1440 and 390; took screenshots | Section-level computed styles, module types, step order |
| REA `inspect_web_page` | Passive CDP inspection of one template, no JavaScript run | DOM structure: 2,483 nodes, one inline style block, three scripts, lazy-loaded images (`data-src`, `data-webp`), a 247-row country picker in the phone field, pop-up containers, tabs, a Lottie redirect animation |
| REA `analyze_web_bundle` | Static analysis of the page's scripts | Three small scripts (event and funnel analytics), no client routing and no endpoints. The design lives in HTML and CSS, so computed styles are the right source |
| Repo scanner (`npm run scan`) | Code-only scan, phone and desktop | Tokens, fields per form, a second opinion on structure. 127 read, 0 blocked |
| Contact sheets | First screens of all 127 phone captures, viewed by eye | The visual patterns: accented headline phrase, eyebrow pills, dark form cards, three-box timers, step tabs, value stacks |

### The page model

The pages use a Tatsu-style page builder. Every page is a stack of sections, each with a background layer and an overlay layer, a padded inner, rows capped at 1180px, columns and modules. Named modules include title, text, single image, icon box, button (shortcode), form, accordion, countdown, hosted video, payment form, upsell yes button, progress bar and coupon code. CTA buttons usually open a pop-up form instead of linking to an on-page form.

## How blocks were labelled

A script (`scripts/aggregate.py`) labelled each of the 553 sections from its modules, its headings and text cues: accordion means FAQ, a hosted video means video, three or more icon boxes or cards means benefit grid, two columns with an image means feature split, stars or "what our clients say" means testimonials, and so on. The first section is labelled by step type: hero, checkout, upsell or confirmation.

38 sections (7%) matched no rule and are counted as "content". Spot checks against screenshots agreed with the labels on the pages checked. This was not every page.

## What the study can and cannot tell you

| Status | Claim |
|---|---|
| FACT | These templates use the block types, orders and token values reported, as rendered in Chrome on the date above |
| OBSERVATION | FAQ second to last and the ask repeated at the end is the most consistent ordering pattern |
| INFERENCE | Swipe Pages built these templates from one internal system: identical padding, container and line heights across every template |
| UNKNOWN | Whether any template converts. The gallery publishes no results, and the copy, testimonials and numbers on the templates are sample content |
| UNKNOWN | How the templates behave after interaction: pop-up forms, payment steps and redirects were read but not submitted |

Treat every pattern as a starting design, then test it. The conversion system's rules (named proof, real deadlines, contrast, no invented numbers) override anything the templates do.

## Rights

The kit's CSS, markup and sample copy are original. Nothing in the kit copies template text, images, logos, fonts or code. The study files that hold third-party pages (scans, screenshots, extracts) stay local in `scans/`, which is git-ignored. `study.json` holds measurements, block labels and the public template slugs only.

## Repeat the study

From the repository root:

```sh
# 1. Step URLs (sitemap → template page → step page → preview URL)
#    produces urls.txt with one templates.swipepages.com URL per line
# 2. Repo scanner, both widths
npm run scan -- urls.txt --out scans/swipepages-mobile --viewport mobile
npm run scan -- urls.txt --out scans/swipepages-desktop --viewport desktop
npm run scan:report -- scans/swipepages-mobile
# 3. Block extractor through agent-browser, both widths
agent-browser session id --scope worktree --prefix research
agent-browser --session <name> set viewport 1440 900
agent-browser --session <name> open <url>
agent-browser --session <name> eval --stdin < skills/funnel-blocks/scripts/extract-blocks.js
# 4. Aggregate
python3 -I skills/funnel-blocks/scripts/aggregate.py steps.tsv blocks-desktop.jsonl blocks-mobile.jsonl study.json
```

The extractor and aggregator are tuned to this builder's class names (`tatsu-section-offset`, `tatsu-module`, `be-preview`). For another builder, change the section and module selectors first.

The repo scanner reported "Builder: unknown" for every page and labelled most sections "content", because buttons here open pop-ups and the sections carry builder classes it does not know. Teaching it this builder's fingerprint would make future scans of these templates more useful. That is a change to `scan/`, which is designer-owned.
