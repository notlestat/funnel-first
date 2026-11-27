# Funnel events

`FunnelEvents` in `src/system/events.ts` is the source for this table.

## Events

| Event | Sent when | Properties |
| --- | --- | --- |
| `funnel_viewed` | The funnel page loads. | None of its own |
| `cta_clicked` | A visitor clicks a button that jumps to the ask. | `location`: `hero`, `video` or `cta` |
| `flow_step_reached` | The question flow moves forward to a step. Not on first render, not on Back. | `step`: 1-based position in the flow, notes and the contact step included. `kind`: `question`, `note` or `contact` |
| `capture_attempted` | The flow's contact step or the email form passes validation. | `form`: `flow` or `capture`. `delivered`: always `false` until a form backend exists |
| `flow_back` | A visitor presses Back in the flow. | `from`: the step left. Not sent yet: the test is marked `todo` |

Every event also carries:

| Property | Value |
| --- | --- |
| `brand` | The brand id, from `data-funnel-brand` on `<main>` |
| `recipe` | The funnel type, from `data-funnel-recipe` on `<main>` |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | Read from the page URL when present. Trimmed and capped at 100 characters |

The design system sheet at `/<brand>/system` has no `data-funnel-brand` and sends nothing.

## Brand file field

| Field | Type | Rule |
| --- | --- | --- |
| `analytics.provider` | `"posthog"` | The only provider |
| `analytics.key` | string | Matches `posthogKey`: `phc_` and at least 10 letters or digits |
| `analytics.region` | `"eu"` or `"us"` | Sets the host: `https://eu.i.posthog.com` or `https://us.i.posthog.com` |

## PostHog settings

`posthogOptions()` in `src/system/analytics.ts` sets these:

| Setting | Value | Effect |
| --- | --- | --- |
| `persistence` | `memory` | No cookies, no local storage. Each page load is a new anonymous visitor. |
| `person_profiles` | `identified_only` | No person profiles, because nothing identifies anyone |
| `autocapture` | `false` | No automatic click or input capture |
| `capture_pageview`, `capture_pageleave` | `false` | `funnel_viewed` replaces the page view |
| `disable_session_recording` | `true` | No recordings |
| `disable_surveys` | `true` | No surveys |
| `disable_external_dependency_loading` | `true` | No extra scripts from PostHog's servers |
| `advanced_disable_flags` | `true` | No feature flag request |
| `save_campaign_params` | `false` | PostHog adds no campaign parameters of its own. The UTMs come from `track()` only. |
| `before_send` | `stripUrlQueries` | Every URL property, such as `$current_url` and `$referrer`, loses its query string and hash |

PostHog still adds its standard `$` properties to each event, such as browser, operating system, screen size, time zone, and the page URL without its query.

## Loading

`startPostHog()` loads `posthog-js` with a dynamic `import()`. The build puts PostHog in its own file, about 364 KB, or 124 KB gzipped. A page downloads that file only when its brand file sets `analytics`.
