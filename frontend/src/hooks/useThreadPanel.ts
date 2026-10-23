'use client';

import { useContext } from 'react';
import { ThreadContext } from '@/context/ThreadContext';

export const useThreadPanel = () => {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error('useThreadPanel must be used within a ThreadProvider');
  }
  return context;
};
