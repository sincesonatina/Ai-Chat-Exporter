import { filterSelected } from '@/lib/extract/extract';
import { sendToContent, type BackgroundRequest, type ExportResult } from '@/lib/messages';
import type { Conversation, ExportFormat } from '@/lib/model';
import { getOptions, type ExportOptions } from '@/lib/options';
import { buildFileName } from '@/lib/render/filename';
import { renderMarkdown } from '@/lib/render/markdown';
import { renderText } from '@/lib/render/text';

const MIME: Record<ExportFormat, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  pdf: 'application/pdf',
};

function render(conv: Conversation, format: ExportFormat, opts: ExportOptions): string {
  switch (format) {
    case 'txt':
      return renderText(conv, opts);
    case 'md':
      return renderMarkdown(conv, opts);
    case 'pdf':
      throw new Error('PDF export is not built yet.');
  }
}

// Pipeline: Extract (content script) → Normalize → Filter → Render → Deliver.
async function runExport(tabId: number, format: ExportFormat): Promise<ExportResult> {
  const opts = await getOptions();
  const extracted = await sendToContent(tabId, { type: 'extract' });
  if ('error' in extracted) throw new Error(extracted.error);
  const conv = filterSelected(extracted);
  if (!conv.messages.length) return { ok: false, error: 'No messages found on this page.' };

  const body = render(conv, format, opts);
  const fileName = buildFileName(opts.fileNamePattern, conv, format);
  // Service workers have no URL.createObjectURL, so text formats go out as data URLs.
  const url = `data:${MIME[format]};charset=utf-8,${encodeURIComponent(body)}`;
  await browser.downloads.download({ url, filename: fileName, saveAs: false });
  return { ok: true, fileName, messageCount: conv.messages.length };
}

export default defineBackground(() => {
  // The popup hands the job here so closing the popup does not cancel the export.
  browser.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
    if (msg.type !== 'export') return;
    runExport(msg.tabId, msg.format)
      .then(sendResponse)
      .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    return true; // async response
  });
});
