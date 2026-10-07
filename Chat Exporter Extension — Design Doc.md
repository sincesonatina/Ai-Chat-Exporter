# Chat Exporter Extension — Design Doc

Oct 7, 2026 · @Golf

## Overview

One browser extension, built in six phases, turns an open ChatGPT (later Claude) conversation into a .txt, .md or .pdf file, then sends it to Notion or Apple Notes. All extraction and rendering run locally in the browser; chat content leaves the device only when the user sends it to Notion or shares it to Notes.

| Phase | What ships | Output |
| --- | --- | --- |
| 1 | ChatGPT text export with "You:" and "Response:" labels | .txt, .md, .pdf |
| 2 | Pictures included in the PDF | .pdf (and .md + images as a .zip) |
| 3 | Choose which messages to export | all formats |
| 4 | Claude.ai conversations | all formats |
| 5 | Send to Notion | Notion page |
| 6 | Send to Apple Notes on iPhone and iPad | Note via share sheet or Shortcut |

**Browsers:** Chrome, Edge and Brave (Manifest V3) from phase 1; Firefox after phase 4; Safari for macOS and iOS in phase 6.

**Users:** people who want to keep, share or study a single AI conversation, including Thai-language chats, so Thai text must render correctly in every format.

**Not in scope:** exporting the whole account history (ChatGPT and Claude both offer an account data export for that), editing chats, and storing chats on our own server.

## Architecture

Every export runs the same five-step pipeline, so each phase adds an adapter, a renderer or a destination without touching the rest: **Extract → Normalize → Filter → Render → Deliver.**

| Component | Runs in | Job |
| --- | --- | --- |
| Site adapter (content script) | the chatgpt.com or claude.ai tab | Finds messages in the page, reads text, code, tables, math and images, returns one `Conversation` object; injects selection checkboxes in phase 3 |
| Popup | toolbar popup | Format picker, options, Export button, progress; hands the job to the background so closing the popup does not cancel it |
| Service worker | extension background | Coordinates jobs, fetches images with host permissions, calls the Notion API, saves files through `chrome.downloads` |
| Offscreen document | hidden extension page | Runs renderers that need a DOM or canvas: HTML to Markdown, PDF building, image re-encoding |
| Options page | extension page | Labels, default format, file name pattern, PDF font, Notion connection |

**Normalized data model** — every adapter outputs this and every renderer reads only this:

```ts
type Role = 'user' | 'assistant';

interface Conversation {
  platform: 'chatgpt' | 'claude';
  title: string;
  url: string;
  exportedAt: string;          // ISO time in the user's time zone
  messages: Message[];
}

interface Message {
  id: string;                  // stable id from the page, or index
  role: Role;
  blocks: Block[];
  selected: boolean;           // phase 3; true by default
}

type Block =
  | { kind: 'paragraph'; markdown: string }
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; language?: string; code: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'math'; tex: string; display: boolean }
  | { kind: 'image'; src: string; alt?: string; data?: Blob }; // phase 2
```

**Adapter contract** — adding a site (Claude in phase 4, Gemini later) means writing one of these:

```ts
interface SiteAdapter {
  id: Conversation['platform'];
  matches(url: URL): boolean;
  getTitle(): string;
  getMessageElements(): Element[];
  getRole(el: Element): Role;
  toBlocks(el: Element): Block[];
}
```

**Tech stack**

