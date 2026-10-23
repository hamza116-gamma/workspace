'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'stopped';
export type RecorderKind = 'audio' | 'video';

// Slack-style caps: 5 minutes of audio, 2 minutes of video.
const MAX_SECONDS: Record<RecorderKind, number> = { audio: 300, video: 120 };

const MIME_CANDIDATES: Record<RecorderKind, string[]> = {
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'],
  video: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'],
};

const CONSTRAINTS: Record<RecorderKind, MediaStreamConstraints> = {
  audio: { audio: true },
  video: { audio: true, video: { width: { ideal: 640 }, height: { ideal: 480 } } },
};

const pickMimeType = (kind: RecorderKind): string => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }
  return MIME_CANDIDATES[kind].find((type) => MediaRecorder.isTypeSupported?.(type)) ?? '';
};

const extensionFor = (mimeType: string, kind: RecorderKind) => {
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  if (mimeType.includes('mp4')) {
    return kind === 'video' ? 'mp4' : 'm4a';
  }
  return 'webm';
};

// Records a voice clip (kind 'audio') or a 640x480 video clip (kind 'video')
// with MediaRecorder. Two-step, Slack-style: start -> stop (keeps a preview to
// play/send) or discard. Reports elapsed time, a normalised input level for
// the meter and, while recording, the live `stream` (camera preview).
export const useAudioRecorder = (kind: RecorderKind = 'audio') => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((file: File | null) => void) | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const supported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const clearPreview = useCallback(() => {
    setPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!supported || recorderRef.current) {
      return;
    }
    clearPreview();
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS[kind]);
      streamRef.current = stream;
      setStream(stream);

      const mimeType = pickMimeType(kind);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const type = (recorder.mimeType || mimeType || `${kind}/webm`).split(';')[0];
        const blob = new Blob(chunksRef.current, { type });
        const file =
          blob.size > 0
            ? new File(
                [blob],
                `${kind === 'video' ? 'video' : 'voice'}-${Date.now()}.${extensionFor(type, kind)}`,
                {
                  type,
                },
              )
            : null;
        const resolve = resolveRef.current;
        resolveRef.current = null;
        resolve?.(file);
      };
      recorderRef.current = recorder;

      // Input level meter (best effort - ignore if Web Audio is unavailable).
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const context = new AudioCtx();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = context;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const sample = () => {
          const node = analyserRef.current;
          if (!node) {
            return;
          }
          node.getByteFrequencyData(data);
          let sum = 0;
          for (const value of data) {
            sum += value;
          }
          setLevel(Math.min(1, sum / data.length / 128));
          rafRef.current = requestAnimationFrame(sample);
        };
        rafRef.current = requestAnimationFrame(sample);
      }

      recorder.start(250);
      setSeconds(0);
      setStatus('recording');
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch (err) {
      cleanup();
      setStatus('idle');
      const denied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setError(
        denied
          ? kind === 'video'
            ? 'Camera or microphone permission denied'
            : 'Microphone permission denied'
          : 'Unable to start recording',
      );
    }
  }, [supported, cleanup, clearPreview, kind]);

  // Stops the recorder. Keeps the clip as a preview (to play/send) unless
  // `discard` is true.
  const finish = useCallback(
    (discard: boolean): Promise<File | null> =>
      new Promise((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
          cleanup();
          setSeconds(0);
          setLevel(0);
          if (discard) {
            clearPreview();
            setStatus('idle');
          }
          resolve(null);
          return;
        }
        resolveRef.current = (file) => {
          cleanup();
          setSeconds(0);
          setLevel(0);
          if (!file || discard) {
            clearPreview();
            setStatus('idle');
          } else {
            setPreview({ file, url: URL.createObjectURL(file) });
            setStatus('stopped');
          }
          resolve(discard ? null : file);
        };
        try {
          recorder.stop();
        } catch {
          resolveRef.current?.(null);
        }
      }),
    [cleanup, clearPreview],
  );

  const stop = useCallback(() => finish(false), [finish]);

  const discard = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      await finish(true);
    } else {
      clearPreview();
      setStatus('idle');
    }
  }, [finish, clearPreview]);

  // Keep the latest preview URL for the unmount revoke.
  previewUrlRef.current = preview?.url ?? null;

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      cleanup();
    },
    [cleanup],
  );

  return {
    supported,
    status,
    seconds,
    level,
    error,
    previewFile: preview?.file ?? null,
    previewUrl: preview?.url ?? null,
    start,
    stop,
    discard,
    maxSeconds: MAX_SECONDS[kind],
    kind,
    stream,
  };
};
