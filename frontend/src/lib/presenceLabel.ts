import type { PresenceState } from '@/types/user';
import type { PillTone } from '@/components/ui/Pill';

export const PRESENCE_PILL: Record<PresenceState, { label: string; tone: PillTone }> = {
  ACTIVE: { label: 'Active', tone: 'ok' },
  AWAY: { label: 'Away', tone: 'warn' },
  DND: { label: 'Do not disturb', tone: 'mute' },
  OFFLINE: { label: 'Offline', tone: 'mute' },
};
