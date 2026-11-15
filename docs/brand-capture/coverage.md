# What brand capture covers

Brand capture fills the 18 tokens in `src/system/tokens.ts`. It does not record a client's whole design system.

## Captured

| Area | Tokens and evidence |
|---|---|
| Colour | `color-bg`, `color-surface`, `color-text`, `color-muted`, `color-accent`, `color-on-accent`, `color-border` |
| Type | `font-display`, `font-body`, `weight-display`, `size-hero`, `size-heading`, `size-body`, `size-small` |
| Space and shape | `space-section`, `space-block`, `radius`, `measure` |
| Palette | Up to 16 solid colours seen on the pages, most-used first, with the roles each played |
| Declared variables | Up to 150 CSS custom properties declared on `:root` or `html` in readable stylesheets |
| Fonts | The Google Fonts stylesheet link, if the site uses one |

Sizes are fluid `clamp()` values built from the desktop and phone measurements.

`space-block` always falls back to the default. The engine has no evidence source for it yet.

## Not captured

| Area | Missing |
|---|---|
| Colour | Link colour, focus colour, error, success, and warning colours, hover colours, tint and shade scales, dark mode |
| Type | h3 to h6 sizes, line heights, letter-spacing, uppercase styles, weights other than display, font files, font licences |
| Space and layout | The spacing scale, gaps, grids, breakpoints |
| Surfaces | Shadows, border widths, more than one corner radius |
| Motion | Durations and easing |
| Components | Secondary and ghost buttons, inputs, cards, navigation, hover, focus, and disabled states |
| Brand beyond CSS | Logo, icons, photography, illustration, tone of voice, layout patterns |
| Intent | The client's own token names and the reasons behind them |

The capture reads each page once at load, without interaction, so it never sees a hover or focus state.

## Coverage limits

- 1 to 3 pages, at 1440 and 390 pixels wide.
- Pages behind a login are out of reach.
- CSS variables in stylesheets from another domain cannot be read. The capture logs a limitation when this happens.
- A cookie banner or pop-up on load can add its own colours to the evidence.

## The declared variables

For a site that uses CSS variables, the declared list holds most of its real token system. One public design system tested declared 104. The capture stores the list as evidence. The review page does not show it, and the exports do not include it.

## Two different tools

A brand capture for funnels fills the 18 tokens a landing page needs. That is the tool built today.

A full brand inventory would record everything listed under "Not captured" that CSS can reveal, and export it as a complete token file. It would sit outside the 18-token contract, so the landing-page sections stay simple. [next-steps.md](next-steps.md) splits that work into steps.
