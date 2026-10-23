'use client';

import { createContext, useCallback, useMemo, useState } from 'react';
import { useDelayedClose } from '@/hooks/useDelayedClose';

type WorkspaceUiValue = {
  detailsOpen: boolean;
  /** True while the details panel plays its slide-out before closing. */
  detailsClosing: boolean;
  toggleDetails: () => void;
  openDetails: () => void;
  closeDetails: () => void;
  /** Mobile (<=900px) navigation drawer: rail + channel list. */
  navOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
};

export const WorkspaceUiContext = createContext<WorkspaceUiValue | null>(null);

export const WorkspaceUiProvider = ({ children }: { children: React.ReactNode }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const { closing: detailsClosing, close, cancel } = useDelayedClose();

  const openDetails = useCallback(() => {
    cancel();
    setDetailsOpen(true);
  }, [cancel]);
  const closeDetails = useCallback(() => close(() => setDetailsOpen(false)), [close]);
  const toggleDetails = useCallback(() => {
    if (detailsOpen && !detailsClosing) {
      closeDetails();
    } else {
      openDetails();
    }
  }, [detailsOpen, detailsClosing, closeDetails, openDetails]);
  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleNav = useCallback(() => setNavOpen((value) => !value), []);

  const value = useMemo<WorkspaceUiValue>(
    () => ({
      detailsOpen,
      detailsClosing,
      toggleDetails,
      openDetails,
      closeDetails,
      navOpen,
      openNav,
      closeNav,
      toggleNav,
    }),
    [detailsOpen, detailsClosing, toggleDetails, openDetails, closeDetails, navOpen, openNav, closeNav, toggleNav],
  );

  return <WorkspaceUiContext.Provider value={value}>{children}</WorkspaceUiContext.Provider>;
};
