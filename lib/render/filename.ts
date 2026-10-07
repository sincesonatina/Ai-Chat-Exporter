import type { Conversation, ExportFormat } from '../model';

const MAX_BASE_LENGTH = 100;

/** Remove characters Windows/macOS/Linux reject in file names; keep Thai and other scripts. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
  const short = [...cleaned].slice(0, MAX_BASE_LENGTH).join('').trim();
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(short) ? `_${short}` : short || 'chat';
}

/** Pattern tokens: {title} {date} {platform}. Date comes from exportedAt (local time). */
export function buildFileName(pattern: string, conv: Conversation, format: ExportFormat): string {
  const base = pattern
    .replaceAll('{title}', conv.title)
    .replaceAll('{date}', conv.exportedAt.slice(0, 10))
    .replaceAll('{platform}', conv.platform);
  return `${sanitizeFileName(base)}.${format}`;
}
