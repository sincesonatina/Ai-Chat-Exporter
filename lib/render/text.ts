import { formatExportedAt, type Block, type Conversation } from '../model';
import type { ExportOptions } from '../options';
import { platformName, stripInlineMarkdown } from './common';

const RULE = '='.repeat(40);
const DIVIDER = '-'.repeat(40);

function indentContinuation(text: string, indent: string): string {
  return text.split('\n').join(`\n${indent}`);
}

export function blockToText(b: Block, imageIndex: () => number): string {
  switch (b.kind) {
    case 'paragraph':
      return b.markdown.trim() === '---' ? DIVIDER : stripInlineMarkdown(b.markdown);
    case 'heading':
      return stripInlineMarkdown(b.text);
    case 'list':
      return b.items
        .map((item, i) => {
          const marker = b.ordered ? `${i + 1}. ` : '- ';
          return marker + indentContinuation(stripInlineMarkdown(item), ' '.repeat(marker.length));
        })
        .join('\n');
    case 'code':
      return `[code${b.language ? `: ${b.language}` : ''}]\n${b.code}\n[/code]`;
    case 'table':
      return b.rows.map((r) => r.map(stripInlineMarkdown).join(' | ')).join('\n');
    case 'math':
      return b.display ? `$$ ${b.tex} $$` : `$${b.tex}$`;
    case 'image': {
      const n = imageIndex();
      return b.alt ? `[Image ${n}: ${b.alt}]` : `[Image ${n}]`;
    }
  }
}

export function renderText(conv: Conversation, opts: ExportOptions): string {
  const out: string[] = [];
  if (opts.includeHeader) {
    out.push(
      `${platformName(conv.platform)} conversation: ${conv.title}`,
      `Exported: ${formatExportedAt(conv.exportedAt)}`,
      `Link: ${conv.url}`,
      RULE,
      '',
    );
  }

  let images = 0;
  const nextImage = () => ++images;

  conv.messages.forEach((m, i) => {
    if (m.role === 'user' && i > 0) out.push(DIVIDER, '');
    out.push(m.role === 'user' ? opts.userLabel : opts.assistantLabel);
    for (const b of m.blocks) {
      const text = blockToText(b, nextImage);
      if (text) out.push(text, '');
    }
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
