import { Fragment, type ReactNode } from 'react';
import styles from './MessageContent.module.css';

/**
 * Slack "mrkdwn" -> React elements (never HTML strings, so no injection).
 * Blocks: ```code```, > quote, "- " / "* " bullets, "1. " numbered lists.
 * Inline: `code`, *bold* / **bold**, _italic_, __underline__, ~strike~,
 * [label](https://url), bare http(s) links and mention tokens (rendered by
 * the caller). Markers only count at word edges; italics never start after a
 * backslash (so ¯\_(ツ)_/¯ stays intact).
 */
export type TokenRenderer = (token: string, key: string) => ReactNode;

// Mentions are split out first and handed back to the caller.
const MENTION_SOURCE = String.raw`<@[0-9a-fA-F]{24}>|<!channel>|<!here>|@channel\b|@here\b`;

// Named groups; built fresh per call: renderInline recurses and a shared /g
// regex would keep its lastIndex (it once looped forever).
export const INLINE_SOURCE = [
  String.raw`(?<code>\x60[^\x60\n]+\x60)`,
  String.raw`(?<mention>${MENTION_SOURCE})`,
  String.raw`(?<mdlink>\[(?<mdlabel>[^\]\n]+)\]\((?<mdurl>https?:\/\/[^\s<>"')]+)\))`,
  String.raw`(?<link>https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])`,
  String.raw`(?<bold2>(?<![\w*])\*\*(?=\S)[^\n]+?(?<=\S)\*\*(?![\w*]))`,
  String.raw`(?<bold>(?<![\w*])\*(?=\S)[^*\n]+?(?<=\S)\*(?![\w*]))`,
  String.raw`(?<underline>(?<![\w\\_])__(?=\S)[^_\n]+?(?<=\S)__(?![\w_]))`,
  String.raw`(?<italic>(?<![\w\\])_(?=\S)[^_\n]+?(?<=\S)_(?!\w))`,
  String.raw`(?<strike>(?<![\w~])~(?=\S)[^~\n]+?(?<=\S)~(?![\w~]))`,
].join('|');

/** A fresh global regex over the inline syntax (shared with editor/markdown.ts). */
export const INLINE = () => new RegExp(INLINE_SOURCE, 'g');

export const renderInline = (
  text: string,
  renderToken: TokenRenderer,
  keyPrefix = 'i',
): ReactNode[] => {
  const pattern = INLINE();
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match[0] === '') {
      pattern.lastIndex += 1;
      continue;
    }
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${index++}`;
    const groups = match.groups ?? {};
    const value = match[0];

    if (groups.code) {
      nodes.push(
        <code key={key} className={styles.code}>
          {value.slice(1, -1)}
        </code>,
      );
    } else if (groups.mention) {
      nodes.push(<Fragment key={key}>{renderToken(value, key)}</Fragment>);
    } else if (groups.mdlink) {
      nodes.push(
        <a
          key={key}
          href={groups.mdurl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {renderInline(groups.mdlabel, renderToken, key)}
        </a>,
      );
    } else if (groups.link) {
      nodes.push(
        <a key={key} href={value} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {value}
        </a>,
      );
    } else if (groups.bold2) {
      nodes.push(<strong key={key}>{renderInline(value.slice(2, -2), renderToken, key)}</strong>);
    } else if (groups.bold) {
      nodes.push(<strong key={key}>{renderInline(value.slice(1, -1), renderToken, key)}</strong>);
    } else if (groups.underline) {
      nodes.push(<u key={key}>{renderInline(value.slice(2, -2), renderToken, key)}</u>);
    } else if (groups.italic) {
      nodes.push(<em key={key}>{renderInline(value.slice(1, -1), renderToken, key)}</em>);
    } else if (groups.strike) {
      nodes.push(<s key={key}>{renderInline(value.slice(1, -1), renderToken, key)}</s>);
    }
    last = match.index + value.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

export type Block =
  | { kind: 'code'; text: string }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[]; start: number }
  | { kind: 'p'; lines: string[] };

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;

export const parseBlocks = (content: string): Block[] => {
  const blocks: Block[] = [];
  const lines = content.split('\n');
  let i = 0;

  const lastOf = <K extends Block['kind']>(kind: K) => {
    const last = blocks[blocks.length - 1];
    return last && last.kind === kind ? (last as Extract<Block, { kind: K }>) : null;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      // Code block: up to the closing fence (or the end of the message).
      const opening = line.trimStart().slice(3);
      const body: string[] = [];
      const closesInline = opening.trimEnd().endsWith('```') && opening.trim().length > 3;
      if (closesInline) {
        blocks.push({ kind: 'code', text: opening.trimEnd().slice(0, -3) });
        i += 1;
        continue;
      }
      if (opening) body.push(opening);
      i += 1;
      while (i < lines.length && !lines[i].trimEnd().endsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) {
        const closing = lines[i].trimEnd().slice(0, -3);
        if (closing) body.push(closing);
        i += 1;
      }
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    const bullet = BULLET_RE.exec(line);
    const number = NUMBER_RE.exec(line);
    if (quote) {
      const block = lastOf('quote');
      if (block) block.lines.push(quote[1]);
      else blocks.push({ kind: 'quote', lines: [quote[1]] });
    } else if (bullet) {
      const block = lastOf('ul');
      if (block) block.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
    } else if (number) {
      const block = lastOf('ol');
      if (block) block.items.push(number[2]);
      else blocks.push({ kind: 'ol', items: [number[2]], start: Number(number[1]) || 1 });
    } else {
      const block = lastOf('p');
      if (block) block.lines.push(line);
      else blocks.push({ kind: 'p', lines: [line] });
    }
    i += 1;
  }
  return blocks;
};

export const renderRichText = (content: string, renderToken: TokenRenderer): ReactNode[] =>
  parseBlocks(content).map((block, index) => {
    const key = `b${index}`;
    switch (block.kind) {
      case 'code':
        return (
          <pre key={key} className={styles.pre}>
            {block.text}
          </pre>
        );
      case 'quote':
        return (
          <blockquote key={key} className={styles.quote}>
            {renderInline(block.lines.join('\n'), renderToken, key)}
          </blockquote>
        );
      case 'ul':
        return (
          <ul key={key} className={styles.list}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item, renderToken, `${key}-${itemIndex}`)}</li>
            ))}
          </ul>
        );
      case 'ol':
        return (
          <ol key={key} className={styles.list} start={block.start}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item, renderToken, `${key}-${itemIndex}`)}</li>
            ))}
          </ol>
        );
      default:
        return (
          <span key={key} className={styles.para}>
            {renderInline(block.lines.join('\n'), renderToken, key)}
          </span>
        );
    }
  });
