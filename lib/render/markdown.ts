import { formatExportedAt, type Block, type Conversation } from '../model';
import type { ExportOptions } from '../options';
import { platformName } from './common';

function fence(code: string): string {
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((m) => m.length));
  return '`'.repeat(longest + 1);
}

function indentContinuation(text: string, indent: string): string {
  return text.split('\n').join(`\n${indent}`);
}

const escapeCell = (s: string) => s.replace(/\|/g, '\\|');

export function blockToMarkdown(b: Block, imageIndex: () => number): string {
  switch (b.kind) {
    case 'paragraph':
      return b.markdown;
    case 'heading':
      return `${'#'.repeat(b.level)} ${b.text}`;
    case 'list':
      return b.items
        .map((item, i) => {
          const marker = b.ordered ? `${i + 1}. ` : '- ';
          return marker + indentContinuation(item, ' '.repeat(marker.length));
        })
        .join('\n');
    case 'code': {
      const f = fence(b.code);
      return `${f}${b.language ?? ''}\n${b.code}\n${f}`;
    }
    case 'table': {
      if (!b.rows.length) return '';
      const width = Math.max(...b.rows.map((r) => r.length));
      const row = (r: string[]) =>
        `| ${Array.from({ length: width }, (_, i) => escapeCell(r[i] ?? '')).join(' | ')} |`;
      const [head = [], ...body] = b.rows;
      return [row(head), `| ${Array(width).fill('---').join(' | ')} |`, ...body.map(row)].join('\n');
    }
    case 'math':
      return b.display ? `$$\n${b.tex}\n$$` : `$${b.tex}$`;
    case 'image': {
      const n = imageIndex();
      return b.alt ? `[Image ${n}: ${b.alt}]` : `[Image ${n}]`;
    }
  }
}

export function renderMarkdown(conv: Conversation, opts: ExportOptions): string {
  const out: string[] = [`# ${conv.title}`, ''];
  if (opts.includeHeader) {
    out.push(
      `> Exported from ${platformName(conv.platform)} · ${formatExportedAt(conv.exportedAt)} · [open chat](${conv.url})`,
      '',
    );
  }

  let images = 0;
  const nextImage = () => ++images;

  conv.messages.forEach((m, i) => {
    if (m.role === 'user' && i > 0) out.push('---', '');
    out.push(`**${m.role === 'user' ? opts.userLabel : opts.assistantLabel}**`, '');
    for (const b of m.blocks) {
      const md = blockToMarkdown(b, nextImage);
      if (md) out.push(md, '');
    }
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
