import { chatgptAdapter } from '@/lib/adapters/chatgpt';
import { extractConversation, loadAllMessages } from '@/lib/extract/extract';
import type { ChatInfo, ContentRequest } from '@/lib/messages';

declare global {
  interface Window {
    __chatExporterLoaded?: boolean;
  }
}

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  main() {
    // The script can be injected again on demand (see ensureContentScript); listen only once.
    if (window.__chatExporterLoaded) return;
    window.__chatExporterLoaded = true;

    const adapter = chatgptAdapter;

    browser.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
      switch (msg.type) {
        case 'ping':
          sendResponse(true);
          return;
        case 'info': {
          const els = adapter.getMessageElements().filter((el) => adapter.getRole(el));
          sendResponse({ supported: true, title: adapter.getTitle(), messageCount: els.length } satisfies ChatInfo);
          return;
        }
        case 'extract':
          loadAllMessages(adapter)
            .then(() => sendResponse(extractConversation(adapter)))
            .catch((e) => sendResponse({ error: String(e) }));
          return true; // async response
      }
    });
  },
});
