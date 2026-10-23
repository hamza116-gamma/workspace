'use client';

import { Icon } from '@/components/ui/Icon';
import { useHuddles } from '@/hooks/useHuddles';
import type { HuddleTarget } from '@/types/huddle';
import styles from './HuddlePill.module.css';

// Live-huddle indicator for sidebar rows.
export const HuddlePill = ({ target }: { target: HuddleTarget }) => {
  const { huddleForTarget, isJoined } = useHuddles();
  const huddle = huddleForTarget(target);
  if (!huddle) return null;
  const count = huddle.participants.length;
  return (
    <span
      className={`${styles.pill} ${isJoined(huddle.id) ? styles.joined : ''}`}
      title={`Huddle live with ${count} ${count === 1 ? 'person' : 'people'}`}
      aria-label="Huddle live"
    >
      <Icon name="headphones" size={11} />
      {count}
    </span>
  );
};
