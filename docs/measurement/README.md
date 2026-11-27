# Measure a funnel

Every funnel page records its events in the page: the view, button clicks, each step forward in the question flow, and form attempts. A brand file with an `analytics` field also sends those events to PostHog. Without the field, nothing leaves the page.

[events.md](events.md) lists every event and setting. [plan.md](plan.md) explains the design and what comes next.

## Turn on PostHog for a brand

1. In PostHog, create a project in the EU or US region and copy its project API key. It starts with `phc_`.
2. Add `analytics` to the brand file in `src/data/brands/<brand>.json`:

	```json
	"analytics": { "provider": "posthog", "key": "phc_...", "region": "eu" }
	```

3. Run `validate_brand` through the MCP server, or `npm run build`. A key that does not start with `phc_` fails with a message naming `analytics.key`.

The project key is public by design. It can send events but not read them, so it is safe in the page. A personal API key starts with `phx_`, can read the whole project, and must never go in a brand file. The schema refuses it.

`launch` in the `validate_brand` result lists "analytics not set, nothing is measured" until the field is there.

## See what a funnel sends

1. Run `npm run build`, then `npm run preview`.
2. Open a funnel with UTM tags, for example `/ironwood-coaching/?utm_source=test`.
3. Tap through the page, then run `window.__funnelEvents` in the browser console.

Each entry has the event `name` and its `props`, with `brand`, `recipe` and any UTMs added. The same list goes to PostHog when the brand has `analytics`.

## Run the tests

`test/events.test.ts` holds the measurement tests. Run them with:

```sh
	node --test test/events.test.ts
```

The browser tests need `npm run build` first and Google Chrome, and skip without them. One test builds a throwaway copy of `ironwood-coaching` with a test key and answers every PostHog request itself, so nothing reaches PostHog. It checks the events that arrive, that no query string leaves the page, and that nothing is stored in the browser.

PostHog drops events from browsers that say they are automated, so that test sets a normal user agent and hides `navigator.webdriver`. Real bots get filtered the same way.

## Add an event

1. Add the event and its properties to `FunnelEvents` in `src/system/events.ts`.
2. Call `track()` from the section where it happens. The type checker refuses an event name or property that `FunnelEvents` does not list.
3. Add a row to [events.md](events.md) and a browser test to `test/events.test.ts`.

Never send answer text, names, emails or phone numbers. Send step numbers and fixed labels only.
