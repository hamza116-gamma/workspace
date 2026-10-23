'use client';

import { useContext } from 'react';
import { ActiveConversationContext } from '@/context/ActiveConversationContext';

export const useActiveConversation = () => {
  const context = useContext(ActiveConversationContext);
  if (!context) {
    throw new Error('useActiveConversation must be used within an ActiveConversationProvider');
  }
  return context;
};