- [WXT](https://wxt.dev) (TypeScript + Vite) as the extension framework: one codebase builds Chrome, Firefox and Safari packages, which phase 6 needs.
- Turndown + its GFM plugin to turn message HTML into Markdown; a small Markdown-to-plain-text step for .txt.
- pdfmake for direct PDF download, with an embedded Thai-capable font (Sarabun or Noto Sans Thai) plus Noto Sans for Latin and a monospace font for code.
- JSZip for the Markdown + images bundle (phase 2).
- Plain `fetch` to the Notion API from the service worker (phase 5).

**Selectors live in one config file per site**, never scattered through code. ChatGPT currently marks each turn with a `data-message-author-role` attribute; Claude's markup must be checked when phase 4 starts. Both sites change their HTML without notice, so every selector has a fallback and a nightly test (see Cross-cutting).

## Flowchart

&#91;embedded content: export flowchart · 3 decisions, 4 destinations\]

Unsupported pages stop at the first check; the two dashed steps run only when the user turns on selection or pictures, and every destination ends on the same result screen.

## Swimlane chart

&#91;embedded content: swimlane · 5 lanes, 13 steps\]

Steps 7, 9 and 10 run in the background, so closing the popup never cancels an export; the content script only reads the page.

## Phase 1 — ChatGPT text export (.txt, .md, .pdf)

Phase 1 exports the open ChatGPT chat as text only: every prompt starts with "You:" and every answer with "Response:", in the format the user picks.

**User flow**

1. Open a chat on chatgpt.com and click the extension icon.
2. The popup shows the chat title, number of turns, a format choice (TXT · MD · PDF) and an Export button.
3. The file downloads as `<chat-title>_<YYYY-MM-DD>.<ext>` (pattern editable in Options).

**Extraction rules**

- Turns are found by their role attribute; the role decides the label.
- Exported: the version of each message currently on screen (when a prompt was edited or an answer regenerated).
- Skipped: Copy, Like and Regenerate buttons, version switchers, hidden tool messages, and reasoning panels (an option, off by default).
- Citations become Markdown links in .md and plain URLs in .txt.
- Math is read from KaTeX's TeX annotation, so formulas export as `$…$` source instead of garbled glyphs.
- Pictures become an `[Image: alt text]` placeholder until phase 2.
- If older turns lazy-load, the adapter scrolls to the top and waits until the turn count stops changing (10-second limit).

**.txt format** — UTF-8, Markdown symbols removed, code kept as-is under a `[code: python]` tag:

```
ChatGPT conversation: Trip plan for Chiang Mai
Exported: 2026-10-07 10:39 (UTC+07:00)
Link: https://chatgpt.com/c/...
========================================

You:
Plan 3 days in Chiang Mai.

Response:
Day 1 - Old City temples
- Wat Phra Singh in the morning
...

----------------------------------------

You:
...
```

**.md format** — headings, lists, tables (GFM) and fenced code with language kept:

```markdown
# Trip plan for Chiang Mai

> Exported from ChatGPT · 2026-10-07 10:39 (UTC+07:00) · [open chat](https://chatgpt.com/c/...)

**You:**

Plan 3 days in Chiang Mai.

**Response:**

### Day 1 – Old City temples
- Wat Phra Singh in the morning

---
```

**.pdf format** — selectable text, not screenshots:

- A4 by default (Letter in Options), 18 mm margins, title block at the top, page number and chat title in the footer.
- "You:" turns sit in a light grey box; "Response:" turns are plain, so the reader sees who spoke at a glance.
- Code in a monospace font on a shaded box with wrapped lines; tables drawn as real tables.
- Thai: the Thai font is embedded, and zero-width spaces are inserted between Thai words using `Intl.Segmenter('th', { granularity: 'word' })`, because Thai has no spaces and PDF libraries only break lines at spaces.
- Two buttons: **Download PDF** (pdfmake, one click) and **Print view** (opens a styled page and the browser's Save as PDF dialog). Print view is the fallback for anything pdfmake renders poorly, such as colour emoji.

**Options:** label text (default "You:" / "Response:"), default format, file name pattern, include header (title, date, link), paper size.

**Permissions:** `activeTab`, `scripting`, `storage`, `downloads`, `offscreen`; host access to `https://chatgpt.com/*`.

**Done when**

- [ ] Every user turn starts with "You:" and every answer with "Response:" in all three formats
- [ ] Thai, English, lists, tables, code and math survive in all three formats
- [ ] A 100-turn chat exports in under 3 seconds on a mid-range laptop
- [ ] Files open correctly in Notepad / TextEdit, VS Code / Obsidian, and Acrobat / Preview

## Phase 2 — PDF with pictures

Phase 2 puts every picture in the chat into the PDF, in place, under the turn it belongs to: images the user uploaded and images ChatGPT generated.

**How pictures are collected**

1. The adapter records each image's URL, alt text and position as an `image` block.
2. The content script cannot fetch them itself: content scripts follow the page's cross-origin rules, and drawing a cross-origin `<img>` onto a canvas taints it. So the image URLs go to the service worker, which fetches them with host permission for OpenAI's file domains.
3. The offscreen document decodes each image with `createImageBitmap`, scales it to at most 1600 px wide, and re-encodes it as JPEG (photos) or PNG (images with transparency). pdfmake only embeds JPEG and PNG, so WebP and GIF are always converted.
4. Images are fetched four at a time with a progress bar; one failure never stops the export.

**Layout in the PDF**

- Image fills the text width at most, keeps its aspect ratio, never splits across pages.
- Alt text or the prompt (for generated images) appears as a small caption under it.
- An image whose link expired or failed to load becomes a grey box reading "Image unavailable" with its alt text.

**Other formats get pictures too**

- **.md:** choose *Bundle as .zip* (`chat.md` + `images/001.jpg`…, with relative links) or *Embed* (base64 data URLs in one file, larger but self-contained).
- **.txt:** placeholder `[Image 3: alt text]` stays, since plain text cannot hold pictures.

**Options:** include images (on), max image width, JPEG quality (default 0.85), Markdown image mode (zip or embed).

**Size guard:** before rendering, the popup estimates the PDF size; above 50 MB it offers to lower the quality.

**Done when**

- [ ] Uploaded and generated images appear in the right turn and order
- [ ] A chat with 20 images exports to PDF in under 15 seconds
- [ ] An expired image shows the placeholder and the rest of the export completes

## Phase 3 — Choose which parts to export

Phase 3 lets the user tick exactly the turns they want, right on the chat page, and every format and destination exports only those.

**Selection mode** (popup → *Choose messages*)

- A checkbox appears beside every turn, and a floating bar at the bottom shows "12 of 40 selected · Export".
- **Pair mode** (default): ticking a prompt also ticks its answer, so a Q&A stays together. Turn it off to pick single messages.
- **Shift-click** selects a range; quick filters: *All*, *None*, *Only my prompts*, *Only responses*, *Last N turns*.
- **Find box** ticks every turn containing a word.
- **Highlight export:** select text with the mouse, right-click → *Export selection* exports just that passage, still labelled with the turn's role.

**Design rules**

- The checkboxes and bar live inside a Shadow DOM root, so the site's CSS cannot break them and ours cannot break the site.
- Selection is stored per chat URL in `chrome.storage.session`, so a reopened popup keeps it until the browser closes.
- The data model already carries `selected` on every message; the Filter step drops unselected turns before any renderer runs, so no renderer changes.
- Optional *Keep turn numbers* writes "You (turn 7):" so a partial export still shows where each part came from.

**Done when**

- [ ] Selection works on a 300-turn chat without visible lag
- [ ] Exported files contain only ticked turns, in page order
- [ ] Leaving selection mode removes every injected element from the page

## Phase 4 — Export Claude chats

Phase 4 adds a `claude` site adapter; everything after Extract (selection, all formats, images) is reused unchanged, which is the payoff of the shared data model.

**What is new for Claude**

| Claude feature | Default in export | Option |
| --- | --- | --- |
| Normal prompts and answers | "You:" / "Response:" | label answers "Claude:" instead |
| Artifacts (code, documents, diagrams in the side panel) | inserted where the artifact card appears, as a code block or Markdown section | move all artifacts to an appendix, or leave them out |
| Extended thinking | left out | include as a quoted "Thinking:" block |
| Uploaded files (PDF, docs) | listed as `[Attachment: report.pdf]` | — |
| Uploaded images | handled as in phase 2 | — |
| Web search citations | Markdown links / plain URLs | — |

**Notes**

- Host access to `https://claude.ai/*` is added; Chrome asks the user to approve it when updating the extension, so the update note should say why.
- If an artifact's content only loads when its card is opened, the adapter opens each card in turn and reads it; this is slower, so the popup shows progress.
- The file header says "Claude conversation" and links to the chat.
- The Firefox build ships at the end of this phase, since both adapters are then stable.

**Done when**

- [ ] A Claude chat with artifacts, images and Thai text exports correctly in all formats
- [ ] Phase 3 selection works on claude.ai without changes to the selection code

## Phase 5 — Send to Notion

Phase 5 adds Notion as a destination: one click creates a Notion page (or a database row) holding the chat with real Notion blocks, pictures included.

**Connecting — two steps, simplest first**

1. **Personal token (ships first, no server):** the user creates an internal connection on Notion's integrations page, pastes its secret into Options, and shares a target page with that connection. Fast to build; slightly technical for users.
2. **"Connect with Notion" button (later):** OAuth through `chrome.identity.launchWebAuthFlow`. Notion's code-for-token exchange needs our client secret, which must never ship inside an extension, so a tiny serverless function (for example a Cloudflare Worker) does only that exchange and stores nothing.

The token stays in `chrome.storage.local` and is used only by the service worker, which holds host access to `https://api.notion.com/*`.

**Where it goes**

- **Page mode:** a new child page under a page the user picked, titled with the chat title.
- **Database mode:** a new row with properties Title, Platform (select), Source URL, Exported (date) and Turns (number), building a searchable archive of chats.

**Block mapping**

| Our block | Notion block | Limit handled |
| --- | --- | --- |
| "You:" turn | grey callout holding the prompt | — |
| "Response:" turn | bold "Response:" paragraph, then the answer's blocks | — |
| paragraph | paragraph with bold, italic, code and link styling | text split into 2000-character pieces |
| heading | heading 1–3 | — |
| list | bulleted or numbered list items | — |
| code | code block with language (unknown → plain text) | long code split across several text pieces in one block |
| table | table + table rows | — |
| math | equation block | over 1000 characters → LaTeX code block |
| image | image block from Notion's File Upload API | over the workspace's per-file limit → "Image too large" note |
| between Q&A pairs | divider | — |

Chat images cannot be linked as external URLs, because ChatGPT's image links are signed and expire; each image is uploaded to Notion first and then referenced by its upload id.

**Sending large chats**

- Create the page with the first 100 blocks, then append the rest in batches of up to 100, in order, staying under 1000 block elements and 500 KB per request.
- One request queue for all Notion calls; on 429 or 529 it waits for `Retry-After`, then backs off with jitter (non-Business workspaces average 3 requests per second).
- A write that returns 503 is never blindly repeated: the queue reads the ids Notion reports as already saved first, so blocks are not duplicated.
- Progress is saved after each batch; if sending fails, the popup offers **Resume** instead of creating a second page.
- Free workspaces are getting a block limit from September 8, 2026; a 403 that names that limit is shown to the user in plain words.

**Done when**

- [ ] A 300-turn chat with images arrives in Notion complete and in order
- [ ] Interrupting and resuming never creates duplicate blocks
- [ ] Disconnecting removes the token from storage

## Phase 6 — Export to Apple Notes on iOS

Phase 6 ships the extension for Safari on iPhone and iPad and hands the chat to Apple Notes through iOS itself, because Notes has no public API that an extension or app can write to.

**Getting onto iOS**

- The same WXT codebase is converted with Apple's `xcrun safari-web-extension-converter`, which creates an Xcode project and a small container app ([Apple tech talk](https://developer.apple.com/videos/play/tech-talks/110148/)).
- iOS Safari extensions are distributed inside that app through the App Store, so this phase needs a paid Apple Developer account and App Review.
- **Limit to state clearly in the listing:** the extension works on chatgpt.com and claude.ai opened in Safari. It cannot run inside the native ChatGPT or Claude iPhone apps.

**Two routes into Notes**

|  | A. Share sheet | B. Shortcut |
| --- | --- | --- |
| How | Tap *Share to Notes* → iOS share sheet → Notes | Tap *Save to Notes* → extension copies Markdown and opens our Shortcut |
| What lands in Notes | the PDF as an attachment (with pictures), or plain text | a formatted note: headings, bold "You:" / "Response:", lists |
| Pictures | yes, inside the PDF | no |
| Setup | none | install our Shortcut once from an iCloud link |
| Choose folder | each time, in the share sheet | set once inside the Shortcut |

**Route A details:** the button calls `navigator.share({ files: [pdf] })` (or `{ text }`). The Web Share API needs a fresh tap on the page, so the button lives in the in-page bar from phase 3, not in the popup.

**Route B details:** the extension writes the Markdown to the clipboard, then opens `shortcuts://run-shortcut?name=Save%20Chat%20to%20Notes&input=clipboard`, Apple's documented way to run a shortcut with clipboard input ([Apple Support](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios)). The Shortcut runs three actions: Get Clipboard → Make Rich Text from Markdown → Create Note. The clipboard is used instead of the URL's `text=` parameter because long chats would exceed URL length limits. The same Shortcut also works on a Mac.

**Engineering changes for Safari**

- Chrome's offscreen document does not exist in Safari, and iOS background pages are not persistent. A small `RenderHost` interface runs renderers in the offscreen document on Chrome and in an extension page on Safari.
- iOS gives extensions less memory: images are processed one at a time and PDFs over 30 MB fall back to the text-only route.

**Done when**

- [ ] On an iPhone, a ChatGPT chat with pictures reaches Notes as a PDF through route A
- [ ] Route B creates a formatted note with "You:" and "Response:" labels and Thai text intact
- [ ] The app passes App Review

## Privacy, permissions, testing and risks

The extension is read-only and local-first: it never types into or automates the chat, it sends nothing to us, and chat text leaves the device only to Notion or the iOS share sheet when the user asks.

**Privacy**

- No analytics or crash reporting by default; an opt-in error report, if added, sends only the error and browser version, never chat text.
- Our only server is the optional Notion OAuth exchange in phase 5, which stores nothing.
- A short privacy policy and the store data-use disclosures are written in phase 1, since store reviewers ask for them.

**Permissions by phase**

| Phase | Added | Why |
| --- | --- | --- |
| 1 | `activeTab`, `scripting`, `storage`, `downloads`, `offscreen`; `chatgpt.com` | read the chat, save files, render PDF |
| 2 | OpenAI image file domains | fetch pictures for the PDF |
| 3 | `contextMenus` | right-click *Export selection* |
| 4 | `claude.ai` and its image domains | Claude adapter |
| 5 | `identity`; `api.notion.com` | Notion sign-in and API calls |
| 6 | Safari equivalents | iOS build |

**Testing**

- Renderer tests: one fixture `Conversation` (Thai, English, code, table, math, image) rendered to every format and compared with a saved expected file.
- Adapter tests: saved HTML snapshots of real chats, parsed in jsdom; a new snapshot is added whenever a site change breaks extraction.
- End-to-end: Playwright loads the unpacked extension and exports a test chat to each format.
- Nightly canary: a test account opens one known chat on each live site and alerts the team when the turn count or roles stop matching.

**Risks**

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| ChatGPT or Claude changes its page HTML | high | selectors in one config file with fallbacks; nightly canary; adapter tests; fast patch release |
| Thai or emoji render badly in PDF | medium | embedded Thai font, word segmentation, Print view fallback |
| Very long chats are slow or run out of memory | medium | stream rendering turn by turn, image downscaling, progress bar |
| Notion rate limits or free-plan block limit | medium | single queue with `Retry-After`, resume, clear error text |
| Store or App Review rejection | low–medium | minimal permissions, clear privacy policy, read-only behaviour |
| Terms-of-service concerns | low | exports only the user's own open chat, on demand; no bulk scraping, no automation |

**Roadmap** — rough effort for one developer; each phase ships to users before the next starts.

| Phase | Builds on | Rough effort |
| --- | --- | --- |
| 1 Text export | — | 2–3 weeks |
| 2 Pictures in PDF | 1 | 1–2 weeks |
| 3 Choose parts | 1 | 1–2 weeks |
| 4 Claude | 1–3 | 1–2 weeks |
| 5 Notion | 1–4 | 2–3 weeks |
| 6 Apple Notes on iOS | 1–4 | 3–4 weeks, including App Review |

## Sources

- [Notion API request limits](https://developers.notion.com/reference/request-limits)
- [Notion API: working with files and media](https://developers.notion.com/guides/data-apis/working-with-files-and-media)
- [Apple: run a shortcut from a URL](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios)
- [Apple tech talk: build and deploy Safari extensions for iOS](https://developer.apple.com/videos/play/tech-talks/110148/)
