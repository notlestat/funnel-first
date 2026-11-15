# Agent brief: conversion system

This repo turns a client's brand into a conversion-first funnel: a design system and a funnel page built to get one yes. The system is already built. Your job for a client is to write one data file, not code.

Load the `funnel-first` skill (`skills/funnel-first/SKILL.md`) before any funnel work. It holds the strategy, the funnel types, hook-story-offer and the scanner.

## What you may change

| Path | You | Who else |
| --- | --- | --- |
| `src/data/brands/<client>.json` | Create and edit | |
| `src/data/references/<id>.json` | Add after inspecting the real page | Designer approves `curated` |
| `src/data/captures/<client>.json` | Written by `capture_brand` only | |
| `scans/`, `extracts/` | Written by the scanner and extractor only. Local, not committed | |
| `src/sections/`, `src/system/`, `src/layouts/`, `src/pages/`, `src/content.config.ts`, `scan/`, `skills/` | Do not edit | Designer, when a new section, variant or rule is needed |

If a client needs something the schema does not allow, stop and say which section or variant is missing. Do not work around the schema. The designer adds it through the Skills Atlas workflow "Add a section or variant to the conversion system" (`system-variant`).

## Tools

Use the `conversion-system` MCP server (registered in `.mcp.json`, run with `npm run mcp`). Write brand and reference files through it, not by hand: it applies the same rules as the build before anything is saved.

| Tool | Use it to |
| --- | --- |
| `system_overview` | Read the funnel types and when to use each, sections with their hook/story/offer stage, variants, tokens, rules and designer checks. Start here. |
| `capture_brand` | Read a client's live site and propose their tokens, with evidence. |
| `scan_funnels` | Scan 1 to 20 other funnels with code (no AI): tokens, assets, first ask, block sequence, forms, proof, builder, tracking. |
| `scan_report` | Count what recurs across every scan in `scans/`. |
| `extract_design_system` | Extract one company's design system across several pages: tokens, fonts, logo, component variants with crops, inline icons, and a list of every image, icon, video and font. Files only with `download: true` and the company's permission. |
| `search_references` | Find references by funnel type, conversion role, status or words. |
| `add_reference` | Save a page you inspected. Always saved as `candidate`. |
| `list_brands`, `get_brand` | See existing clients, so the new one looks different. |
| `validate_brand` | Check a draft. Errors block saving; warnings flag conversion risks and look-alike clients; `launch` lists what is not ready. |
| `write_brand` | Save the brand file and get the pages to review. |

Commands: `npm run app` opens brand capture at http://127.0.0.1:4410, the scan viewer at `/scans` and the extract viewer at `/extracts`. `npm run scan -- urls.txt` scans hundreds of pages; `npm run scan:report -- scans` writes the cross-funnel report. `npm run extract -- https://client.com/` writes `extracts/<host>/` (see `docs/design-system-extract/README.md`).

## Run a client through the system

1. **Their brand and their goal.** Collect the live site, brand guidelines, existing pages, the offer and where their traffic comes from. Note what you could not access.
2. **Strategy first.** Write the brand file's `strategy`: dream customer, where they are, hook, the belief that stops them, offer, who it is not for, and the second yes. Unknowns go back to the client as questions. Never invent them.
3. **Study the niche.** Scan competitors' funnels with `scan_funnels` or `npm run scan`, read `scan_report`, and look at the screenshots. Save any pattern you inspected yourself with `add_reference`.
4. **Capture the brand.** Call `extract_design_system` on the client's site for their full design system and asset list, then `capture_brand` with the client id and 1 to 3 of their pages. Show the designer every `inferred` and `default` token and any contrast error. Never quietly change a client's colour to pass a rule. For a written brand document as well, run the `create-design-md` skill on the same pages.
5. **Write the brand file.** Call `system_overview` and `list_brands`, then draft the brand. Choose:
   - `recipe`: the funnel type from `recipeGuide`, matched to the goal and the traffic. Cold phone traffic usually means `appointment` or `quiz`.
   - `layout`: the variant per section that suits their brand. Multi-step recipes use the `question` hero. Do not default to the last client's variants.
   - `content`: real copy from the client. Apply the `unslop` skill. No invented numbers, results or quotes. A quote without a named source and written permission, a story the client has not approved and a video not yet supplied all keep `"placeholder": true`.
6. **Brunson pass.** Load the `brunson-pass` skill and write `pass` into the brand file: hook, story and offer for every step from the ad to the result, at least two curiosity headlines, the doubt and the section that answers it, the offer stack (`confirmed` or `ask-client`), questions for the client, and an answer to every designer check. Then change the copy to match. A real client funnel does not build without it.
7. **Check.** Call `validate_brand` until there are no errors and you can explain every warning, then `write_brand`. Run `npm run build`. A failure names the field or contrast pair to fix. Fix the data, never the rule.
8. **Review.** Open `/<client>/system` and `/<client>/` in a browser at desktop and 390px wide. Tap through the whole question flow, including Back, the keyboard and the contact step. Take screenshots and put them on the Blueprint board for the designer's Keep / Change / Drop. Change only the brand file in response.
9. **Hand off.** Report the launch readiness list and send the Brunson pass questions to the client. Placeholders, the unconnected form, the booking calendar and a missing results page are not launch-ready. They belong to the backend.

## Rules the build enforces

- Every token is present and is a plain CSS value (`src/system/schema.ts`).
- Every section in the recipe has content, in recipe order, each with one conversion role and one hook/story/offer stage (`src/system/sections.ts`).
- Multi-step recipes put the first question in the hero; single pages never do.
- A question has 2 to 6 answers, a flow at most 6 questions, and the contact step at most two details including email or phone.
- A real video has captions and an allowed embed host.
- Text, muted text and button text meet WCAG AA contrast (`src/system/rules.ts`).
- The demo form and the question flow never claim a submission succeeded.

## Scanning other sites

The scanner reads public pages, one page per site at a time, and records bot checks as `blocked`. Never try to get past a bot check, a login or a site's terms. Scan output stays in `scans/`, which is not committed: it holds other companies' pages.

## What the build cannot check

Taste, brand fit, and whether the hook, story and offer are right. The designer decides those on the board, using the designer checks on the system sheet. A passing build is not approval.
