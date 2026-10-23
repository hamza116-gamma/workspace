'use client';

import { useEffect } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';

/** Refreshes the workspace list on `organization.updated` (name/settings). */
export const useOrgLiveUpdates = () => {
  const { socket } = useSocket();
  const { refresh } = useOrg();

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onUpdated = () => {
      void refresh();
    };
    socket.on('organization.updated', onUpdated);
    return () => {
      socket.off('organization.updated', onUpdated);
    };
  }, [socket, refresh]);
};
