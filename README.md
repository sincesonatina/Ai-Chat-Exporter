# AI Chat Exporter

Browser extension that exports the open ChatGPT (later Claude) conversation to `.txt`, `.md` and `.pdf`, locally in the browser.
See [the design doc](./Chat%20Exporter%20Extension%20—%20Design%20Doc.md) for the phase plan.

## Develop

Requires Node 24 (`.node-version`) and pnpm.

```sh
pnpm install
pnpm dev        # opens Chrome with the extension loaded and hot reload
pnpm test       # Vitest + happy-dom
pnpm compile    # typecheck
pnpm build      # production build → .output/chrome-mv3 (Load unpacked in chrome://extensions)
```

## Layout

Pipeline: **Extract → Normalize → Filter → Render → Deliver**

| Path | Role |
| --- | --- |
| `lib/model.ts` | `Conversation` / `Message` / `Block` — the only thing renderers see |
| `lib/adapters/` | one `SiteAdapter` per site; selectors in `chatgpt/selectors.ts` only |
| `lib/extract/` | DOM → blocks (Turndown + GFM, KaTeX → TeX), lazy-load scrolling, normalize, filter |
| `lib/render/` | `.txt`, `.md` renderers and file naming |
| `entrypoints/chatgpt.content.ts` | content script — reads the page on request |
| `entrypoints/background.ts` | runs export jobs and downloads files |
| `entrypoints/popup/` | format picker + Export button |
| `tests/` | renderer snapshots (`tests/expected/`) and adapter tests on saved HTML (`tests/fixtures/`) |
