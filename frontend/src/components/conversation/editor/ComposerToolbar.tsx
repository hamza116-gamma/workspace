'use client';

import { Fragment } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TOOLBAR_ITEMS, type ShortcutAction } from '@/lib/composerFormat';
import type { ActiveFormats } from './RichEditor';
import styles from './ComposerToolbar.module.css';

const GLYPHS: Partial<Record<ShortcutAction, { text: string; className: string }>> = {
  bold: { text: 'B', className: styles.bold },
  italic: { text: 'I', className: styles.italic },
  underline: { text: 'U', className: styles.underline },
  strike: { text: 'S', className: styles.strike },
};

const ICONS: Partial<Record<ShortcutAction, IconName>> = {
  link: 'link',
  numberedList: 'list-ordered',
  bulletList: 'list',
  quote: 'quote',
  code: 'code',
  codeBlock: 'code-block',
};

/**
 * The formatting row (`.fmt` in the design). Buttons keep the editor's
 * selection (mousedown is prevented) and show the active formats.
 */
export const ComposerToolbar = ({
  active,
  disabled = false,
  onAction,
}: {
  active: ActiveFormats;
  disabled?: boolean;
  onAction: (action: ShortcutAction) => void;
}) => (
  <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
    {TOOLBAR_ITEMS.map((item, index) => {
      if (!item) {
        return <span key={`sep-${index}`} className={styles.sep} aria-hidden />;
      }
      const glyph = GLYPHS[item.action];
      const icon = ICONS[item.action];
      const pressed = Boolean(active[item.action]);
      return (
        <Fragment key={item.action}>
          <button
            type="button"
            className={`${styles.button} ${pressed ? styles.on : ''}`}
            aria-pressed={pressed}
            aria-label={item.label}
            title={`${item.label} (${item.shortcut})`}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onAction(item.action)}
          >
            {glyph ? (
              <span className={glyph.className}>{glyph.text}</span>
            ) : (
              icon && <Icon name={icon} size={15} />
            )}
          </button>
        </Fragment>
      );
    })}
  </div>
);
