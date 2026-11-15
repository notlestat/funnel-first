# Scan record reference

Each scan writes one JSON file with `"schema": "funnel-scan/1"`. The types are in `scan/run.ts` (`toScan` and `FunnelScan`). New fields may be added. Existing fields are not renamed or removed within version 1.

## Record status

| `status` | Fields |
| --- | --- |
| `ok` | Everything below |
| `blocked` | `id`, `url`, `reason`, `scanned_at`, `ms`. The page showed a bot check |
| `error` | `id`, `url`, `reason`, `scanned_at`, `ms`. The page failed to load or timed out |

## Top level

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Host and path as a slug, plus 6 hex characters from the URL. Stable for the same URL |
| `url`, `final_url` | string | The URL scanned, and the URL after redirects |
| `scanned_at` | ISO date-time | When the scan ran |
| `viewport` | `{ name, w, h }` | `mobile` 390 by 844 or `desktop` 1440 by 900 |
| `ms` | number | Time to load and read the page |
| `title`, `lang` | string | Document title and `lang` attribute |
| `screenshot` | string or null | Path under the scan folder, like `shots/<id>.jpg` |
| `limitations` | string[] | What this record cannot show |

## `tokens`

| Field | Meaning |
| --- | --- |
| `declared` | CSS custom properties declared on `:root`, `html` or `body` in readable stylesheets, up to 400. The site's own token names |
| `page` | Body `bg`, `text` colour, font `family`, `size` and `line_height` |
| `display` | The largest text in the first 1.5 screens: `size`, `family`, `weight` |
| `colors` | Up to 24 solid colours, most used first. Each has `hex`, `roles` and `count`. Roles: `background`, `surface`, `text`, `heading`, `link`, `action`, `on-action` |
| `type` | Up to 30 text styles by `role` (`h1`, `h2`, `h3`, `body`, `small`, `label`, `button`, `input`) with `family`, `size`, `weight`, `line_height`, `letter_spacing`, `transform` and `count` |
| `radius`, `shadow` | Most common values, each `{ value, count }` |
| `spacing` | `section_padding` and `gap`, each a list of `{ value, count }` |
| `button` | `median_height` in px of filled buttons, and their `count` |

## `assets`

| Field | Meaning |
| --- | --- |
| `logo` | `{ src, alt, kind }`. `kind` is `img` or `inline-svg`. Null when none is found |
| `favicon`, `apple_touch_icon`, `og_image` | Absolute URLs |
| `og_title`, `description` | Share title and meta description |
| `fonts_loaded` | Font faces the browser loaded: `family`, `weight`, `style` |
| `font_faces` | `@font-face` rules in readable stylesheets: `family`, `src` |
| `font_links` | Google Fonts, Typekit, Bunny or Fonts.com stylesheet links |
| `images` | Up to 60 visible images: `src`, rendered `w` and `h`, `natural_w`, `natural_h`, `alt`, `above_fold`, `top` |
| `svg_count` | Inline SVG elements |
| `videos` | Video elements and player iframes: `kind`, `src`, `top` |

## `funnel`

| Field | Meaning |
| --- | --- |
| `headline` | `{ text, type }`. `type` is `question`, `named-doubt`, `result`, `curiosity` or `plain` |
| `first_ask` | `{ ask, evidence }`. `ask` is `question`, `form`, `video`, `button` or `none`, read from the first screen |
| `blocks` | Page sections in order: `order`, `kind`, `signals`, `heading`, `top`, `height` |
| `sequence` | Block kinds in order, without `nav` and `footer` |
| `ctas` | Buttons and button-styled links: `text`, `href`, `top`, `height`, `kind`, `above_fold` |
| `cta_repeats` | The most calls to action that share a label or an in-page target |
| `forms` | Each form's `top`, `steps` (step markers found), `fields` (`type`, `name`, `label`, `required`, `visible`) and `submit` label. Site search forms are skipped |
| `loose_inputs` | Email and phone inputs outside any form |
| `contact_fields` | Typed field types across all forms. Tap answers are left out |
| `proof` | `blocks`, `logo_strip`, `rating` (the first rating text found) and `near_ask` (proof directly before, after or inside an ask block) |
| `video` | `present` and `first_top` |
| `page_height` | In px, including pages that scroll inside a container |

Block kinds: `nav`, `hero`, `question`, `capture`, `video`, `proof`, `logo-strip`, `faq`, `offer`, `agenda`, `story`, `benefits`, `cta`, `footer` and `content`. The rules are in `scan/classify.ts` (`blockKind`).

## `stack`

| Field | Meaning |
| --- | --- |
| `builder` | Builders whose markers appear, most specific first. The list is in `scan/classify.ts` (`builderSignals`) |
| `tracking` | Tags found in script URLs or inline snippets: `meta-pixel`, `google-tag-manager`, `google-analytics`, `tiktok-pixel`, `hotjar`, `microsoft-clarity`, `linkedin-insight`, `segment`, `snap-pixel` and `pinterest-tag` |

## Report

`npm run scan:report` writes `report.json` with `totals`, `funnel` (first ask, headline types, the share of funnels that contain each block, the 10 most common sequences, contact fields, fields per form, proof next to an ask, video, call-to-action repeats, page height), `tokens` (body and display fonts and sizes, median button height, radius, the share of pages that declare CSS variables), `stack` and `blocked`. The fields are in `scan/report.ts` (`report`).
