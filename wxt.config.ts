import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'AI Chat Exporter',
    description: 'Export your open ChatGPT conversation to .txt or .md — locally, in your browser.',
    // Phase 1 permissions (design doc). `offscreen` is added together with the PDF renderer.
    permissions: ['activeTab', 'scripting', 'storage', 'downloads'],
    host_permissions: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  },
});
