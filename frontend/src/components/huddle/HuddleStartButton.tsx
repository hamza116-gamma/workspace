'use client';

import { Icon } from '@/components/ui/Icon';
import { useHuddles } from '@/hooks/useHuddles';
import { isWebrtcSupported } from '@/lib/webrtc';
import type { HuddleTarget } from '@/types/huddle';
import styles from './HuddleStartButton.module.css';

// Header pill next to the facepile: "Huddle" / "Join huddle · N" / "Leave huddle".
export const HuddleStartButton = ({
  target,
  disabled = false,
}: {
  target: HuddleTarget;
  disabled?: boolean;
}) => {
  const { huddleForTarget, isJoined, start, join, leave, busy } = useHuddles();
  const huddle = huddleForTarget(target);
  const joined = isJoined(huddle?.id);

  const onClick = () => {
    if (!isWebrtcSupported()) {
      window.alert('Huddles need a browser with WebRTC and microphone access.');
      return;
    }
    if (joined) void leave();
    else if (huddle) void join(huddle.id);
    else void start(target);
  };

  const label = joined
    ? 'Leave huddle'
    : huddle
      ? `Join huddle · ${huddle.participants.length}`
      : 'Huddle';

  return (
    <button
      type="button"
      className={`${styles.button} ${joined ? styles.leave : huddle ? styles.live : ''}`}
      onClick={onClick}
      disabled={disabled || busy}
      title={joined ? 'Leave the huddle' : huddle ? 'Join the live huddle' : 'Start a huddle'}
    >
      <Icon name={joined ? 'phone-down' : 'headphones'} size={15} />
      <span className={styles.label}>{label}</span>
    </button>
  );
};
