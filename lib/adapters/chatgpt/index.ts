import type { Block, Role } from '../../model';
import { htmlToBlocks, type BlockSelectors } from '../../extract/html-to-blocks';
import { escapeMarkdown } from '../../render/common';
import type { SiteAdapter } from '../types';
import { chatgptSelectors as S, queryAllFirst, queryFirst } from './selectors';

const blockSelectors: BlockSelectors = {
  skip: [...S.skip],
  codeLanguageLabel: [...S.codeLanguageLabel],
};

function imageBlocks(el: Element, body: Element | null): Block[] {
  return [...el.querySelectorAll('img')]
    .filter((img) => !body?.contains(img))
    .filter((img) => (img.naturalWidth || img.width || 100) > 32) // skip avatars / favicons
    .map((img): Block => ({ kind: 'image', src: img.src, alt: img.alt || undefined }));
}

/** Prompt text is literal: split on blank lines, keep single line breaks as Markdown hard breaks. */
function userTextBlocks(text: string): Block[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p): Block => ({ kind: 'paragraph', markdown: escapeMarkdown(p).split('\n').join('  \n') }));
}

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',

  matches(url) {
    return url.hostname === 'chatgpt.com' || url.hostname === 'chat.openai.com';
  },

  getTitle() {
    const nav = queryFirst(document, S.title)?.textContent?.trim();
    if (nav) return nav;
    const title = document.title.replace(S.titleSuffix, '').trim();
    return title && title !== 'ChatGPT' ? title : 'ChatGPT conversation';
  },

  getMessageElements() {
    return queryAllFirst(document, S.message);
  },

  getRole(el): Role | null {
    const role = el.getAttribute(S.roleAttr);
    return role === 'user' || role === 'assistant' ? role : null;
  },

  toBlocks(el) {
    if (this.getRole(el) === 'user') {
      const body = queryFirst(el, S.userText);
      return [...imageBlocks(el, body), ...userTextBlocks(body?.textContent ?? el.textContent ?? '')];
    }
    const body = queryFirst(el, S.assistantBody);
    return [...imageBlocks(el, body), ...(body ? htmlToBlocks(body, blockSelectors) : [])];
  },
};
