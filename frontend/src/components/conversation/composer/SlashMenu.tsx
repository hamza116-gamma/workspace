'use client';

import type { SlashCommand } from '@/lib/slashCommands';
import styles from '../MessageComposer.module.css';

/** Suggestions while typing "/word" (arrows / Tab / Enter complete). */
export const SlashMenu = ({
  commands,
  highlight,
  onHighlight,
  onPick,
}: {
  commands: SlashCommand[];
  highlight: number;
  onHighlight: (index: number) => void;
  onPick: (command: SlashCommand) => void;
}) => (
  <div className={styles.mentionMenu} role="listbox">
    <p className={styles.mentionHeading}>Shortcuts</p>
    {commands.map((command, index) => (
      <button
        key={command.name}
        type="button"
        role="option"
        aria-selected={index === highlight}
        className={`${styles.mentionItem} ${index === highlight ? styles.mentionActive : ''}`}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => onHighlight(index)}
        onClick={() => onPick(command)}
      >
        <span className={styles.mentionGlyph}>/</span>
        <span className={styles.mentionLabel}>
          /{command.name}
          {command.args && <span className={styles.slashArgs}> {command.args}</span>}
        </span>
        <span className={styles.mentionSub}>{command.description}</span>
      </button>
    ))}
  </div>
);
