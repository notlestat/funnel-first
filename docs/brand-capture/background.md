# About the brand capture page

## The request

On 13 November 2026 a teammate asked for a workflow that captures a client's existing brand system and stores it as design tokens. They wanted it clickable, like Blueprint, and close to instant: point it at a site's HTML and get the design system back.

## What already existed

The capture engine was built earlier the same day. It already did the hard part:

- `capture/collect.ts` opens 1 to 3 pages in Chrome at 1440 by 900 and 390 by 844 pixels and records the styles the browser applies, grouped by role.
- `capture/propose.ts` turns that evidence into the 18 tokens the system uses and labels each one with how sure it is.
- `src/pages/[brand]/system.astro` shows the design system sheet, and `tokens.json.ts` and `tokens.css.ts` export the tokens.

Running it needed a terminal or an agent. The missing piece was a page someone could click through.

## Why a separate page, not a Blueprint feature

Blueprint is a general whiteboard for designing with an agent. If it learned this project's token schema, it would be tied to one project. The review page copies Blueprint's pattern instead: a small local server and one page in the browser. The two tools stay independent.

## Why the page does not create brand files

A brand file needs a headline, benefits, FAQs, and a capture form, and a website capture has none of that copy. Writing placeholder copy into a brand would put invented text one step away from a live page. So the page saves approved tokens on the capture record, and it changes a brand file only when that brand already exists. Even then it replaces only the tokens.

## Why a URL and not pasted HTML

Tokens come from computed styles, and computed styles need the page's CSS. A live URL brings its CSS with it. Pasted HTML usually links stylesheets by relative path, so it renders without the brand. Pasted HTML could work as a fallback with a warning, but it is not built.

## Why "instant" is the wrong promise

A capture opens Chrome and loads each page twice. The two test sites took about one second each, but a heavy commercial site with large scripts takes longer. The status line counts the seconds so nobody wonders whether it froze.

## Why only 18 tokens

The landing-page sections may style themselves only with the 18 tokens in `src/system/tokens.ts`. That limit keeps every client's page consistent and lets the build enforce contrast. It also means the capture is not a full record of a client's design system. [coverage.md](coverage.md) lists what it leaves out.
