# Agent brief: conversion system

This repo turns a client's brand into a conversion-first design system and landing page. The system is already built. Your job for a client is to write one data file, not code.

## What you may change

| Path | You | Who else |
| --- | --- | --- |
| `src/data/brands/<client>.json` | Create and edit | |
| `src/data/references/<id>.json` | Add after inspecting the real page | Designer approves `curated` |
| `src/data/captures/<client>.json` | Written by `capture_brand` only | |
| `src/sections/`, `src/system/`, `src/layouts/`, `src/pages/`, `src/content.config.ts` | Do not edit | Designer, when a new section or variant is needed |

If a client needs something the schema does not allow, stop and say which section or variant is missing. Do not work around the schema.

## Tools

Use the `conversion-system` MCP server (registered in `.mcp.json`, run with `npm run mcp`). Write brand and reference files through it, not by hand: it applies the same rules as the build before anything is saved.

| Tool | Use it to |
| --- | --- |
| `system_overview` | Read recipes, sections, roles, variants, tokens and rules. Start here. |
| `capture_brand` | Read a client's live site and propose their tokens, with evidence. |
| `search_references` | Find references by funnel type, conversion role, status or words. |
| `add_reference` | Save a page you inspected. Always saved as `candidate`. |
| `list_brands`, `get_brand` | See existing clients, so the new one looks different. |
| `validate_brand` | Check a draft. Errors block saving; warnings flag conversion risks and look-alike clients. |
| `write_brand` | Save the brand file and get the pages to review. |

## Run a client through the system

1. **Their brand.** Collect the live site, brand guidelines if any, and existing pages. Note what you could not access.
2. **Capture the brand.** Call `capture_brand` with the client id and 1 to 3 of their pages. It saves the evidence and returns a token for every name in `src/system/tokens.ts`, each marked `measured`, `recurring`, `inferred` or `default`. Show the designer every `inferred` and `default` token and any contrast error. Never quietly change a client's colour to pass a rule. For a written brand document as well, run the `create-design-md` skill on the same pages.
3. **Write the brand file.** Call `system_overview` and `list_brands`, then draft the brand. Choose:
   - `recipe`: the funnel type for the client's goal.
   - `layout`: the variant per section that suits their brand. Do not default to the same variants as the last client.
   - `content`: real copy from the client. Apply the `unslop` skill. No invented numbers, results or quotes. A quote without a named source and written permission keeps `"placeholder": true`.
4. **Check.** Call `validate_brand` until there are no errors and you can explain every warning, then `write_brand`. Run `npm run build`. A failure names the field or contrast pair to fix. Fix the data, never the rule.
5. **Review.** Open `/<client>/system` and `/<client>/` in a browser at desktop and 390px wide and take screenshots. Put them on the Blueprint board for the designer's Keep / Change / Drop. Change only the brand file in response.
6. **Hand off.** Report the launch readiness list from the system sheet. Placeholders and the unconnected form are not launch-ready.

## Rules the build enforces

- Every token is present (`src/content.config.ts`).
- Text, muted text and button text meet WCAG AA contrast (`src/system/rules.ts`).
- Sections appear in recipe order, each with one conversion role (`src/system/sections.ts`).
- The demo form never claims a submission succeeded.

## What the build cannot check

Taste and brand fit. The designer decides those on the board. A passing build is not approval.
