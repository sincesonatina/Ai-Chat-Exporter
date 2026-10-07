import type { SiteAdapter } from '../adapters/types';
import { toLocalIso, type Conversation, type Message } from '../model';

const LAZY_LOAD_LIMIT_MS = 10_000;
const STABLE_FOR_MS = 1_000;
const POLL_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function scrollParent(el: Element | undefined): Element | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}

/** Scroll to the top until the message count stops changing, so lazy-loaded turns are in the DOM. */
export async function loadAllMessages(adapter: SiteAdapter): Promise<void> {
  const scroller = scrollParent(adapter.getMessageElements()[0]);
  if (!scroller) return;
  const restoreTo = scroller.scrollTop;
  const deadline = Date.now() + LAZY_LOAD_LIMIT_MS;
  let count = adapter.getMessageElements().length;
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    scroller.scrollTop = 0;
    await sleep(POLL_MS);
    const next = adapter.getMessageElements().length;
    if (next !== count) {
      count = next;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= STABLE_FOR_MS) break;
  }
  scroller.scrollTop = restoreTo;
}

/** Extract: read the page into a Conversation. */
export function extractConversation(adapter: SiteAdapter, now = new Date()): Conversation {
  const messages: Message[] = [];
  adapter.getMessageElements().forEach((el, i) => {
    const role = adapter.getRole(el);
    if (!role) return;
    messages.push({
      id: el.getAttribute('data-message-id') ?? String(i),
      role,
      blocks: adapter.toBlocks(el),
      selected: true,
    });
  });
  return {
    platform: adapter.id,
    title: adapter.getTitle(),
    url: location.href,
    exportedAt: toLocalIso(now),
    messages: normalizeMessages(messages),
  };
}

/** Normalize: drop empty messages and merge consecutive messages from the same role (tool-use steps). */
export function normalizeMessages(messages: Message[]): Message[] {
  const out: Message[] = [];
  for (const m of messages) {
    if (!m.blocks.length) continue;
    const prev = out.at(-1);
    if (prev && prev.role === m.role) {
      prev.blocks.push(...m.blocks);
    } else {
      out.push({ ...m, blocks: [...m.blocks] });
    }
  }
  return out;
}

/** Filter: keep only selected messages (phase 3 sets `selected`). */
export function filterSelected(conv: Conversation): Conversation {
  return { ...conv, messages: conv.messages.filter((m) => m.selected) };
}
