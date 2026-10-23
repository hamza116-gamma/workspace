'use client';

import { useContext } from 'react';
import { SavedContext } from '@/context/SavedContext';

export const useSaved = () => {
  const context = useContext(SavedContext);
  if (!context) {
    throw new Error('useSaved must be used within a SavedProvider');
  }
  return context;
};
