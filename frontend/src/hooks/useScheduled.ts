'use client';

import { useContext } from 'react';
import { ScheduledContext } from '@/context/ScheduledContext';

export const useScheduled = () => {
  const context = useContext(ScheduledContext);
  if (!context) {
    throw new Error('useScheduled must be used within a ScheduledProvider');
  }
  return context;
};
