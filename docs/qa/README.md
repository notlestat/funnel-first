# Check funnel layouts

Run visual QA after building the funnels. The command checks the built pages, then builds temporary stress copies with awkward content using the same Astro components.

## Run the checks

1. Install dependencies with `npm ci`. Install Google Chrome if it is not available.
2. Run `npm run build`.
3. Run `npm run qa` to check every brand in `src/data/brands/`.
4. Open `qa-report/index.html` in a browser.

To check selected brands, pass their IDs:

```sh
	npm run qa -- gridline brightside-solar
```

To keep a finding from failing a review job, add `--warn-only`:

```sh
	npm run qa -- gridline --warn-only
```

The command exits with code 1 when it finds errors. `--warn-only` returns 0 for findings, but setup and build failures still return 1. A missing or stale `dist/` stops the command and asks you to rebuild. A full run opens a fresh browser context per page and can take several minutes.

## Read the report

The report groups findings by brand, then by section. Each finding names the check, severity, stress case, viewport and CSS selector. A cropped screenshot outlines the problem element in red. Page-level findings use a first-screen crop. Open a screenshot to inspect it at its original size.

Under **Stress contact sheets**, expand a case to see its section screenshots. FAQ answers are open in these screenshots. This grid is for visual judgement, including problems that a detector might miss. **Measurements and coverage** lists each page's observed CLS and LCP.

`qa-report/report.json` contains the same findings, measurements, screenshots, stress notes and limitations. The report uses schema ID `funnel-qa/1`. `qa-report/` is gitignored. Each run replaces the previous report.

## Checks and thresholds

Real brand pages run at 390 × 844, 768 × 1024 and 1440 × 900 CSS pixels. Stress copies run at 390 × 844 and 1440 × 900.

| Check | Severity | What triggers it |
| --- | --- | --- |
| Horizontal overflow | Error | Document width exceeds the viewport, or a visible element extends beyond either viewport edge, with a 1px rounding allowance |
| First-screen ask | Error | The primary hero CTA or the complete first question is missing or extends beyond the first 390 × 844 screen |
| Clipped text | Error | Text extends beyond its own hidden overflow, a clipping ancestor, or a line clamp |
| Failed request | Error | A request fails, returns HTTP 400 or later, or an image cannot decode |
| QA error | Error | A page or screenshot check cannot finish, so that pass is incomplete |
| Tap target | Warning | A visible button, link or input has an effective tap area below 44 × 44px on the phone pass |
| Photo contrast | Warning | Sampled screenshot pixels behind image-backed text yield a ratio below 4.5:1 |
| Image size | Warning | An image response body exceeds 300 KB, or either natural dimension exceeds twice its rendered dimension |
| Image dimensions | Warning | An image lacks positive width and height attributes |
| Layout shift | Warning | Initial observed CLS exceeds 0.1 on the phone pass |
| Largest contentful paint | Warning | Initial observed LCP exceeds 2500ms on the phone pass |
| Console error | Warning | Chrome reports a console error or an uncaught page error |

An enclosing label counts as the tap area for its radio button or checkbox. Hidden flow steps do not count as visible content. FAQ answers are also checked after opening them.

## Stress cases

Each brand gets independent copies for these changes:

- A three-word headline and a sixteen-word headline.
- Doubled body copy, including subheads, answers, quotes and story paragraphs.
- Missing optional images.
- A local 600 × 1200 portrait fixture in the hero, logo and proof slots that exist.
- Maximum and minimum list counts, question counts and answer counts.
- Button labels with 28 characters.
- A long brand name.

The existing schema validates every copy. Invalid cases are skipped with their field errors recorded in the report. No rule or schema limit changes to accommodate a stress case. Testimonials and FAQ items have no schema maximum, so the maximum case uses 12 and records that choice. Existing quotes are repeated rather than fabricated. An empty testimonial list stays empty.

The funnel currently does not display `brand.name` as text. That case exercises schema acceptance and logo alt text, and the report states this limit.

## Scope and limits

`qa/build.ts` copies the renderer into an OS temporary folder, supplies stress data there and runs Astro. Each temporary route owns copied image assets so it still passes the existing image-path rules. The command never writes stress brands into the repository's `src/data/brands/`, never changes the normal `dist/`, and removes its temporary project in cleanup. An operating-system force kill can prevent cleanup.

The static server binds to `127.0.0.1` on an available port and serves only its build folder. Chrome loads external fonts and permitted embeds as the real page does. A network failure appears in the report rather than being hidden.

CLS uses the largest layout-shift session window. Metrics cover page load, font readiness and an additional 1.2 seconds before scrolling or opening FAQs. They are local observations without CPU or network throttling, not field performance. Deferred changes outside this window can be missed.

The photo check hides text without changing layout, takes a screenshot and samples a 7 × 7 grid behind each text box. It covers CSS image backgrounds and overlapping absolute image siblings such as the current hero. Masks, blending, filters and other complex compositing still need visual review. Sampling cannot prove contrast for every glyph or every image pixel.

The initial page and expanded FAQs are checked. Later question-flow screens and contact validation are not traversed. The report does not judge copy, taste, image rights, funnel strategy or launch readiness. A passing run is not design approval.

## Verify changes to the tool

Run `node --test test/qa.test.ts` for fixture checks and the isolated Astro build check. The fixture has deliberate overflow, a small target, clipped text, a low-contrast image background and a broken request. Run `npm test` and `npm run check` before handing off changes.
