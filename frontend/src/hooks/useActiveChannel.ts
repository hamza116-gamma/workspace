'use client';

import { useContext } from 'react';
import { ActiveChannelContext } from '@/context/ActiveChannelContext';

export const useActiveChannel = () => {
  const context = useContext(ActiveChannelContext);
  if (!context) {
    throw new Error('useActiveChannel must be used within an ActiveChannelProvider');
  }
  return context;
};
