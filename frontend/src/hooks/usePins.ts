'use client';

import { useContext } from 'react';
import { PinsContext } from '@/context/PinsContext';

export const usePins = () => {
  const context = useContext(PinsContext);
  if (!context) {
    throw new Error('usePins must be used within a PinsProvider');
  }
  return context;
};
