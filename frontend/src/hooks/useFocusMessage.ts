'use client';

import { useContext } from 'react';
import { FocusMessageContext } from '@/context/FocusMessageContext';

export const useFocusMessage = () => {
  const context = useContext(FocusMessageContext);
  if (!context) {
    throw new Error('useFocusMessage must be used within a FocusMessageProvider');
  }
  return context;
};
