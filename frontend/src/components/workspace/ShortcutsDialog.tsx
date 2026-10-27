'use client';

import { Modal } from '@/components/ui/Modal';
import styles from './QuickSwitcher.module.css';

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl/Cmd + K', action: 'Search: jump to channels, people, tasks and messages' },
  { keys: 'Ctrl/Cmd + /', action: 'Show keyboard shortcuts' },
  { keys: 'Enter', action: 'Send message' },
  { keys: 'Shift + Enter', action: 'New line' },
  { keys: '↑ (empty composer)', action: 'Edit your last message' },
  { keys: 'Ctrl/Cmd + B', action: 'Bold' },
  { keys: 'Ctrl/Cmd + I', action: 'Italic' },
  { keys: 'Ctrl/Cmd + Shift + X', action: 'Strikethrough' },
  { keys: 'Ctrl/Cmd + Shift + C', action: 'Code' },
  { keys: 'Esc', action: 'Close dialogs and menus' },
];

export const ShortcutsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Modal open={open} title="Keyboard shortcuts" onClose={onClose}>
    <div>
      {SHORTCUTS.map((shortcut) => (
        <div key={shortcut.keys} className={styles.item}>
          <span className={styles.label}>{shortcut.action}</span>
          <span className={styles.hint}>
            <kbd className={styles.kbd}>{shortcut.keys}</kbd>
          </span>
        </div>
      ))}
    </div>
  </Modal>
);
