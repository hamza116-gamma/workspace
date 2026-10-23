'use client';

import { useState } from 'react';
import { HUDDLE_REACTIONS, type FloatingReaction } from '@/hooks/useHuddleReactions';
import { HuddleControlButton } from './HuddleControls';
import styles from './HuddleReactions.module.css';

export const HuddleReactionPicker = ({ onPick }: { onPick: (emoji: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.anchor}>
      <HuddleControlButton
        icon="smile"
        label="Send a reaction"
        onClick={() => setOpen((value) => !value)}
        active={open}
      />
      {open && (
        <span className={styles.picker} role="menu">
          {HUDDLE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className={styles.emoji}
              onClick={() => onPick(emoji)}
            >
              {emoji}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};

// Reactions float up over the huddle box with the sender's name.
export const HuddleReactionLayer = ({ items }: { items: FloatingReaction[] }) => (
  <div className={styles.layer} aria-live="polite">
    {items.map((item) => (
      <span key={item.id} className={styles.float} style={{ left: `${item.left}%` }}>
        <span className={styles.big}>{item.emoji}</span>
        <span className={styles.who}>{item.name}</span>
      </span>
    ))}
  </div>
);
