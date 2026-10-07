import './style.css';
import { adapterFor } from '@/lib/adapters';
import { sendToContent, type BackgroundRequest, type ExportResult } from '@/lib/messages';
import type { ExportFormat } from '@/lib/model';
import { getOptions } from '@/lib/options';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null || !adapterFor(tab.url)) {
    $('#unsupported').hidden = false;
    return;
  }
  const tabId = tab.id;

  const info = await sendToContent(tabId, { type: 'info' }).catch(() => null);
  if (!info) {
    $('#unsupported').hidden = false;
    return;
  }

  $('#ready').hidden = false;
  $('#title').textContent = info.title;
  $('#count').textContent = `${info.messageCount} messages`;

  const opts = await getOptions();
  const radio =
    document.querySelector<HTMLInputElement>(`input[name="format"][value="${opts.defaultFormat}"]:not(:disabled)`) ??
    document.querySelector<HTMLInputElement>('input[name="format"][value="md"]')!;
  radio.checked = true;

  const button = $<HTMLButtonElement>('#export');
  const status = $('#status');
  button.addEventListener('click', async () => {
    const format = document.querySelector<HTMLInputElement>('input[name="format"]:checked')!.value as ExportFormat;
    button.disabled = true;
    status.textContent = 'Exporting…';
    const result: ExportResult = await browser.runtime
      .sendMessage({ type: 'export', tabId, format } satisfies BackgroundRequest)
      .catch((e: unknown) => ({ ok: false, error: String(e) }));
    status.textContent = result.ok ? `Saved ${result.fileName}` : `Export failed: ${result.error}`;
    button.disabled = false;
  });
}

init();
