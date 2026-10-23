'use client';

import { useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import type { HuddleUser } from '@/types/huddle';
import styles from './HuddleVideoTile.module.css';

// One person: live <video> (always muted - audio plays in HuddleAudio) or
// their avatar. Shared screens get a wide 16:9 letterboxed tile (no crop).
export const HuddleVideoTile = ({
  user,
  stream,
  showVideo,
  screen = false,
  micOff = false,
  self = false,
  connecting = false,
}: {
  user: HuddleUser;
  stream: MediaStream | null;
  showVideo: boolean;
  screen?: boolean;
  micOff?: boolean;
  self?: boolean;
  connecting?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (stream && showVideo) void video.play().catch(() => undefined);
  }, [stream, showVideo]);

  return (
    <div className={`${styles.tile} ${screen ? styles.screen : ''}`}>
      <video
        ref={videoRef}
        className={`${styles.video} ${self && !screen ? styles.mirror : ''}`}
        autoPlay
        playsInline
        muted
        hidden={!showVideo || !stream}
      />
      {(!showVideo || !stream) && (
        <div className={styles.fallback}>
          <Avatar name={user.fullName} src={user.avatarUrl} size={48} />
        </div>
      )}
      <span className={styles.name}>
        {micOff && <Icon name="mic-off" size={12} />}
        {screen && <Icon name="screen" size={12} />}
        {self ? 'You' : user.fullName.split(' ')[0]}
        {connecting && <span className={styles.connecting}> &middot; connecting</span>}
      </span>
    </div>
  );
};
