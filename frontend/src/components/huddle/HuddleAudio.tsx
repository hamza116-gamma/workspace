'use client';

import { useEffect, useRef } from 'react';

// Plays one peer's audio. Kept mounted while the huddle box is minimised.
export const HuddleAudio = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    if (audio.srcObject !== stream) audio.srcObject = stream;
    void audio.play().catch(() => undefined);
  }, [stream]);
  return <audio ref={ref} autoPlay hidden />;
};
