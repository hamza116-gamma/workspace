// Decodes audio (local Blob or a URL) and extracts a real amplitude waveform
// for the player. Falls back to null when decoding is not possible (then the
// player uses a stable placeholder).

export type WaveformSource = Blob | string;
export type WaveformResult = { bars: number[]; duration: number };

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!audioContext) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    audioContext = new Ctor();
  }
  return audioContext;
};

const cache = new Map<string, WaveformResult>();

const cacheKey = (source: WaveformSource, bars: number) =>
  typeof source === 'string' ? `${bars}|${source}` : `${bars}|blob|${source.size}|${source.type}`;

export const extractWaveform = async (
  source: WaveformSource,
  bars = 40,
): Promise<WaveformResult | null> => {
  const key = cacheKey(source, bars);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const context = getAudioContext();
  if (!context) {
    return null;
  }

  try {
    const bytes =
      typeof source === 'string'
        ? await (await fetch(source, { credentials: 'include' })).arrayBuffer()
        : await source.arrayBuffer();

    // A copy avoids decodeAudioData detaching the source buffer in some browsers.
    const audio = await context.decodeAudioData(bytes.slice(0));
    const channel = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / bars));
    const step = Math.max(1, Math.floor(block / 200));

    const peaks: number[] = new Array(bars).fill(0);
    for (let index = 0; index < bars; index += 1) {
      const start = index * block;
      const end = Math.min(channel.length, start + block);
      let max = 0;
      for (let offset = start; offset < end; offset += step) {
        const value = Math.abs(channel[offset]);
        if (value > max) {
          max = value;
        }
      }
      peaks[index] = max;
    }

    const loudest = Math.max(...peaks, 0.0001);
    // Perceptual (sqrt-ish) scaling + a visible floor so even quiet clips
    // (and silence between words) still read as a proper waveform.
    const normalized = peaks.map((value) =>
      Math.min(1, Math.max(0.1, Math.pow(value / loudest, 0.6))),
    );
    const result: WaveformResult = { bars: normalized, duration: audio.duration };
    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
};
