'use client';

import { HuddleVideoTile } from './HuddleVideoTile';
import { HuddleWave } from './HuddleWave';
import { Icon } from '@/components/ui/Icon';
import type { HuddleSession } from '@/hooks/useHuddleSession';
import type { Huddle, HuddleUser } from '@/types/huddle';
import styles from './HuddleBar.module.css';

// Video stage (only when someone has video / a shared screen; otherwise a
// big wave). The sharer never sees their own screen: a card says so instead.
export const HuddleStage = ({
  huddle,
  session,
  me,
}: {
  huddle: Huddle;
  session: HuddleSession;
  me: HuddleUser;
}) => {
  const usersById = new Map(huddle.participants.map((p) => [p.user.id, p.user]));
  const anyVideo =
    session.cameraOn || session.peers.some((peer) => peer.media.video || peer.media.screen);

  return (
    <>
      {session.sharing && (
        <div className={styles.sharing}>
          <Icon name="screen" size={16} />
          <span>You&apos;re sharing your screen</span>
          <button type="button" className={styles.stopShare} onClick={session.stopShare}>
            Stop sharing
          </button>
        </div>
      )}
      {anyVideo ? (
        <div className={styles.stage}>
          {session.peers
            .filter((peer) => peer.media.screen)
            .map((peer) => (
              <HuddleVideoTile
                key={`screen-${peer.userId}`}
                user={
                  usersById.get(peer.userId) ?? { id: peer.userId, fullName: '', avatarUrl: null }
                }
                stream={peer.stream}
                showVideo
                screen
              />
            ))}
          <HuddleVideoTile
            user={me}
            stream={session.localPreview}
            showVideo={session.cameraOn}
            micOff={session.muted || !session.hasMic}
            self
          />
          {session.peers
            .filter((peer) => !peer.media.screen)
            .map((peer) => (
              <HuddleVideoTile
                key={peer.userId}
                user={
                  usersById.get(peer.userId) ?? { id: peer.userId, fullName: '', avatarUrl: null }
                }
                stream={peer.stream}
                showVideo={peer.media.video}
                micOff={!peer.media.audio}
                connecting={peer.state === 'new' || peer.state === 'connecting'}
              />
            ))}
        </div>
      ) : (
        <div className={styles.waveStage}>
          <HuddleWave size="lg" />
        </div>
      )}
    </>
  );
};
