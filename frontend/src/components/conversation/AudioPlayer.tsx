'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useDownload } from '@/hooks/useDownload';
import { extractWaveform } from '@/lib/waveform';
import styles from './AudioPlayer.module.css';

const BAR_COUNT = 44;
const SPEEDS = [1, 1.5, 2];

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

// Placeholder bars shown until the real waveform is decoded (or when decoding
// is unavailable). Deterministic per file so it never jitters.
const useFallbackBars = (seed: string) =>
  useMemo(() => {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Array.from({ length: BAR_COUNT }).map((_, index) => {
      hash ^= index + 1;
      hash = Math.imul(hash, 16777619);
      return 0.25 + (Math.abs(hash % 100) / 100) * 0.75;
    });
  }, [seed]);

export const AudioPlayer = ({
  src,
  name,
  duration,
  downloadUrl,
  waveformSource,
  compact = false,
}: {
  src: string;
  name: string;
  duration?: number | null;
  downloadUrl?: string;
  // Where to read the audio for waveform extraction (defaults to `src`).
  waveformSource?: string | Blob;
  compact?: boolean;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const { download } = useDownload();
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);
  const [rate, setRate] = useState(1);
  const [decoded, setDecoded] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState('');
  // MediaRecorder WebM has no duration in its header (the browser reports
  // Infinity); seeking far past the end makes it compute the real length.
  const probingRef = useRef(false);

  const fallback = useFallbackBars(name || src);
  const bars = decoded ?? fallback;

  // Decode the real waveform (amplitude) + exact duration from the audio.
  useEffect(() => {
    let active = true;
    setDecoded(null);
    void extractWaveform(waveformSource ?? src, BAR_COUNT).then((result) => {
      if (active && result) {
        setDecoded(result.bars);
        if (Number.isFinite(result.duration) && result.duration > 0) {
          setTotal(result.duration);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [waveformSource, src]);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setRate(1);
    setFailed(false);
    setFailReason('');
    setTotal(duration ?? 0);
  }, [src, duration]);

  // Drive progress with requestAnimationFrame while playing so the fill and
  // the playhead dot move smoothly (the `timeupdate` event only fires ~4/s).
  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setCurrent(audio.currentTime);
        if (!audio.paused) {
          rafRef.current = requestAnimationFrame(tick);
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  useEffect(() => stopLoop, [stopLoop]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setFailed(false);
    if (probingRef.current) {
      // Still measuring the length: rewind before playing.
      probingRef.current = false;
      audio.currentTime = 0;
    }
    audio.playbackRate = rate;
    const fail = (err: unknown) => {
      // load()/rejections can leave the element paused without a 'pause'
      // event: reset the UI so the button never claims to be playing.
      setPlaying(false);
      stopLoop();
      setFailed(true);
      setFailReason(err instanceof Error ? `${err.name}: ${err.message}` : 'Playback failed');
      console.warn('[AudioPlayer] play() failed', err, {
        src: audio.currentSrc,
        readyState: audio.readyState,
        networkState: audio.networkState,
      });
    };
    audio.play().catch((first) => {
      console.warn('[AudioPlayer] first play() rejected, retrying', first);
      // A stale/half-loaded source: reload once and retry.
      audio.load();
      audio.playbackRate = rate;
      audio.play().catch(fail);
    });
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const seek = (event: React.MouseEvent<HTMLButtonElement>) => {
    const audio = audioRef.current;
    const element = waveformRef.current;
    if (!audio || !element || !total) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * total;
    setCurrent(audio.currentTime);
  };

  const progress = total > 0 ? Math.min(1, current / total) : 0;
  // One source of truth for the fill + thumb so they can never disagree.
  const playedCount = Math.round(progress * bars.length);

  return (
    <div className={`${styles.player} ${compact ? styles.compact : ''}`}>
      <button
        type="button"
        className={styles.play}
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        title={playing ? 'Pause' : 'Play'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} filled />
      </button>

      <button
        ref={waveformRef}
        type="button"
        className={styles.waveform}
        onClick={seek}
        aria-label="Seek voice message"
      >
        {bars.map((height, index) => (
          <span
            key={index}
            className={index < playedCount ? styles.barPlayed : styles.bar}
            style={{ height: Math.round(4 + height * 22) }}
          />
        ))}
        <span
          className={styles.thumb}
          style={{ left: `${progress * 100}%`, transform: 'translate(-50%, -50%)' }}
          aria-hidden
        />
      </button>

      <span className={styles.time} title={failed ? failReason : undefined}>
        {failed ? "Can't play" : playing || current > 0 ? formatDuration(current) : formatDuration(total)}
      </span>

      <button
        type="button"
        className={styles.speed}
        onClick={cycleSpeed}
        aria-label={`Playback speed ${rate}x`}
        title="Playback speed"
      >
        {rate}x
      </button>

      {downloadUrl && (
        <button
          type="button"
          className={styles.download}
          onClick={() => void download({ url: downloadUrl, name })}
          aria-label={`Download ${name}`}
          title="Download"
        >
          <Icon name="download" size={16} />
        </button>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setTotal(audio.duration);
          } else if (audio.duration === Infinity && !probingRef.current) {
            probingRef.current = true;
            audio.currentTime = 1e101;
          }
        }}
        onDurationChange={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setTotal(audio.duration);
            if (probingRef.current) {
              probingRef.current = false;
              audio.currentTime = 0;
            }
          }
        }}
        // Backup for the rAF loop (throttled/paused in some browsers/tabs).
        onTimeUpdate={(event) => {
          if (!probingRef.current) {
            setCurrent(event.currentTarget.currentTime);
          }
        }}
        onError={() => setFailed(true)}
        onPlay={() => {
          setPlaying(true);
          startLoop();
        }}
        onPause={() => {
          setPlaying(false);
          stopLoop();
        }}
        onEnded={() => {
          setPlaying(false);
          stopLoop();
          setCurrent(0);
        }}
      />
    </div>
  );
};
