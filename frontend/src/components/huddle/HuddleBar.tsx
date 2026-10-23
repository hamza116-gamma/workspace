'use client';

import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useHuddles } from '@/hooks/useHuddles';
import { useHuddleSession } from '@/hooks/useHuddleSession';
import { useHuddleReactions } from '@/hooks/useHuddleReactions';
import { useHuddleTitle } from '@/hooks/useHuddleTitle';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { useElapsed } from '@/hooks/useElapsed';
import { formatHuddleDuration } from '@/lib/webrtc';
import { HuddleHeader } from './HuddleHeader';
import { HuddleStage } from './HuddleStage';
import { HuddlePeople } from './HuddlePeople';
import { HuddleControls, HuddleControlButton } from './HuddleControls';
import { HuddleAddPeople } from './HuddleAddPeople';
import { HuddleReactionLayer, HuddleReactionPicker } from './HuddleReactions';
import { HuddleAudio } from './HuddleAudio';
import type { Huddle } from '@/types/huddle';
import styles from './HuddleBar.module.css';

const PHONE_QUERY = '(max-width: 900px)';

const HuddleBox = ({ huddle }: { huddle: Huddle }) => {
  const { user } = useAuth();
  const { leave, end, invite, busy, error, clearError, minimized, setMinimized } = useHuddles();
  const { open: threadOpen, openThread } = useThreadPanel();
  const session = useHuddleSession(huddle, user?.id);
  const reactions = useHuddleReactions(huddle.id);
  const title = useHuddleTitle(huddle);
  const elapsed = useElapsed(huddle.startedAt);

  const media = Object.fromEntries(session.peers.map((peer) => [peer.userId, peer.media]));
  const me = {
    id: user?.id ?? '',
    fullName: user?.fullName ?? 'You',
    avatarUrl: user?.avatarUrl ?? null,
  };
  const canEnd = huddle.startedBy.id === user?.id;
  const shownError = session.error ?? error;

  const openChat = () => {
    if (!huddle.messageId) return;
    openThread(huddle.messageId);
    if (window.matchMedia(PHONE_QUERY).matches) setMinimized(true);
  };

  // Audio keeps playing while minimised.
  const audio = session.peers.map((peer) => <HuddleAudio key={peer.userId} stream={peer.stream} />);

  if (minimized) {
    return (
      <div
        className={`huddle-surface ${styles.mini}`}
        role="region"
        aria-label="Huddle (minimised)"
      >
        {audio}
        <span className={styles.liveDot} aria-hidden />
        <span className={styles.miniTitle}>{title}</span>
        <span className={styles.timer}>{formatHuddleDuration(elapsed)}</span>
        <HuddleControlButton
          icon={session.muted || !session.hasMic ? 'mic-off' : 'mic'}
          label={session.muted ? 'Unmute' : 'Mute'}
          onClick={session.toggleMute}
          off={session.muted || !session.hasMic}
          disabled={!session.hasMic}
        />
        <HuddleControlButton icon="phone-down" label="Leave huddle" onClick={() => void leave()} />
        <HuddleControlButton
          icon="maximize"
          label="Expand huddle"
          onClick={() => setMinimized(false)}
        />
      </div>
    );
  }

  return (
    <section
      className={`huddle-surface ${styles.box} ${threadOpen ? styles.besideThread : ''}`}
      aria-label="Huddle"
    >
      {audio}
      <HuddleHeader huddle={huddle} title={title} onMinimize={() => setMinimized(true)} />
      <HuddleStage huddle={huddle} session={session} me={me} />
      <HuddlePeople
        huddle={huddle}
        myId={user?.id}
        media={media}
        myMuted={session.muted || !session.hasMic}
        onRingAgain={(userId) => void invite([userId])}
      />
      {shownError && (
        <p className={styles.error} role="alert">
          {shownError}
          <button
            type="button"
            onClick={() => {
              session.clearError();
              clearError();
            }}
            aria-label="Dismiss"
          >
            <Icon name="close" size={12} />
          </button>
        </p>
      )}
      <HuddleControls
        session={session}
        canEnd={canEnd}
        busy={busy}
        onLeave={() => void leave()}
        onEnd={() => void end()}
        extras={
          <>
            <HuddleReactionPicker onPick={reactions.send} />
            <HuddleAddPeople huddleId={huddle.id} onInvite={(ids) => void invite(ids)} />
            {huddle.messageId && (
              <HuddleControlButton icon="message" label="Huddle chat" onClick={openChat} />
            )}
          </>
        }
      />
      <HuddleReactionLayer items={reactions.items} />
    </section>
  );
};

// Global floating huddle box (+ the caller's "declined / no answer" notice).
export const HuddleBar = () => {
  const { activeHuddle, notice, clearNotice } = useHuddles();
  if (activeHuddle) {
    return <HuddleBox key={activeHuddle.id} huddle={activeHuddle} />;
  }
  if (!notice) return null;
  return (
    <div className={`huddle-surface ${styles.notice}`} role="status">
      <Icon name="phone-down" size={14} />
      {notice}
      <button type="button" onClick={clearNotice} aria-label="Dismiss">
        <Icon name="close" size={12} />
      </button>
    </div>
  );
};
