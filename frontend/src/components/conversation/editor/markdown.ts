import { INLINE, parseBlocks } from '../richText';

/**
 * Round-trip between the rich editor's DOM and the stored Slack text
 * ("mrkdwn": *bold* _italic_ __underline__ ~strike~ `code` ```block```
 * > quote, "- " / "1. " lists, [label](url), <@id> / <!channel> / <!here>).
 * Messages, drafts, scheduling and the server only ever see Slack text.
 */

const ZWSP = /\u200b/g;
const NBSP = /\u00a0/g;

/** Mention chip label for a token, e.g. "<@id>" -> "@Ann". */
export type MentionResolver = (token: string) => string;

const BLOCK_TAGS = new Set(['DIV', 'P', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3']);

const isBlock = (node: Node) => node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName);

const ensureNewline = (text: string) => (text === '' || text.endsWith('\n') ? text : `${text}\n`);

// Markers go around each line's text; edge spaces stay outside ("* a*" is not bold).
const wrapLines = (inner: string, marker: string) =>
  inner
    .split('\n')
    .map((line) => {
      const match = /^(\s*)(.*?)(\s*)$/.exec(line);
      if (!match || match[2] === '') return line;
      return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
    })
    .join('\n');

const plainText = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return '\n';
  let out = '';
  node.childNodes.forEach((child) => {
    if (isBlock(child)) out = ensureNewline(out);
    out += plainText(child);
  });
  return out;
};

// A <br> that only keeps an otherwise non-empty block open is not a newline.
const isPlaceholderBr = (node: HTMLElement) =>
  node.tagName === 'BR' &&
  node.nextSibling === null &&
  node.parentElement !== null &&
  isBlock(node.parentElement) &&
  (node.parentElement.textContent ?? '').replace(ZWSP, '') !== '';

const styleFormats = (element: HTMLElement) => {
  const { fontWeight, fontStyle, textDecorationLine, textDecoration } = element.style;
  const decoration = `${textDecorationLine} ${textDecoration}`;
  return {
    bold: fontWeight === 'bold' || Number(fontWeight) >= 600,
    italic: fontStyle === 'italic',
    underline: decoration.includes('underline'),
    strike: decoration.includes('line-through'),
  };
};

const serializeChildren = (node: Node): string => {
  let out = '';
  node.childNodes.forEach((child) => {
    if (isBlock(child)) {
      out = ensureNewline(out);
      out += serializeNode(child).replace(/\n$/, '');
      out = ensureNewline(out);
    } else {
      out += serializeNode(child);
    }
  });
  return out;
};

const serializeList = (list: HTMLElement, ordered: boolean) => {
  const items: string[] = [];
  list.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && child.tagName === 'LI') {
      const text = serializeChildren(child).replace(/\n+$/, '').replace(/\n/g, ' ');
      items.push(`${ordered ? `${items.length + 1}.` : '-'} ${text}`);
    } else if (child instanceof HTMLElement && (child.tagName === 'UL' || child.tagName === 'OL')) {
      items.push(serializeList(child, child.tagName === 'OL'));
    }
  });
  return items.join('\n');
};

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof HTMLElement)) return '';

  const mention = node.dataset.mention;
  if (mention) return mention;

  switch (node.tagName) {
    case 'BR':
      return isPlaceholderBr(node) ? '' : '\n';
    case 'B':
    case 'STRONG':
      return wrapLines(serializeChildren(node), '*');
    case 'I':
    case 'EM':
      return wrapLines(serializeChildren(node), '_');
    case 'U':
      return wrapLines(serializeChildren(node), '__');
    case 'S':
    case 'STRIKE':
    case 'DEL':
      return wrapLines(serializeChildren(node), '~');
    case 'CODE': {
      const text = (node.textContent ?? '').replace(ZWSP, '');
      return node.closest('pre') ? text : wrapLines(text, '`');
    }
    case 'A': {
      const href = node.getAttribute('href') ?? '';
      const label = serializeChildren(node);
      if (!/^https?:\/\//i.test(href)) return label;
      return label.trim() === '' || label === href ? href : `[${label}](${href})`;
    }
    case 'PRE': {
      const body = plainText(node).replace(ZWSP, '').replace(/\n$/, '');
      return `\`\`\`\n${body}\n\`\`\``;
    }
    case 'BLOCKQUOTE':
      return serializeChildren(node)
        .replace(/\n+$/, '')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'UL':
      return serializeList(node, false);
    case 'OL':
      return serializeList(node, true);
    default: {
      let text = serializeChildren(node);
      const formats = node.tagName === 'SPAN' ? styleFormats(node) : null;
      if (formats?.strike) text = wrapLines(text, '~');
      if (formats?.underline) text = wrapLines(text, '__');
      if (formats?.italic) text = wrapLines(text, '_');
      if (formats?.bold) text = wrapLines(text, '*');
      return text;
    }
  }
}

