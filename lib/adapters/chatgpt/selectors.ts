// Every ChatGPT selector lives here. Each list is tried in order, so put the
// current markup first and older/fallback markup after it. When the site
// changes, add a saved HTML snapshot to tests/fixtures and fix this file only.

export const chatgptSelectors = {
  /** One element per message; the attribute value is the role. */
  message: ['[data-message-author-role]'],
  roleAttr: 'data-message-author-role',
  idAttr: 'data-message-id',

  /** Plain-text body of a user prompt. */
  userText: ['.whitespace-pre-wrap', '[data-message-content]'],
  /** Rendered Markdown body of an assistant answer. */
  assistantBody: ['.markdown', '.prose'],

  /** Chat title: active sidebar entry first, document.title as fallback. */
  title: ['nav a[aria-current="page"]', 'nav a[data-active]'],
  titleSuffix: /\s*[-|–]\s*ChatGPT\s*$/,

  /** Removed before conversion: action buttons, version switchers, reasoning panels. */
  skip: ['button', '[role="toolbar"]', '.sr-only', '[data-testid*="copy"]', 'details', '[data-testid*="thought"]'],
  /** Code block header that shows the language when <code> has no language-* class. */
  codeLanguageLabel: ['pre > div > div:first-child', 'pre > div > span:first-child'],
} as const;

export function queryFirst(root: ParentNode, selectors: readonly string[]): Element | null {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

export function queryAllFirst(root: ParentNode, selectors: readonly string[]): Element[] {
  for (const s of selectors) {
    const els = root.querySelectorAll(s);
    if (els.length) return [...els];
  }
  return [];
}
