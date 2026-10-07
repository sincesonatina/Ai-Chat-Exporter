import type { Conversation } from '@/lib/model';

/** One conversation covering Thai, English, code, table, math and an image — rendered to every format. */
export const fixtureConversation: Conversation = {
  platform: 'chatgpt',
  title: 'Trip plan for Chiang Mai',
  url: 'https://chatgpt.com/c/abc123',
  exportedAt: '2026-10-07T10:39:00+07:00',
  messages: [
    {
      id: 'u1',
      role: 'user',
      selected: true,
      blocks: [
        { kind: 'image', src: 'https://files.oaiusercontent.com/file-abc', alt: 'map of the Old City' },
        { kind: 'paragraph', markdown: 'วางแผนเที่ยวเชียงใหม่ 3 วัน  \nPlan 3 days in Chiang Mai\\. Budget 2\\*3\\*4' },
      ],
    },
    {
      id: 'a1',
      role: 'assistant',
      selected: true,
      blocks: [
        { kind: 'heading', level: 3, text: 'Day 1 – Old City temples' },
        { kind: 'list', ordered: false, items: ['**Wat Phra Singh** in the morning', 'วัดเจดีย์หลวง in the afternoon'] },
        { kind: 'paragraph', markdown: 'Read [the guide](https://example.com/guide) and use `snake_case`.' },
        { kind: 'code', language: 'python', code: 'days = 3\nprint(days * 1500)' },
        { kind: 'table', rows: [['Day', 'Cost'], ['1', '1,500 ฿'], ['2', '*1,200* | 300']] },
        { kind: 'math', tex: 'E = mc^2', display: false },
        { kind: 'math', tex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', display: true },
      ],
    },
    {
      id: 'u2',
      role: 'user',
      selected: false,
      blocks: [{ kind: 'paragraph', markdown: 'This turn is not selected.' }],
    },
    {
      id: 'a2',
      role: 'assistant',
      selected: false,
      blocks: [{ kind: 'paragraph', markdown: 'Neither is this one.' }],
    },
    {
      id: 'u3',
      role: 'user',
      selected: true,
      blocks: [{ kind: 'paragraph', markdown: 'ขอบคุณ\\!' }],
    },
    {
      id: 'a3',
      role: 'assistant',
      selected: true,
      blocks: [{ kind: 'list', ordered: true, items: ['First', 'Second\n- nested item'] }],
    },
  ],
};