/** Editor DOM -> Slack text (trimmed; ZWSP and nbsp normalised). */
export const editorToMarkdown = (root: HTMLElement): string =>
  serializeChildren(root)
    .replace(ZWSP, '')
    .replace(NBSP, ' ')
    .replace(/\s+$/, '')
    .replace(/^\n+/, '');

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** The non-editable chip used for mentions in the editor. */
export const mentionChipHtml = (token: string, label: string) =>
  `<span class="mention-chip" contenteditable="false" data-mention="${escapeHtml(token)}">${escapeHtml(label)}</span>`;

const inlineToHtml = (text: string, resolve: MentionResolver): string => {
  const pattern = INLINE();
  let html = '';
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0] === '') {
      pattern.lastIndex += 1;
      continue;
    }
    html += escapeHtml(text.slice(last, match.index));
    const value = match[0];
    const groups = match.groups ?? {};
    if (groups.code) {
      html += `<code>${escapeHtml(value.slice(1, -1))}</code>`;
    } else if (groups.mention) {
      const token = value.startsWith('@') ? `<!${value.slice(1).toLowerCase()}>` : value;
      html += mentionChipHtml(token, resolve(token));
    } else if (groups.mdlink) {
      html += `<a href="${escapeHtml(groups.mdurl)}">${inlineToHtml(groups.mdlabel, resolve)}</a>`;
    } else if (groups.link) {
      html += `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
    } else if (groups.bold2) {
      html += `<b>${inlineToHtml(value.slice(2, -2), resolve)}</b>`;
    } else if (groups.bold) {
      html += `<b>${inlineToHtml(value.slice(1, -1), resolve)}</b>`;
    } else if (groups.underline) {
      html += `<u>${inlineToHtml(value.slice(2, -2), resolve)}</u>`;
    } else if (groups.italic) {
      html += `<i>${inlineToHtml(value.slice(1, -1), resolve)}</i>`;
    } else if (groups.strike) {
      html += `<s>${inlineToHtml(value.slice(1, -1), resolve)}</s>`;
    } else {
      html += escapeHtml(value);
    }
    last = match.index + value.length;
  }
  return html + escapeHtml(text.slice(last));
};

const lineDiv = (line: string, resolve: MentionResolver) =>
  `<div>${line === '' ? '<br>' : inlineToHtml(line, resolve)}</div>`;

/** Slack text -> editor HTML (all text escaped). */
export const markdownToEditorHtml = (text: string, resolve: MentionResolver): string => {
  if (!text) return '';
  return parseBlocks(text)
    .map((block) => {
      switch (block.kind) {
        case 'code':
          return `<pre>${escapeHtml(block.text) || '<br>'}</pre>`;
        case 'quote':
          return `<blockquote>${block.lines.map((line) => lineDiv(line, resolve)).join('')}</blockquote>`;
        case 'ul':
          return `<ul>${block.items.map((item) => `<li>${inlineToHtml(item, resolve) || '<br>'}</li>`).join('')}</ul>`;
        case 'ol':
          return `<ol start="${block.start}">${block.items.map((item) => `<li>${inlineToHtml(item, resolve) || '<br>'}</li>`).join('')}</ol>`;
        default:
          return block.lines.map((line) => lineDiv(line, resolve)).join('');
      }
    })
    .join('');
};
