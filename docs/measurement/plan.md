# Measurement plan

Status: steps 1 to 4 are built on `feat/measurement`. The `flow_back` call is still open, and its test is marked `todo`. [README.md](README.md) says how to use it and [events.md](events.md) lists every event and setting.

## The question v1 answers

For any brand: where do visitors come from, and at which step do they drop?

Neither form sends anything yet. `Capture.astro` and `Flow.astro` are demo-only, and the build forbids them from claiming a submission worked. So v1 measures intent and drop-off, not leads. A real conversion count needs the backend that saves each lead, which is later work.

## Events

| Event | When | Properties |
| --- | --- | --- |
| `funnel_viewed` | The funnel page loads | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` when present |
| `cta_clicked` | A button that jumps to the ask | `location`: `hero`, `video` or `cta` |
| `flow_step_reached` | Each question, note or contact step is shown | `step`, `kind` |
| `capture_attempted` | The contact or email form passes validation | `form`: `flow` or `capture`, `delivered: false` |
| `flow_back` | Back is pressed | `from` |

Every event also carries `brand` and `recipe`.

`delivered: false` is a literal type. It can't be set to `true` until a backend exists and the contract changes.

## Privacy rules

- No answer text, names, emails or phone numbers go to analytics. A physio quiz answer can be health data. Steps travel as numbers.
- Only the five UTM keys are read from the URL. Each value is trimmed and capped at 100 characters. Nothing from the URL is written into the page.
- Nothing is stored in the browser. A funnel is one page, so the UTMs stay in the address bar for the whole visit.
- Check current ICO guidance on analytics consent before a client launch. This plan has not verified it.

## Provider: PostHog

Chosen on 27 November 2026. The reasons are its built-in funnel charts and its session recordings, which Orion can import for predicted gaze on the same visits.

v1 settings:

- `persistence: 'memory'`, so PostHog writes no cookies and no local storage.
- `autocapture: false`. Autocapture would record click and input text, which breaks the privacy rules above.
- `disable_session_recording: true`. Recordings capture far more than events and need their own consent decision. They come after v1, with inputs masked.
- Load `posthog-js` with a dynamic `import()` only when the brand file sets `analytics`. A brand without it downloads none of PostHog's code.
- `save_campaign_params: false`, so the capped UTMs from `track()` are the only copy.
- `before_send: stripUrlQueries`, which removes the query string and hash from every URL PostHog attaches.
- An EU or US region, chosen in the brand file.

## Files

| File | Job |
| --- | --- |
| `src/system/events.ts` (new) | The event contract, the UTM reader and `track()`. Sections can't send an event name the contract doesn't list. |
| `src/pages/[brand]/index.astro` | Puts `brand` and `recipe` on `<main>` and fires `funnel_viewed`. The system sheet never fires events. |
| `src/sections/Flow.astro`, `Capture.astro`, `Cta.astro`, `Hero.astro`, `Video.astro` | One `track()` call at each moment in the event table. |
| `src/system/analytics.ts` (new) | The PostHog sink: regions, the key rule, `posthogOptions()`, `stripUrlQueries` and `startPostHog()`. |
| `src/system/schema.ts` | Optional `analytics: { provider: 'posthog', key, region }` in the brand file. |
| `src/system/rules.ts` | `launchChecks` lists a brand with no `analytics` as not launch-ready. |
| `qa/` and `test/` | A unit test for the UTM reader. A browser test that taps through a quiz and checks the event order. |
| `docs/measurement/README.md`, `AGENTS.md` | The event table and who may change what. |

## Build order

Each step ends in something you can check.

1. `events.ts` with an in-memory sink, plus `funnel_viewed` with UTMs. Check: open `/ironwood-coaching/?utm_source=test` and read `window.__funnelEvents`.
2. Wire the other four events. Check: the browser test passes on a quiz, an appointment and a lead-magnet brand.
3. Schema field, host rule, launch check and the PostHog sink. Check: `npm run build` passes, the launch list flags brands with no analytics, and PostHog's code only loads when the field is set.
4. Docs and the `AGENTS.md` row.

## What changed from the plan

- The brand file names a region, `eu` or `us`, instead of a host. A wrong host can't be written, so the host allowlist in `rules.ts` was not needed.
- Decoding a real PostHog request showed that PostHog adds `$current_url`, `$session_entry_url` and `$referrer` with the full query string. A link with `?email=...` would have sent the email. `stripUrlQueries` fixes it, and a browser test fails if a query string or the email leaves the page.
- PostHog drops events from automated browsers. The test that checks a real send sets a normal user agent and hides `navigator.webdriver`.

## Later

- Form delivery: a small backend that saves each lead with its UTMs. It becomes the source of truth for conversion counts.
- "How did you hear about us?" fits as an ordinary flow question with no code change.
- Session recordings with masking and a consent decision, then the Orion import.
- A drop-off dashboard from PostHog's export, which is where SQL comes in.
- Before a client launch, check PostHog's project settings for how it handles IP addresses. This plan has not checked them.
