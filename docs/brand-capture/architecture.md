# Brand capture architecture

## Files

| File | Job |
|---|---|
| `capture/app.ts` | Local HTTP server for the review page. Serves the page and four JSON routes |
| `capture/app.html` | The review page. Plain HTML and JavaScript, no build step |
| `capture/index.ts` | `capture()`: collects evidence, proposes tokens, stores the record |
| `capture/collect.ts` | Opens the pages in Chrome and records computed styles by role |
| `capture/propose.ts` | `propose()` turns evidence into tokens. `palette()` lists every solid colour seen |
| `mcp/store.ts` | Reads and writes JSON under `src/data/`. Swappable for a database later |
| `src/system/rules.ts` | `contrastErrors()` |
| `src/system/validate.ts` | `validateBrand()` and the id pattern `slug` |
| `src/system/export.ts` | `toCss()` and `toDtcg()` |

`capture/app.ts` adds no extraction logic. Each route calls code the MCP server and the build already use, so a token that passes the page passes the build.

## Data flow

```
URL ─► POST /api/capture ─► capture() ─► src/data/captures/<id>.json
                                    └──► proposal + palette ─► review page
review page edits ─► POST /api/check ─► contrastErrors()
Save ─► POST /api/save ─► capture record gets "approved"
                      └─► (apply) validateBrand() ─► src/data/brands/<id>.json
```

## Routes

| Route | Body | Returns |
|---|---|---|
| `GET /` | | The review page |
| `POST /api/capture` | `id`, `urls` (1 to 3) | Tokens with confidence and source, palette, limitations, Google Fonts link, whether a brand exists |
| `POST /api/check` | `tokens` | `contrastErrors` |
| `POST /api/save` | `id`, `name`, `tokens`, `fontsHref`, `applyToBrand` | Edited token names, the applied brand file and warnings, CSS and DTCG exports |

## The saved record

`POST /api/save` adds an `approved` object to `src/data/captures/<id>.json`:

```json
"approved": {
	"tokens": { "color-text": "#0B0C0C", "...": "..." },
	"fontsHref": "https://fonts.googleapis.com/...",
	"edited": ["color-text", "color-muted"],
	"approved_at": "2026-11-14"
}
```

The original proposal stays in the same file, so anyone can see what the engine found and what a person changed.

## Settings

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `4410` | Port for the review page |
| `CONVERSION_DATA_DIR` | `src/data` | Where captures and brands are read and written |

## Security checks

The server listens on `127.0.0.1` only. Other machines cannot reach it.

Any website open in the same browser can still send requests to `127.0.0.1`. The server blocks that in two ways:

- Every POST must carry an `Origin` header of `http://127.0.0.1:<port>` or `http://localhost:<port>`.
- Every POST must be JSON. A cross-site JSON request triggers a CORS preflight check, and the server never approves one.

The server also checks every input:

- Client ids must match `slug`, so a path such as `../etc` is refused.
- `collect()` accepts only `http` and `https` URLs, so `file://` is refused.
- Token values must be 1 to 200 characters with no `;`, `{`, `}`, `<`, or `>`, so an edited value cannot break out of the CSS.
- `fontsHref` must start with `https://fonts.googleapis.com/`.
- Request bodies are limited to 100,000 bytes.
- Brand names lose `*/`, `<`, and `>` before they go into the CSS comment.

The page writes everything it reads from a client's site with `textContent` or `.value`, never `innerHTML`. A hostile site cannot inject markup through a font name or a colour.

The shared brand schema in `src/system/schema.ts` does not have the token-value check. A brand written through the MCP server can still contain a value that breaks the CSS. See [next-steps.md](next-steps.md).
