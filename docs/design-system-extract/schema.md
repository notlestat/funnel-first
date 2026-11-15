# Extract reference

An extract writes `design-system.json` with `"schema": "design-system/1"`, and `assets.json` with one record per asset. The types are in `scan/extract.ts`. New fields may be added. Existing fields are not renamed or removed within version 1.

## `design-system.json`

| Field | Meaning |
| --- | --- |
| `company` | `{ host, start_url }` |
| `extracted_at` | ISO date-time |
| `viewport` | `{ name, width, height }` |
| `pages` | Each page visited: `url`, `title`, `status` (`ok`, `blocked` or `error`) and `reason` when not `ok` |
| `logo` | `{ kind, url, html, alt }`. `kind` is `img` or `inline-svg`. `file` is set when the logo was saved. Null when none is found |
| `tokens` | See below |
| `components` | Component variants. See below |
| `icons` | Inline SVG icons: `id`, `label`, `w`, `h`, `html` (scripts and event attributes removed), `count`, `pages`, and `file` when saved |
| `assets` | `file` (always `assets.json`), `counts` by type, `total`, and `downloaded` |
| `limitations` | What this extract cannot show |

### `tokens`

| Field | Meaning |
| --- | --- |
| `page` | Body `bg`, `text`, `family`, `size`, `line_height` from the first page |
| `display` | The largest text near the top of the first page: `size`, `family`, `weight` |
| `colors` | Up to 40 colours merged across pages, most used first: `hex`, `roles`, `count` |
| `type` | Up to 40 text styles by role: `role`, `family`, `size`, `weight`, `line_height`, `letter_spacing`, `transform`, `count` |
| `radius`, `shadow` | `{ value, count }`, most used first |
| `spacing` | `section_padding` and `gap`, each `{ value, count }` |
| `declared` | CSS custom properties from readable stylesheets, merged across pages |
| `fonts` | Font families the browser loaded, with their `weights` |

### `components`

| Field | Meaning |
| --- | --- |
| `id` | The kind and 6 hex characters from the style, like `button-53ca14` |
| `kind` | `button`, `input`, `choice`, `card`, `badge`, `link`, `nav` or `footer` |
| `style` | The computed styles that define the variant. Colours are hex, with an alpha byte when translucent |
| `count` | Instances across all pages |
| `examples` | Up to 4 labels from instances |
| `html` | The HTML of one instance, up to 1,500 characters, with scripts and event attributes removed |
| `pages` | Pages where it appears |
| `screenshot` | `components/<id>.png`, or null when the instance could not be cropped |
| `w`, `h` | Size of the cropped instance in px |

## `assets.json`

One record per asset URL. A stream URL with quality settings merges into the bare stream URL.

| Field | Meaning |
| --- | --- |
| `id` | The type and 8 hex characters from the URL |
| `type` | `logo`, `favicon`, `icon`, `share-image`, `image`, `video`, `video-embed`, `font` or `manifest` |
| `url` | Absolute URL |
| `pages` | Pages where it appears or loads |
| `contexts` | How it was found, such as `css background`, `picture source`, `Mux stream (HLS)` or `loaded as font` |
| `alt` | Alt text, when the page gives one |
| `w`, `h` | Rendered size in px |
| `natural_w`, `natural_h` | Intrinsic image size in px |
| `mime` | Content type, from the response or the markup |
| `bytes` | Size from the response header, or of the downloaded file |
| `source` | `page`, `network` or `both`: found in the markup, seen loading, or both |
| `local` | Path of the downloaded file under the extract folder |
| `sha1` | Hash of the downloaded file |
| `skipped` | Why a download did not happen, such as `HTTP 403` or `larger than 50 MB` |

`assets.csv` has the same fields as columns. List fields are joined with spaces.
