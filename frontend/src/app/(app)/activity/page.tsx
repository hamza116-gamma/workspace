import type { Metadata } from 'next';
import { NotificationsView } from '@/components/notifications/NotificationsView';

export const metadata: Metadata = { title: 'Mentions & activity' };

export default function ActivityPage() {
  return <NotificationsView />;
}
