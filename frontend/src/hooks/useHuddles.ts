'use client';

import { useContext } from 'react';
import { HuddleContext } from '@/context/HuddleContext';

export const useHuddles = () => {
  const context = useContext(HuddleContext);
  if (!context) {
    throw new Error('useHuddles must be used within a HuddleProvider');
  }
  return context;
};
