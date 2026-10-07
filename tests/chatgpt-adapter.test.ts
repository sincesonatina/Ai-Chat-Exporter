import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { chatgptAdapter } from '@/lib/adapters/chatgpt';
import { extractConversation } from '@/lib/extract/extract';
import type { Conversation } from '@/lib/model';
import { DEFAULT_OPTIONS } from '@/lib/options';
import { renderMarkdown } from '@/lib/render/markdown';
import { renderText } from '@/lib/render/text';

const html = readFileSync(new NodeURL('./fixtures/chatgpt-chat.html', import.meta.url), 'utf8');

describe('ChatGPT adapter', () => {
  let conv: Conversation;

  beforeAll(() => {
    document.body.innerHTML = html;
    document.title = 'Trip plan for Chiang Mai - ChatGPT';
    conv = extractConversation(chatgptAdapter, new Date('2026-10-07T03:39:00Z'));
  });

  it('matches chatgpt.com only', () => {
    expect(chatgptAdapter.matches(new URL('https://chatgpt.com/c/123'))).toBe(true);
    expect(chatgptAdapter.matches(new URL('https://claude.ai/chat/123'))).toBe(false);
  });

  it('reads the title without the site suffix', () => {
    expect(conv.title).toBe('Trip plan for Chiang Mai');
  });

  it('keeps user/assistant turns, skips tool messages, merges consecutive answers', () => {
    expect(conv.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(JSON.stringify(conv)).not.toContain('hidden tool output');
    expect(conv.messages[1]!.blocks.at(-1)).toEqual({ kind: 'paragraph', markdown: 'Also consider Doi Suthep.' });
  });

  it('keeps prompts literal', () => {
    const [image, text] = conv.messages[0]!.blocks;
    expect(image).toMatchObject({ kind: 'image', alt: 'Uploaded image' });
    expect(text).toEqual({
      kind: 'paragraph',
      markdown: 'วางแผนเที่ยวเชียงใหม่ 3 วัน  \nPlan 3 days in Chiang Mai. Budget: 2\\*3\\*4 = 24 THB\\_per\\_day',
    });
    expect(renderText(conv, DEFAULT_OPTIONS)).toContain('Budget: 2*3*4 = 24 THB_per_day');
    expect(renderText(conv, DEFAULT_OPTIONS)).toContain('# not a heading\n- not a list');
  });

  it('converts answer blocks', () => {
    const blocks = conv.messages[1]!.blocks;
    expect(blocks).toContainEqual({ kind: 'heading', level: 3, text: 'Day 1 – Old City temples' });
    expect(blocks).toContainEqual({
      kind: 'list',
      ordered: false,
      items: ['**Wat Phra Singh** in the morning', 'วัดเจดีย์หลวง in the afternoon'],
    });
    expect(blocks).toContainEqual({ kind: 'code', language: 'python', code: 'days = 3\nprint(days * 1500)' });
    expect(blocks).toContainEqual({ kind: 'code', language: 'bash', code: 'echo "no language class"' });
    expect(blocks).toContainEqual({
      kind: 'table',
      rows: [['Day', 'Cost'], ['1', '1,500 ฿'], ['2', '*1,200* | 300']],
    });
    expect(blocks).toContainEqual({ kind: 'paragraph', markdown: 'Inline math $E = mc^2$ works.' });
    expect(blocks).toContainEqual({ kind: 'math', tex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', display: true });
  });

  it('never exports UI chrome', () => {
    const md = renderMarkdown(conv, DEFAULT_OPTIONS);
    for (const s of ['Copy code', 'Regenerate', 'Edit message', 'You said', 'garbled']) expect(md).not.toContain(s);
  });
});
