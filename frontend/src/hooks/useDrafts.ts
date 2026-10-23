'use client';

import { useContext } from 'react';
import { DraftsContext } from '@/context/DraftsContext';

export const useDrafts = () => {
  const context = useContext(DraftsContext);
  if (!context) {
    throw new Error('useDrafts must be used within a DraftsProvider');
  }
  return context;
};
