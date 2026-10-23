'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { HuddlePeer } from '@/lib/huddlePeer';
import { getDisplayMediaSupported, mediaErrorMessage, stopStream } from '@/lib/webrtc';
import type { Huddle, HuddlePeerMedia, HuddleSignalType } from '@/types/huddle';

export type HuddlePeerView = {
  userId: string;
  stream: MediaStream;
  media: HuddlePeerMedia;
  state: RTCPeerConnectionState;
};

type SignalEvent = { huddleId: string; from: string; type: HuddleSignalType; data: unknown };
type MediaEvent = HuddlePeerMedia & { huddleId: string; userId: string };

const NO_MEDIA: HuddlePeerMedia = { audio: true, video: false, screen: false };

// WebRTC mesh for the huddle this tab has joined. Signalling goes over the
// socket (huddle:signal), the lower user id always sends the offer.
export const useHuddleSession = (huddle: Huddle | null, myId: string | undefined) => {
  const { socket } = useSocket();
  const huddleId = huddle?.id ?? null;

  const peersRef = useRef(new Map<string, HuddlePeer>());
  const mediaRef = useRef(new Map<string, HuddlePeerMedia>());
  const audioRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const outgoing = useCallback(
    () => ({
      audio: audioRef.current?.getAudioTracks()[0] ?? null,
      video:
        screenRef.current?.getVideoTracks()[0] ?? cameraRef.current?.getVideoTracks()[0] ?? null,
    }),
    [],
  );

  const sendMedia = useCallback(() => {
    if (!socket || !huddleId) return;
    socket.emit('huddle:media', {
      huddleId,
      audio: Boolean(audioRef.current) && !muted,
      video: Boolean(cameraRef.current) && !screenRef.current,
      screen: Boolean(screenRef.current),
    });
  }, [socket, huddleId, muted]);

  const closePeer = useCallback(
    (userId: string) => {
      peersRef.current.get(userId)?.close();
      peersRef.current.delete(userId);
      bump();
    },
    [bump],
  );

  const createPeer = useCallback(
    (userId: string, initiator: boolean) => {
      peersRef.current.get(userId)?.close();
      const peer = new HuddlePeer(initiator, outgoing, {
        signal: (type, data) => socket?.emit('huddle:signal', { huddleId, to: userId, type, data }),
        change: bump,
      });
      peersRef.current.set(userId, peer);
      bump();
      return peer;
    },
    [socket, huddleId, outgoing, bump],
  );

  const offerTo = useCallback(
    (userId: string) => {
      createPeer(userId, true)
        .start()
        .catch(() => setError('Could not connect to a participant.'));
    },
    [createPeer],
  );

  // 1) Join: microphone, then subscribe to the huddle room.
  useEffect(() => {
    if (!huddleId || !socket) return;
    let cancelled = false;
    const peers = peersRef.current;
    const media = mediaRef.current;
    (async () => {
      try {
        audioRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stopStream(audioRef.current);
          return;
        }
        setHasMic(true);
      } catch (err) {
        // Listen-only when the microphone is unavailable.
        setError(mediaErrorMessage(err, 'microphone'));
      }
      socket.emit('huddle:subscribe', huddleId, (result: { ok: boolean; error?: string }) => {
        if (cancelled) return;
        if (!result?.ok) setError(result?.error ?? 'Could not join the huddle.');
        else setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      socket.emit('huddle:unsubscribe', huddleId);
      peers.forEach((peer) => peer.close());
      peers.clear();
      media.clear();
      [audioRef, cameraRef, screenRef].forEach((ref) => {
        stopStream(ref.current);
        ref.current = null;
      });
      setReady(false);
      setHasMic(false);
      setCameraOn(false);
      setSharing(false);
      setMuted(false);
    };
  }, [huddleId, socket]);

  // 2) Keep one peer per other participant; the lower id offers.
  const participantIds = (huddle?.participants ?? [])
    .map((p) => p.user.id)
    .sort()
    .join(',');
  useEffect(() => {
    if (!ready || !myId) return;
    const ids = participantIds ? participantIds.split(',') : [];
    const others = ids.filter((id) => id !== myId);
    peersRef.current.forEach((_peer, id) => {
      if (!others.includes(id)) {
        closePeer(id);
        mediaRef.current.delete(id);
      }
    });
    others.forEach((id) => {
      if (!peersRef.current.has(id) && myId < id) offerTo(id);
    });
    sendMedia();
  }, [ready, myId, participantIds, closePeer, offerTo, sendMedia]);

  // 3) Signals + media states from the room.
  useEffect(() => {
    if (!socket || !huddleId || !ready || !myId) return;
    const onSignal = (event: SignalEvent) => {
      if (event.huddleId !== huddleId) return;
      let peer = peersRef.current.get(event.from);
      // A new offer always starts a fresh connection (peer rejoined/restarted).
      if (event.type === 'offer') peer = createPeer(event.from, false);
      peer?.handle(event.type, event.data).catch(() => setError('Connection problem.'));
    };
    const onMedia = (event: MediaEvent) => {
      if (event.huddleId !== huddleId) return;
      mediaRef.current.set(event.userId, {
        audio: event.audio,
        video: event.video,
        screen: event.screen,
      });
      // They just subscribed and may have missed our offer: send it again.
      const peer = peersRef.current.get(event.userId);
      if (myId < event.userId && (!peer || !peer.answered)) offerTo(event.userId);
      bump();
    };
    socket.on('huddle:signal', onSignal);
    socket.on('huddle:media', onMedia);
    return () => {
      socket.off('huddle:signal', onSignal);
      socket.off('huddle:media', onMedia);
    };
  }, [socket, huddleId, ready, myId, createPeer, offerTo, bump]);

  useEffect(() => {
    if (ready) sendMedia();
  }, [ready, muted, cameraOn, sharing, sendMedia]);

  const applyVideo = useCallback(() => {
    const { video } = outgoing();
    peersRef.current.forEach((peer) => void peer.setVideoTrack(video));
  }, [outgoing]);

  const toggleMute = useCallback(() => {
    const track = audioRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = muted;
    setMuted(!muted);
  }, [muted]);

  const toggleCamera = useCallback(async () => {
    setError(null);
    if (cameraRef.current) {
      stopStream(cameraRef.current);
      cameraRef.current = null;
      setCameraOn(false);
      applyVideo();
      return;
    }
    try {
      cameraRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraOn(true);
      applyVideo();
    } catch (err) {
      setError(mediaErrorMessage(err, 'camera'));
    }
  }, [applyVideo]);

  const stopShare = useCallback(() => {
    stopStream(screenRef.current);
    screenRef.current = null;
    setSharing(false);
    // Falls back to the camera (if on) or no video.
    applyVideo();
  }, [applyVideo]);

  const toggleScreen = useCallback(async () => {
    setError(null);
    if (screenRef.current) {
      stopShare();
      return;
    }
    if (!getDisplayMediaSupported()) {
      setError('Screen sharing is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.contentHint = 'detail';
        // The browser's own "Stop sharing" bar.
        track.onended = () => stopShare();
      }
      screenRef.current = stream;
      setSharing(true);
      applyVideo();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
        setError(mediaErrorMessage(err, 'screen'));
      }
    }
  }, [applyVideo, stopShare]);

  const peers: HuddlePeerView[] = [];
  peersRef.current.forEach((peer, userId) => {
    peers.push({
      userId,
      stream: peer.stream,
      media: mediaRef.current.get(userId) ?? NO_MEDIA,
      state: peer.state,
    });
  });

  return {
    version,
    ready,
    peers,
    muted,
    hasMic,
    cameraOn,
    sharing,
    // The sharer never previews their own screen (it would mirror itself):
    // the own tile shows the camera only.
    localPreview: cameraOn ? cameraRef.current : null,
    error,
    clearError: () => setError(null),
    toggleMute,
    toggleCamera,
    toggleScreen,
    stopShare,
  };
};

export type HuddleSession = ReturnType<typeof useHuddleSession>;
