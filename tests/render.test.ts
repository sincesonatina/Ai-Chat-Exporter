import { describe, expect, it } from 'vitest';
import { filterSelected } from '@/lib/extract/extract';
import { formatExportedAt, toLocalIso } from '@/lib/model';
import { DEFAULT_OPTIONS } from '@/lib/options';
import { stripInlineMarkdown } from '@/lib/render/common';
import { buildFileName, sanitizeFileName } from '@/lib/render/filename';
import { renderMarkdown } from '@/lib/render/markdown';
import { renderText } from '@/lib/render/text';
import { fixtureConversation } from './fixtures/conversation';

const conv = filterSelected(fixtureConversation);

describe('renderers', () => {
  it('renders .txt', async () => {
    await expect(renderText(conv, DEFAULT_OPTIONS)).toMatchFileSnapshot('./expected/chat.txt');
  });

  it('renders .md', async () => {
    await expect(renderMarkdown(conv, DEFAULT_OPTIONS)).toMatchFileSnapshot('./expected/chat.md');
  });

  it('labels every turn in every format', () => {
    for (const out of [renderText(conv, DEFAULT_OPTIONS), renderMarkdown(conv, DEFAULT_OPTIONS)]) {
      expect(out.match(/You:/g)).toHaveLength(2);
      expect(out.match(/Response:/g)).toHaveLength(2);
      expect(out).not.toContain('not selected');
    }
  });

  it('uses custom labels and can drop the header', () => {
    const opts = { ...DEFAULT_OPTIONS, userLabel: 'Me:', assistantLabel: 'ChatGPT:', includeHeader: false };
    const txt = renderText(conv, opts);
    expect(txt.startsWith('Me:\n')).toBe(true);
    expect(txt).toContain('ChatGPT:');
  });
});

describe('stripInlineMarkdown', () => {
  it.each([
    ['**bold** and *italic*', 'bold and italic'],
    ['[the guide](https://example.com)', 'the guide (https://example.com)'],
    ['[https://a.com](https://a.com)', 'https://a.com'],
    ['`snake_case` and my\\_var', 'snake_case and my_var'],
    ['2\\*3\\*4', '2*3*4'],
  ])('%s', (md, text) => expect(stripInlineMarkdown(md)).toBe(text));
});

describe('file names', () => {
  it('builds from the pattern', () => {
    expect(buildFileName('{title}_{date}', conv, 'md')).toBe('Trip plan for Chiang Mai_2026-10-07.md');
  });

  it('keeps Thai and removes illegal characters', () => {
    expect(sanitizeFileName('แผน: เที่ยว/เชียงใหม่?')).toBe('แผน เที่ยว เชียงใหม่');
    expect(sanitizeFileName('  ...  ')).toBe('chat');
    expect(sanitizeFileName('CON')).toBe('_CON');
  });
});

describe('dates', () => {
  it('formats the export time with its offset', () => {
    expect(formatExportedAt('2026-10-07T10:39:00+07:00')).toBe('2026-10-07 10:39 (UTC+07:00)');
    expect(toLocalIso(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });
});
