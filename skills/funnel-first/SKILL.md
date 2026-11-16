---
name: funnel-first
description: Build and judge conversion-first funnels the way the conversion system does. Write the funnel strategy (dream customer, where they are, hook, the belief that stops them, offer, who it is not for), choose the funnel type (lead magnet, appointment, quiz, VSL, webinar), apply hook, story, offer to every step, and scan competitors' funnels with code for their tokens, assets and block structure. Use for any landing page, funnel, opt-in, quiz, booking page, VSL or webinar page, for reviewing why a funnel is not converting, and for studying or scanning other funnels. Builds on Russell Brunson's seven steps and common multi-step funnel patterns.
---

# Funnel first

The page exists to get one yes. Looks serve that yes, never the other way round.

This skill drives the conversion system. Its MCP server (`conversion-system`) applies the same rules as the build.

For how each step is built (the blocks, their order and measured token values), load `funnel-blocks`.

## 1. Write the strategy before any page

Brunson's first steps, written into the brand file's `strategy` block. A page built without them is decoration.

| Field | Question |
|---|---|
| `dream_customer` | Who do we want, specifically? Not "small businesses". |
| `where_they_are` | Which podcasts, channels, groups and lists do they already follow? Traffic exists; we go to it. |
| `hook` | What stops their scroll? |
| `false_belief` | What do they believe that stops them buying? The page must answer it. |
| `offer` | What do they get for the first yes? |
| `not_for` | Who should leave? Saying it raises lead quality. |
| `second_yes` | What comes straight after the first yes? It is where the profit is. It belongs to the backend, but plan it now. |

Missing facts stay `UNKNOWN` and go to the client as questions. Never invent them.

## 2. Choose the funnel type from the goal and the traffic

Call `system_overview`; its `recipeGuide` is the source of truth.

| Goal | Traffic | Recipe | First ask |
|---|---|---|---|
| Email for a free resource | Warm | `lead-magnet` | Button to a one-field form |
| A qualified call or visit | Cold or warm, high-value service | `appointment` | One-tap question in the hero |
| Contact details for a personal result | Cold social | `quiz` | One-tap question in the hero |
| A call after persuasion | A belief blocks the sale | `vsl` | Watch, then a short form |
| Registration for a live session | One-to-many sells it | `webinar` | A button that names the date |

Meta ad traffic is mostly phones and cold. Default to `appointment` or `quiz` there.

## 3. Run the Brunson pass on every funnel

Every step of a funnel has a hook (stops them), a story (raises the value of the offer) and an offer (the trade: a click, an email, money). When a step fails, one of the three is wrong.

Load the `brunson-pass` skill and write the pass into the brand file as `pass`: hook, story and offer for every step from the ad to the result, at least two curiosity headlines, the doubt and the section that answers it, the offer stack, questions for the client, and an answer to every designer check. **A real client funnel does not build without it.** Then change the page copy to match the pass.

The system labels each section with its stage, and the system sheet (`/<client>/system`) shows the whole pass.

## 4. Patterns that recur in multi-step funnels

These are common patterns in funnel templates, not measured conversion results. Test them.

- The first ask is a tap, not a form. On multi-step funnels the first question sits in the hero.
- One question per screen, progress shown ("Question 2 of 4"), 2 to 6 answers that read at a glance.
- Qualifying questions (price range, role, budget) come before contact details.
- Contact details come last, framed as the last step, with at most two fields.
- A filter line pushes unserious visitors away ("only book if you are actually interested").
- The headline is a result, a curiosity gap or the visitor's own doubt. Brunson: if visitors think they already know what they get, ad costs rise and opt-ins fall.
- Proof sits next to the ask: logos under the form, a rating by the button.
- A founder story answers "who are we to promise this", below the first ask.
- The ask repeats down the page for people who needed the whole page.

## 5. Rules the build enforces

You cannot ship around these. Fix the data, never the rule.

- Every section in the recipe has content; multi-step recipes use the `question` hero and single pages never do.
- A question has 2 to 6 answers; a flow has at most 6 questions; the contact step asks for at most two details, including email or phone.
- A real video has captions and comes from youtube-nocookie.com or player.vimeo.com.
- Text, muted text and button text pass WCAG AA contrast. Token values cannot contain `; { } < >`.
- No invented numbers, results or quotes. A quote without a named source and written permission, a story the client has not approved and a video not yet supplied all stay `placeholder: true`, and the page shows the flag.
- The demo never claims a submission worked. The backend is a separate project; launch readiness lists what it still needs.

## 6. Run a client through the system

1. `extract_design_system` on the client's site (`npm run extract -- <url>`): their tokens, fonts, logo, component variants and every image, icon, video and font, as JSON and a CSV list. Then `capture_brand` with 1 to 3 of their pages for the 18 tokens. Show the designer every `inferred` and `default` token and any contrast error. Download their files only with their permission.
2. `system_overview`, `list_brands`, then write the strategy (step 1) and choose the recipe (step 2).
3. Draft the brand: tokens from the capture, layout variants that differ from the last client, the client's own copy through the `unslop` skill.
4. Run the Brunson pass (step 3 above) and change the copy to match it.
5. `validate_brand` until there are no errors and you can explain every warning. Then `write_brand`, then `npm run build`.
6. Open `/<client>/` and `/<client>/system` at 390px and desktop. Tap through the whole question flow. Put the funnel and the pass on the board for Keep, Change or Drop.
7. Report the launch-readiness list and send the pass's client questions. Placeholders, unconfirmed offer items, the unconnected form and the booking calendar are not launch-ready.

## 7. Study other funnels with code, not AI

AI per page is expensive; the scanner is not. Use it before writing a page, to see what competitors in the niche do.

- One to twenty pages: the `scan_funnels` tool, or the form at `http://127.0.0.1:4410/scans` (`npm run app`).
- Hundreds: `npm run scan -- urls.txt --concurrency 4`, then `npm run scan:report -- scans`.
- Each scan saves `scans/<id>.json` (schema `funnel-scan/1`): tokens, assets, first ask, headline type, block sequence, forms, proof, builder and tracking. The report counts what recurs.
- Pages behind a bot check come back `blocked`. Never try to get past one. Respect each site's terms; scanning the Meta Ad Library website is not allowed, so URL lists come from approved sources.
- Labels are heuristics from one page load. Check them against the screenshot before citing a number. To keep a funnel as a pattern, inspect it yourself, then `add_reference` (always saved as `candidate`; the designer curates).

## 8. Evidence

Keep FACT, OBSERVATION, INFERENCE, HYPOTHESIS and UNKNOWN apart. A template, a scan and a vendor's percentage are observations or claims, not conversion results. A passing build is not approval: taste and brand fit are the designer's call.

## Workflows in the Skills Atlas

- **Build a conversion-first funnel** (`funnel-build`): every client funnel and pitch funnel. The funnel is decided before the look.
- **Add a section or variant to the conversion system** (`system-variant`): when a funnel needs something the schema does not allow, such as a product-image hero or a results screen. Designed once, on Blueprint, then built into the system.
- **Landing page that converts** (`landing-page`): bespoke, design-led pages outside the system only, such as a brand launch or portfolio.

## Related skills

`brunson-pass` on every funnel (required), `conversion-design` for reference curation and templates, `copywriting` and `unslop` for the words, `offers` for the stack, `cro` for reviewing a live page, `ab-testing` once there is traffic.
