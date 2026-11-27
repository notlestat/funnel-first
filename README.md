# Conversion system

Conversion system turns a client's brand into a funnel page built to get one yes. Each client is one JSON file: their design tokens, a funnel type, their copy and the strategy behind it. Astro builds the funnel page and a design system sheet from that file. The build refuses a brand that breaks a rule, such as weak contrast, a contact form with too many fields, or an invented quote.

The repo also holds the research tools that feed a funnel. They read a client's live site for their tokens, extract a company's whole design system and asset list, and scan other funnels to see how they are built. All three are code only and make no AI calls.

## Requirements

- Node.js 23.6 or later. The scripts run TypeScript files directly.
- Google Chrome, for brand capture, funnel scans and design-system extracts.

## Install and preview the sample funnels

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Build every brand in `src/data/brands/`:

   ```sh
   npm run build
   ```

3. Serve the build:

   ```sh
   npm run preview
   ```

4. Open the address that Astro prints. Each brand has two pages: `/<brand>/`, the funnel, and `/<brand>/system`, its design system sheet.

The seven fictional sample brands cover every funnel type: `gridline`, `larkspur` and `harbour-physio` (lead magnet), `brightside-solar` (appointment), `ironwood-coaching` (quiz), `fieldnote-studio` (VSL) and `kiln-collective` (webinar).

## Build a funnel for a client

An agent does most of this through the MCP server in `mcp/server.ts`, which `.mcp.json` registers as `conversion-system`. Every write goes through the same rules as the build.

[AGENTS.md](AGENTS.md) is the full procedure. In short:

1. Write the strategy: the dream customer, where they are, the hook, the belief that stops them, the offer and who it is not for.
2. Study the niche with `npm run scan`, and extract the client's design system with `npm run extract`.
3. Capture the client's tokens with `capture_brand`, then draft the brand file with the funnel type that fits their goal.
4. Write the Brunson pass: hook, story and offer for every step, curiosity headlines, the doubt, the offer stack, and answers to the designer checks. A real client funnel does not build without it.
5. Run `validate_brand`, `write_brand` and `npm run build`. Then review the funnel at phone and desktop widths.

The method lives in two skills: [funnel-first](skills/funnel-first/SKILL.md) and [brunson-pass](skills/brunson-pass/SKILL.md).

## Measure a funnel

Every funnel page records its view, button clicks, steps forward in the question flow and form attempts. Add `analytics` with a PostHog project key to a brand file to send those events to PostHog. [Measure a funnel](docs/measurement/README.md) has the setup and [Funnel events](docs/measurement/events.md) lists each event.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Validate every brand and build the funnels and system sheets into `dist/` |
| `npm run dev` | Start the Astro dev server |
| `npm test` | Run the tests. The browser tests need `npm run build` first and skip without it |
| `npm run check` | Type-check the project |
| `npm run qa -- [brand...] [--warn-only]` | Check built funnels at phone, tablet and desktop widths, then stress-test their sections. Writes `qa-report/` |
| `npm run mcp` | Start the MCP server for agents |
| `npm run app` | Open the local review app at http://127.0.0.1:4410: brand capture, `/scans` and `/extracts` |
| `npm run capture -- <id> <url> [url] [url]` | Capture a client's tokens from 1 to 3 pages |
| `npm run scan -- <url \| urls.txt>` | Scan funnels for tokens, assets and block structure. Writes `scans/` |
| `npm run scan:report -- scans` | Count what recurs across every scan |
| `npm run extract -- <url> [--download]` | Extract a company's design system and asset list. Writes `extracts/<host>/` |

`scans/` and `extracts/` hold other companies' pages and files, so `.gitignore` keeps them out of the repository. `--download` saves a company's files and needs that company's permission.

## Funnel types

| Type | First ask | Use it when |
| --- | --- | --- |
| `lead-magnet` | A button to a one-field form | Warm traffic and a clear free resource |
| `appointment` | A one-tap question in the hero | A qualified call matters more than volume |
| `quiz` | A one-tap question in the hero | Cold social traffic and a problem people want diagnosed |
| `vsl` | A video, then a short form | A belief blocks the sale and a video can break it |
| `webinar` | A button that names the date | A live session does the selling |

`src/system/sections.ts` defines the section order for each type. `system_overview` on the MCP server returns the same guide.

## Where things live

| Path | Contents |
| --- | --- |
| `src/data/brands/` | One file per client. The only file an agent writes for a new client |
| `src/data/references/` | Inspected funnel patterns, saved as `candidate` until the designer curates them |
| `src/data/captures/` | The evidence behind each captured brand |
| `src/system/` | The schema, sections, funnel types, tokens and rules |
| `src/sections/`, `src/pages/` | The section components and the page templates |
| `capture/` | Brand capture and the local review app |
| `scan/` | The funnel scanner and the design-system extractor |
| `mcp/` | The MCP server |
| `skills/` | The `funnel-first` and `brunson-pass` skills |
| `docs/` | Guides and references, listed below |

## Documentation

- [Brand capture](docs/brand-capture/README.md): capture a client's tokens and review them.
- [Visual QA](docs/qa/README.md): check layout, images and performance, then review stress contact sheets. Run `npm run build` first.
- [Funnel scans](docs/funnel-scan/README.md) and [the scan record reference](docs/funnel-scan/schema.md).
- [Design-system extracts](docs/design-system-extract/README.md) and [the extract reference](docs/design-system-extract/schema.md).

## What the build cannot check

The build checks rules. It cannot judge taste, brand fit, or whether the hook, story and offer are right. The design system sheet lists those questions for the designer. A passing build is not approval.
