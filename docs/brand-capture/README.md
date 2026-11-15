# Brand capture

Brand capture reads a client's live website in Chrome and turns what it renders into design tokens for the conversion system. A local review page lets you check each token, fix the wrong ones, and save them.

Start the review page:

```sh
npm run app
```

Then open http://127.0.0.1:4410.

## Status

- The review page works. It was tested end to end on a public site that publishes its design system, and on the Harbour Physio sample brand.
- Nothing is committed. The repository has no commits yet.
- The engine can still pick a text colour wrong when two are close in use. [next-steps.md](next-steps.md) has the fix.

## Files in this folder

| File | What it covers |
|---|---|
| [how-to-capture.md](how-to-capture.md) | How to capture a brand, fix tokens, and save them |
| [background.md](background.md) | The request, what already existed, and why the page works the way it does |
| [architecture.md](architecture.md) | Files, routes, data flow, and the security checks |
| [coverage.md](coverage.md) | Which tokens the capture finds and which parts of a design system it misses |
| [next-steps.md](next-steps.md) | Open decisions, engine fixes, and small tasks to try |
| [concepts.md](concepts.md) | The ideas behind the code, for learning |
| `screenshots/` | The review page after a capture of a sample brand |

## Other ways to run a capture

The review page is one of three ways to run the same capture code:

- The review page: `npm run app`.
- The command line: `npm run capture -- <client-id> <url> [url] [url]`.
- An agent, through the `capture_brand` tool on the project's MCP server (`mcp/server.ts`).
