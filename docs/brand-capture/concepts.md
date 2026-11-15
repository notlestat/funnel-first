# Concepts behind the brand capture page

These are the ideas the build used, with the code that shows each one. They were explained during the build. Explaining them is not the same as being able to use them unaided, so the exercises at the end check that.

## Computed styles, not source CSS

A browser combines every stylesheet, inline style, and default, then settles on one final value per property per element. `getComputedStyle(el)` returns that final value. The capture reads computed styles, which is why it works on any site regardless of how the CSS was written. It is also why it needs a real browser and a live URL. See `readPage()` in `capture/collect.ts`.

## Evidence, then decisions

`collect.ts` only records what it saw and how often. `propose.ts` makes the decisions, and it is a pure function: no browser and no files. That split is why `propose()` can be tested with made-up evidence in `test/propose.test.ts`, and why a person can see where every token came from.

## How Node runs TypeScript

Node 22.18 and later runs `.ts` files by deleting the type annotations and running what is left. It cannot handle TypeScript syntax that produces JavaScript of its own. `constructor(public status: number)` creates a field, so Node refused to start the server. The fix in `HttpError` declares the field and sets it inside the constructor.

## Localhost is not private from the browser

The server listens on `127.0.0.1`, so other machines cannot reach it. Any website open in your browser can still send requests to it. `assertSameOrigin()` in `capture/app.ts` blocks those by checking the `Origin` header and requiring JSON. A cross-site JSON request makes the browser ask permission first, in a CORS preflight request, and the server never grants it.

## Never trust text from someone else's page

Font names and colours come from the client's website. If the page put them in with `innerHTML`, a hostile site could inject markup. `capture/app.html` uses `textContent` and `.value` everywhere it shows captured data.

## Test against a known answer

A site that publishes its colours lets a test say "wrong" with certainty instead of "looks off". Pick test targets whose answers you already have.

## One test site is not enough

The Google Fonts bug only appears on sites that use Google Fonts. The first test site self-hosts its fonts, so it passed. Harbour Physio does, so it crashed. Choose test sites that exercise different paths through the code.

## Prediction exercise

In `palette()` in `capture/propose.ts`, the test expects `#111111` to have `count: 22`. Look at the `base` evidence in `test/propose.test.ts` and work out where 22 comes from before you run the test.

## Try these yourself

1. Add a Reset button to each edited row in `capture/app.html`. The original value is in `state.proposal[name].value`. Call `edit(name, value)` after you set the inputs.
2. Make `color-text` in `capture/propose.ts` prefer a text colour whose declared variable name contains `text`. Write the failing test in `test/propose.test.ts` first: black text with more characters than a near-black text colour whose variable is named `--brand-text-colour`.
