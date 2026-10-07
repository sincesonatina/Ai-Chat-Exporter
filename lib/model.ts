// Normalized data model — every adapter outputs this, every renderer reads only this.

export type Role = 'user' | 'assistant';

export interface Conversation {
  platform: 'chatgpt' | 'claude';
  title: string;
  url: string;
  exportedAt: string; // ISO time in the user's time zone, e.g. 2026-10-07T10:39:00+07:00
  messages: Message[];
}

export interface Message {
  id: string; // stable id from the page, or index
  role: Role;
  blocks: Block[];
  selected: boolean; // phase 3; true by default
}

export type Block =
  | { kind: 'paragraph'; markdown: string }
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; language?: string; code: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'math'; tex: string; display: boolean }
  | { kind: 'image'; src: string; alt?: string; data?: Blob }; // phase 2

export type ExportFormat = 'txt' | 'md' | 'pdf';

/** ISO 8601 with the local UTC offset instead of `Z`. */
export function toLocalIso(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

/** "2026-10-07T10:39:00+07:00" → "2026-10-07 10:39 (UTC+07:00)" */
export function formatExportedAt(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
  if (!m) return iso;
  const offset = m[3] === 'Z' ? '+00:00' : m[3];
  return `${m[1]} ${m[2]} (UTC${offset})`;
}
