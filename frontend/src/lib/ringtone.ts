// Two-tone ring built with WebAudio (no audio files). Returns a stop function.
export const startRingtone = (): (() => void) => {
  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AudioCtx) return () => undefined;
  const context = new AudioCtx();
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const tones = [660, 880].map((frequency) => {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start();
    return osc;
  });

  // ring-ring ... pause, every 2.4s
  const ring = () => {
    const t = context.currentTime;
    [0, 0.5].forEach((offset) => {
      gain.gain.setValueAtTime(0.12, t + offset);
      gain.gain.setValueAtTime(0, t + offset + 0.35);
    });
  };
  ring();
  const timer = setInterval(ring, 2400);

  return () => {
    clearInterval(timer);
    tones.forEach((osc) => osc.stop());
    void context.close().catch(() => undefined);
  };
};
