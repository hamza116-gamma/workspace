/**
 * Formatting actions shared by the rich composer, the edit box and the
 * formatting toolbar. Pure: maps keyboard shortcuts to actions; the editor
 * (components/conversation/editor/RichEditor) applies them.
 */
export type FormatAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'codeBlock'
  | 'quote'
  | 'bulletList'
  | 'numberedList';

/** A format action or the link dialog. */
export type ShortcutAction = FormatAction | 'link';

type KeyLike = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

/**
 * Ctrl/Cmd+B bold, +I italic, +U underline, +Shift+X strike, +Shift+C code,
 * +Alt+Shift+C code block, +Shift+7 numbered list, +Shift+8 bulleted list,
 * +Shift+9 quote, +Shift+U link.
 */
export const shortcutAction = (event: KeyLike): ShortcutAction | null => {
  if (!(event.ctrlKey || event.metaKey)) return null;
  const key = event.key.toLowerCase();
  const code = event.code ?? '';
  if (event.altKey) {
    return event.shiftKey && (key === 'c' || code === 'KeyC') ? 'codeBlock' : null;
  }
  if (!event.shiftKey) {
    if (key === 'b') return 'bold';
    if (key === 'i') return 'italic';
    if (key === 'u') return 'underline';
    return null;
  }
  if (key === 'x' || code === 'KeyX') return 'strike';
  if (key === 'c' || code === 'KeyC') return 'code';
  if (key === 'u' || code === 'KeyU') return 'link';
  if (code === 'Digit7' || key === '&') return 'numberedList';
  if (code === 'Digit8' || key === '*') return 'bulletList';
  if (code === 'Digit9' || key === '(') return 'quote';
  return null;
};

export type ToolbarItem = { action: ShortcutAction; label: string; shortcut: string };

const MOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

/** Formatting bar buttons, in display order (groups split by null). */
export const TOOLBAR_ITEMS: (ToolbarItem | null)[] = [
  { action: 'bold', label: 'Bold', shortcut: `${MOD}B` },
  { action: 'italic', label: 'Italic', shortcut: `${MOD}I` },
  { action: 'underline', label: 'Underline', shortcut: `${MOD}U` },
  { action: 'strike', label: 'Strikethrough', shortcut: `${MOD}Shift+X` },
  null,
  { action: 'link', label: 'Link', shortcut: `${MOD}Shift+U` },
  null,
  { action: 'numberedList', label: 'Numbered list', shortcut: `${MOD}Shift+7` },
  { action: 'bulletList', label: 'Bulleted list', shortcut: `${MOD}Shift+8` },
  null,
  { action: 'quote', label: 'Quote', shortcut: `${MOD}Shift+9` },
  { action: 'code', label: 'Code', shortcut: `${MOD}Shift+C` },
  { action: 'codeBlock', label: 'Code block', shortcut: `${MOD}Alt+Shift+C` },
];

/** Accepts "example.com" too; returns null for anything but http(s). */
export const normalizeUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};
