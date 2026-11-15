# Scan funnels for tokens, assets and structure

The scanner opens funnel pages in Chrome and saves one JSON file per page. Each file records the page's design tokens, its assets and its funnel structure. The scanner is code only and calls no AI per page. A page takes 1 to 3 seconds.

For the fields in each file, see [the scan record reference](schema.md).

## Scan a few pages

1. Start the local app:

   ```sh
   npm run app
   ```

2. Open http://127.0.0.1:4410/scans.
3. Paste up to 10 URLs, one per line, and choose **Phone, 390px** or **Desktop, 1440px**.
4. Select **Scan**.

The page lists every scan. Select one to see its screenshot, funnel, colours, type, shape, assets and limits, or to download its JSON.

## Scan hundreds of pages

1. Put one URL per line in a text file. Lines that start with `#` are skipped.
2. Run the scan:

   ```sh
   npm run scan -- urls.txt --concurrency 4
   ```

3. Write the cross-funnel report:

   ```sh
   npm run scan:report -- scans
   ```

The scan writes `scans/<id>.json` for each page, `scans/index.jsonl` with one summary line per page, and `scans/shots/<id>.jpg`. The report writes `scans/report.json` and `scans/report.md`.

| Flag | Default | Effect |
| --- | --- | --- |
| `--out <dir>` | `scans` | Where the files go |
| `--concurrency <n>` | `4` | Pages open at once, up to 16. One page per host at a time, whatever the number |
| `--viewport mobile\|desktop` | `mobile` | 390 by 844, or 1440 by 900 |
| `--no-screenshot` | screenshots on | Skip the JPEG for each page |
| `--timeout <ms>` | `30000` | Give up on a page after this long |

An agent can run the same scanner through the `scan_funnels` and `scan_report` tools on the MCP server.

## Read the results with care

The labels are heuristics from one page load without interaction. Check a sample against the screenshots before you quote a percentage.

- The scanner reads the first screen of a multi-step funnel. It does not click through later steps. It does read the fields of hidden steps when they are in the page, and marks them `visible: false`.
- A page behind a bot check comes back `"status": "blocked"`. The scanner never tries to get past it.
- Fonts and CSS variables in stylesheets from another domain cannot be read. The record says so in `limitations`.
- The browser uses Chrome's own user agent. Sites that serve different pages to phones by user agent may show the desktop page at phone width.

## Respect the sites you scan

- Scan public pages only. Do not scan behind a login or past a bot check.
- Check a site's terms before scanning it in bulk. The Meta Ad Library website does not allow scraping. Get URL lists from approved sources, such as the official Ad Library API where it covers the ads you need.
- Keep `scans/` local. It holds other companies' text and screenshots, so `.gitignore` excludes it.
- Assets are recorded as URLs. The scanner does not download logos, images or font files.

## Tests

`test/scan.test.ts` checks the labelling rules and scans three sample funnels with known answers. Run `npm run build` first, then `npm test`.
