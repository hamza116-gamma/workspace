'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AudioPlayer } from './AudioPlayer';
import styles from './VoiceRecorder.module.css';

const BAR_COUNT = 22;

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// Live camera preview for video clips (muted, mirrored).
const LivePreview = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} className={styles.live} autoPlay muted playsInline />;
};

// Slack-style two-step voice / video clip recorder:
//  - recording: red pulsing dot + timer + live level meter + discard + STOP
//  - review:    playback preview + discard + send
export const VoiceRecorder = ({
  kind = 'audio',
  stream = null,
  mode,
  seconds,
  level,
  previewUrl,
  sending = false,
  onStop,
  onDiscard,
  onSend,
}: {
  kind?: 'audio' | 'video';
  stream?: MediaStream | null;
  mode: 'recording' | 'review';
  seconds: number;
  level: number;
  previewUrl?: string | null;
  sending?: boolean;
  onStop: () => void;
  onDiscard: () => void;
  onSend: () => void;
}) => {
  const label = kind === 'video' ? 'video clip' : 'voice message';
  if (mode === 'review' && previewUrl) {
    return (
      <div className={styles.bar}>
        {kind === 'video' ? (
          <video className={styles.playback} src={previewUrl} controls playsInline />
        ) : (
          <AudioPlayer src={previewUrl} name="Voice message" compact />
        )}
        <button
          type="button"
          className={styles.cancel}
          onClick={onDiscard}
          disabled={sending}
          aria-label={`Discard ${label}`}
          title="Discard"
        >
          <Icon name="trash" size={18} />
        </button>
        <button
          type="button"
          className={styles.send}
          onClick={onSend}
          disabled={sending}
          aria-label={`Send ${label}`}
          title={`Send ${label}`}
        >
          <Icon name="send" size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      {kind === 'video' && stream && <LivePreview stream={stream} />}
      <span className={styles.recording}>
        <span className={styles.dot} aria-hidden />
        <span className={styles.time}>{formatDuration(seconds)}</span>
      </span>

      <span className={styles.meter} aria-hidden>
        {Array.from({ length: BAR_COUNT }).map((_, index) => {
          const weight = 0.35 + ((index * 7) % 11) / 14;
          const height = Math.max(6, Math.round(Math.min(1, level * weight) * 26));
          return <span key={index} style={{ height }} />;
        })}
      </span>

      <button
        type="button"
        className={styles.cancel}
        onClick={onDiscard}
        aria-label="Discard recording"
        title="Discard"
      >
        <Icon name="trash" size={18} />
      </button>
      <button
        type="button"
        className={styles.stop}
        onClick={onStop}
        aria-label="Stop recording"
        title="Stop recording"
      >
        <Icon name="stop" size={16} filled />
      </button>
    </div>
  );
};
