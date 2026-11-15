# How to capture a client's brand

You need Node.js 22.18 or later and Google Chrome. The capture opens Chrome without a window.

## Capture the site

1. In the `conversion-system` folder, run `npm run app`. The terminal prints `Brand capture: http://127.0.0.1:4410`.
2. Open http://127.0.0.1:4410.
3. Type a client id in lowercase with hyphens, for example `acme-dental`. Use the same id the client's brand file has or will have.
4. Paste the main landing page URL.
5. If the site has other page templates, open "Add up to two pages that use different templates" and add them. Values seen on every page count as stronger evidence.
6. Select **Capture**.

The status line counts the seconds. The two test sites took about one second each. Heavier sites take longer.

When it finishes, the capture evidence is in `src/data/captures/<client-id>.json`.

## Check the tokens

Each token shows a badge and the evidence behind it:

| Badge | Meaning |
|---|---|
| measured | Seen on every page at both widths, or the value matches a CSS variable the site declares |
| recurring | Seen more than once |
| inferred | A best guess. Check it |
| default | No evidence on the page. The system fallback |
| edited | You changed it. The row keeps the original value and its evidence |

Start with the inferred and default rows. Then check text and muted colours against the site, because the engine gets those wrong most often.

The preview on the right uses only the tokens, so a wrong token shows up there straight away.

## Fix a wrong colour

To use a colour from the client's site:

1. Select **Swap** on the colour row.
2. Select a colour under "Colours on their site".

To use any other colour, type a hex value in the row, or use the colour picker.

## Fix any other token

Type the new value in the row. The page refuses values that contain `;`, `{`, `}`, `<`, or `>`.

## Save

The Contrast panel checks every text and button pair after each change. If a pair fails, the panel names it and **Save tokens** stays disabled until you fix it.

- Select **Save tokens** to store the approved tokens on the capture record.
- If a brand file with this id already exists, you can select **Save and apply to brand** instead. It replaces only the brand's tokens and its Google Fonts link. The copy, recipe, and layout stay as they are.

After you save, **tokens.css** and **tokens.json** download the tokens as CSS variables and in the W3C design tokens format.

## If there is no brand file yet

The capture has no copy, so the page does not create a brand file. Ask the agent to draft one with the approved tokens and the client's own copy, then run `validate_brand` and `write_brand`.

## If the fonts look wrong in the preview

If the client's fonts are not on Google Fonts, the page says so and the preview uses the next font in each stack. The fonts may be self-hosted or licensed. Ask the client before you use them.
