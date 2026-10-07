import { browser } from '#imports';
import type { Conversation, ExportFormat } from './model';

// popup/background → content script
export type ContentRequest = { type: 'ping' } | { type: 'info' } | { type: 'extract' };

export interface ChatInfo {
  supported: boolean;
  title: string;
  messageCount: number;
}

export type ContentResponse<T extends ContentRequest> = T extends { type: 'ping' }
  ? true
  : T extends { type: 'info' }
    ? ChatInfo
    : Conversation | { error: string };

// popup → background
export type BackgroundRequest = { type: 'export'; tabId: number; format: ExportFormat };

export type ExportResult = { ok: true; fileName: string; messageCount: number } | { ok: false; error: string };

const CONTENT_SCRIPT_FILE = '/content-scripts/chatgpt.js';

/** Tabs opened before the extension was installed have no content script yet; inject it on demand. */
export async function ensureContentScript(tabId: number): Promise<void> {
  try {
    if (await browser.tabs.sendMessage(tabId, { type: 'ping' } satisfies ContentRequest)) return;
  } catch {
    // no listener in the tab — fall through and inject
  }
  await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] });
}

export async function sendToContent<T extends ContentRequest>(tabId: number, req: T): Promise<ContentResponse<T>> {
  await ensureContentScript(tabId);
  return browser.tabs.sendMessage(tabId, req);
}
