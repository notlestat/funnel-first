# Brand capture next steps

## Decide first

**Which tool does the team want?** A capture for funnels fills the 18 tokens a landing page needs, and it works today. A full brand inventory records a client's whole design system to keep and hand over. The answer decides most of the work below. [coverage.md](coverage.md) compares the two.

**Commit the work.** The repository has no commits. Commit the current state on a branch before adding more.

## Engine fixes

These come from testing the capture on a public site that publishes its design system.

1. Prefer declared variable names for text colours. When two text colours are close in character count, pick the one whose declared variable name contains `text` or `foreground`.
2. Ignore declared variables with `print` in the name when upgrading a token to "measured".
3. Find an evidence source for `space-block`. It always falls back to the default.

## Review page

1. Add a Reset button to each edited row that restores the original value. The original is already in `state.proposal`.
2. Show a "Declared by the site" panel listing the captured CSS variables.
3. Include the declared variables in the exports, outside the 18 tokens.
4. Stream the desktop result first and fill in the phone pass after, if heavier sites turn out slow.
5. Accept pasted HTML as a fallback, with a warning that relative stylesheets will not load.

## Full brand inventory

If the team wants the full inventory, add these to `collect.ts` as new roles, stored in the capture and kept out of the brand contract:

1. Link and focus colours.
2. Error, success, and warning colours.
3. Line heights and letter-spacing per text role.
4. Shadows and border widths.
5. Hover and focus states of the primary button. This needs the capture to hover and focus each button before it reads the styles.

## Shared schema

Add the token-value check from `capture/app.ts` to `tokensSchema` in `src/system/schema.ts`. The MCP server's `write_brand` then refuses CSS-breaking values too.

## Workflow

Add a "Brand capture" workflow to the skills atlas, in `data/workflows.json`, once the uncommitted changes there are sorted.
