'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Matches the slide-out keyframes in WorkspaceShell.module.css. */
export const PANEL_CLOSE_MS = 280;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Lets a panel play its exit animation before it is really closed:
 * `close(apply)` flags `closing`, then runs `apply` after PANEL_CLOSE_MS.
 * `cancel()` (e.g. when the panel is reopened) aborts a pending close.
 */
export const useDelayedClose = () => {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setClosing(false);
  }, []);

  const close = useCallback(
    (apply: () => void) => {
      if (timer.current) {
        return;
      }
      if (prefersReducedMotion()) {
        apply();
        return;
      }
      setClosing(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setClosing(false);
        apply();
      }, PANEL_CLOSE_MS);
    },
    [],
  );

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return { closing, close, cancel };
};
