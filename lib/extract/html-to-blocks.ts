import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { Block } from '../model';

export interface BlockSelectors {
  /** Elements removed before conversion (buttons, toolbars, reasoning panels…). */
  skip: string[];
  /** Header element inside a <pre> that names the code language. */
  codeLanguageLabel: string[];
}

/** Read TeX from KaTeX's MathML annotation so formulas export as source, not glyphs. */
export function katexTex(el: Element): string | null {
  const ann = el.querySelector('annotation[encoding="application/x-tex"]');
  return ann?.textContent?.trim() ?? null;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });
  td.use(gfm);
  td.remove(['button', 'style', 'script']);
  td.remove((node) => node.nodeName.toLowerCase() === 'svg');
  // KaTeX → $tex$ / $$tex$$. Rule output is not escaped, so backslashes survive.
  td.addRule('katex', {
    filter: (node) => isElement(node) && (node.classList.contains('katex-display') || node.classList.contains('katex')),
    replacement: (_content, node) => {
      const el = node as Element;
      const tex = katexTex(el);
      if (tex == null) return el.textContent ?? '';
      return el.classList.contains('katex-display') ? `$$${tex}$$` : `$${tex}$`;
    },
  });
  td.addRule('image-placeholder', {
    filter: 'img',
    replacement: (_content, node) => {
      const alt = (node as HTMLImageElement).getAttribute('alt')?.trim();
      return alt ? `[Image: ${alt}]` : '[Image]';
    },
  });
  return td;
}

let turndown: TurndownService | undefined;

export function inlineMarkdown(el: Element): string {
  turndown ??= createTurndown();
  return turndown.turndown(el as HTMLElement).trim();
}

function headingLevel(tag: string): 1 | 2 | 3 {
  const n = Number(tag.slice(1));
  return n <= 1 ? 1 : n === 2 ? 2 : 3;
}

function codeBlock(pre: Element, sel: BlockSelectors): Block {
  const code = pre.querySelector('code');
  const cls = [...(code?.classList ?? [])].find((c) => c.startsWith('language-'));
  let language = cls?.slice('language-'.length);
  if (!language) {
    for (const s of sel.codeLanguageLabel) {
      const label = pre.querySelector(s)?.textContent?.trim();
      if (label) {
        language = label.toLowerCase();
        break;
      }
    }
  }
  const text = (code ?? pre).textContent ?? '';
  return { kind: 'code', language: language || undefined, code: text.replace(/\n$/, '') };
}

function listBlock(list: Element): Block {
  const items = [...list.children]
    .filter((c) => c.tagName === 'LI')
    .map((li) => inlineMarkdown(li));
  return { kind: 'list', ordered: list.tagName === 'OL', items };
}

function tableBlock(table: Element): Block {
  const rows = [...table.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th, td')].map((cell) => inlineMarkdown(cell).replace(/\n+/g, ' ')),
  );
  return { kind: 'table', rows };
}

/**
 * Walk a rendered message body and turn its top-level elements into blocks.
 * Unknown wrappers (divs) are recursed into; inline-only content becomes a paragraph.
 */
export function htmlToBlocks(root: Element, sel: BlockSelectors): Block[] {
  const clone = root.cloneNode(true) as Element;
  for (const s of sel.skip) clone.querySelectorAll(s).forEach((n) => n.remove());

  const blocks: Block[] = [];
  const walk = (parent: Element) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 3) {
        const text = node.textContent?.trim();
        if (text) blocks.push({ kind: 'paragraph', markdown: text });
        continue;
      }
      if (!isElement(node)) continue;
      const el = node;
      const tag = el.tagName;

      // Display math on its own (possibly wrapped in a lone <p>/<div>) becomes a math block.
      const only = el.children.length === 1 && el.textContent?.trim() === el.children[0]?.textContent?.trim() ? el.children[0]! : null;
      const display = el.classList.contains('katex-display') ? el : only?.classList.contains('katex-display') ? only : null;
      if (display) {
        const tex = katexTex(display);
        if (tex != null) {
          blocks.push({ kind: 'math', tex, display: true });
          continue;
        }
      }

      switch (tag) {
        case 'P':
        case 'BLOCKQUOTE': {
          const md = inlineMarkdown(el);
          if (md) blocks.push({ kind: 'paragraph', markdown: md });
          break;
        }
        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
          blocks.push({ kind: 'heading', level: headingLevel(tag.toLowerCase()), text: inlineMarkdown(el) });
          break;
        case 'UL':
        case 'OL':
          blocks.push(listBlock(el));
          break;
        case 'PRE':
          blocks.push(codeBlock(el, sel));
          break;
        case 'TABLE':
          blocks.push(tableBlock(el));
          break;
        case 'HR':
          blocks.push({ kind: 'paragraph', markdown: '---' });
          break;
        case 'IMG': {
          const img = el as HTMLImageElement;
          blocks.push({ kind: 'image', src: img.src, alt: img.alt || undefined });
          break;
        }
        default: {
          // Wrapper divs (code-block shells, table scrollers…): look inside.
          const hasBlockChild = el.querySelector('p, pre, table, ul, ol, h1, h2, h3, h4, h5, h6, img, .katex-display, blockquote, hr');
          if (hasBlockChild) walk(el);
          else {
            const md = inlineMarkdown(el);
            if (md) blocks.push({ kind: 'paragraph', markdown: md });
          }
        }
      }
    }
  };
  walk(clone);
  return blocks;
}
