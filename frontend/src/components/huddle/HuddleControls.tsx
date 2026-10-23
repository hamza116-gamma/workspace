'use client';

import { Icon, type IconName } from '@/components/ui/Icon';
import { getDisplayMediaSupported } from '@/lib/webrtc';
import type { HuddleSession } from '@/hooks/useHuddleSession';
import styles from './HuddleControls.module.css';

const Control = ({
  icon,
  label,
  onClick,
  active = false,
  off = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  off?: boolean;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className={`${styles.control} ${active ? styles.active : ''} ${off ? styles.off : ''}`}
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active || off}
    aria-label={label}
    title={label}
  >
    <Icon name={icon} size={17} />
  </button>
);

// Mic / camera / screen / extras / leave (+ end for everyone, starter only).
export const HuddleControls = ({
  session,
  canEnd,
  onLeave,
  onEnd,
  extras,
  busy = false,
}: {
  session: HuddleSession;
  canEnd: boolean;
  onLeave: () => void;
  onEnd: () => void;
  extras?: React.ReactNode;
  busy?: boolean;
}) => (
  <div className={styles.controls}>
    <Control
      icon={session.muted || !session.hasMic ? 'mic-off' : 'mic'}
      label={session.muted ? 'Unmute' : 'Mute'}
      onClick={session.toggleMute}
      off={session.muted || !session.hasMic}
      disabled={!session.hasMic}
    />
    <Control
      icon={session.cameraOn ? 'video' : 'video-off'}
      label={session.cameraOn ? 'Turn camera off' : 'Turn camera on'}
      onClick={() => void session.toggleCamera()}
      active={session.cameraOn}
    />
    {getDisplayMediaSupported() && (
      <Control
        icon="screen"
        label={session.sharing ? 'Stop sharing' : 'Share screen'}
        onClick={() => void session.toggleScreen()}
        active={session.sharing}
      />
    )}
    {extras}
    <span className={styles.spacer} />
    {canEnd && (
      <button type="button" className={styles.end} onClick={onEnd} disabled={busy}>
        End for all
      </button>
    )}
    <button type="button" className={styles.leave} onClick={onLeave} disabled={busy}>
      <Icon name="phone-down" size={16} />
      Leave
    </button>
  </div>
);

export { Control as HuddleControlButton };
