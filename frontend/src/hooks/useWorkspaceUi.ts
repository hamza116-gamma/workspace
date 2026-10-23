'use client';

import { useContext } from 'react';
import { WorkspaceUiContext } from '@/context/WorkspaceUiContext';

export const useWorkspaceUi = () => {
  const context = useContext(WorkspaceUiContext);
  if (!context) {
    throw new Error('useWorkspaceUi must be used within a WorkspaceUiProvider');
  }
  return context;
};
