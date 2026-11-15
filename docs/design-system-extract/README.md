# Extract a company's design system

The extractor visits a company's site and writes its design system as JSON, plus a list of every asset. It records tokens, fonts, the logo, every component variant, inline icons, images, videos and font files. It is code only and calls no AI. A page takes 5 to 15 seconds.

The scanner (`npm run scan`) answers "how is this funnel built?" for many pages. The extractor answers "what is this company's design system?" for one company. For the fields in each file, see [the extract reference](schema.md).

## Extract a company

Run the extract from the command line:

```sh
npm run extract -- https://example.com/ --pages 6
```

Or open the viewer with `npm run app`, go to http://127.0.0.1:4410/extracts, enter the site and select **Extract**.

The extractor reads the start page first. It then visits one page for each kind of path it links to, such as `/products/…`, `/about` and `/collections/…`, so the templates differ. On each page it scrolls to the bottom so lazy images and videos load.

| Flag | Default | Effect |
| --- | --- | --- |
| `--pages <n>` | `6` | Pages to visit, up to 12 from the viewer |
| `--viewport desktop\|mobile` | `desktop` | 1440 by 900, or 390 by 844 |
| `--download` | off | Save the asset files as well as listing them |
| `--out <dir>` | `extracts/<host>` | Where the files go |

## What you get

| File | Contents |
| --- | --- |
| `design-system.json` | Tokens (colours by role, type by role, radius, shadow, spacing, declared CSS variables), fonts, the logo, component variants and inline icons |
| `assets.json`, `assets.csv` | One row per asset: type, URL, alt text, size, bytes, the pages it appears on, and the local file when downloaded |
| `components/<id>.png` | A cropped screenshot of one instance of each component variant |
| `assets/<type>/…` | The files, by type, only with `--download`. Inline icons and an inline logo are saved as `.svg` |
| `README.md` | A short summary of the extract |

Asset types are `logo`, `favicon`, `icon`, `share-image`, `image`, `video`, `video-embed`, `font` and `manifest`.

Component kinds are `button`, `input`, `choice`, `card`, `badge`, `link`, `nav` and `footer`. The extractor groups components by their exact computed style, so 24 identical buttons become one variant used 24 times.

## How the extractor finds assets

- `<img>` elements, including the largest `srcset` candidate and lazy `data-src`
- `<picture>` sources
- CSS background images on every element
- Favicons, touch icons, the web manifest, and share images
- `<video>` sources and posters, including videos inside open shadow roots
- Video player iframes such as YouTube, Vimeo and Wistia
- Mux players and Mux thumbnails, which give the stream URL and poster before anyone presses play
- Every image, media and font file the browser downloads. These include files referenced from stylesheets on other domains, which the page itself cannot read
- Inline SVG icons and sprite symbols, deduplicated by drawing

## Limits

- The extractor sees one state per component. It does not capture hover, focus, open or disabled states.
- Assets that load only after a click or a form step are not seen.
- A page behind a bot check is recorded as blocked and skipped.
- HLS and DASH streams are listed by their playlist URL. `--download` saves the playlist, not the video segments.

## Permission

Downloading a company's logos, images, videos and font files copies their work. Run `--download` only for a client who has agreed, and keep `extracts/` local. `.gitignore` excludes it. Font files usually carry a licence that limits where they can be used.

## Tests

`test/extract.test.ts` runs the extractor against a fixture site in `test/fixtures/company/` with known assets and components, including downloads.
