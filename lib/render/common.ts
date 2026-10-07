import type { Conversation } from '../model';

export function platformName(p: Conversation['platform']): string {
  return p === 'chatgpt' ? 'ChatGPT' : 'Claude';
}

/** Literal text → Markdown that renders as the same text. */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/([\\`*_[\]<>|~])/g, '\\$1')
    .replace(/^(\s*)([#>+-])/gm, '$1\\$2')
    .replace(/^(\s*\d+)\./gm, '$1\\.');
}

/** Inline Markdown → plain text: drop emphasis, keep link URLs, unescape. */
export function stripInlineMarkdown(md: string): string {
  return (
    md
      // images ![alt](src) → [Image: alt]
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => (alt ? `[Image: ${alt}]` : '[Image]'))
      // links [text](url) → "text (url)", or just url when they match
      .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, text: string, url: string) =>
        text === url || text === url.replace(/^https?:\/\//, '') ? url : `${text} (${url})`,
      )
      // inline code
      .replace(/`([^`]+)`/g, '$1')
      // bold / italic / strike (Turndown emits only * delimiters; literal _ arrives escaped)
      .replace(/(?<!\\)\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1')
      .replace(/(?<!\\)\*(?=[^\s*])([\s\S]*?[^\s\\])\*/g, '$1')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
      // hard breaks
      .replace(/ {2,}\n/g, '\n')
      .replace(/\\\n/g, '\n')
      // Markdown escapes
      .replace(/\\([\\`*_{}[\]()#+\-.!|>~<])/g, '$1')
  );
}
