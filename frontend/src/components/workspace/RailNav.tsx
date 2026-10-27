'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { Icon, type IconName } from '@/components/ui/Icon';
import styles from './RailButton.module.css';

const ITEMS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/', label: 'Home', icon: 'message', exact: true },
  { href: '/activity', label: 'Activity', icon: 'bell' },
  { href: '/members', label: 'Members', icon: 'users' },
];

/** Rail navigation (demo .rail-btn group); active state follows the route. */
export const RailNav = () => {
  const pathname = usePathname() ?? '/';
  const { mentionCount } = useNotifications();

  return (
    <>
      {ITEMS.map((item) => {
        const current = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badge = item.href === '/activity' ? mentionCount : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={styles.btn}
            data-tour={item.href === '/activity' ? 'activity' : undefined}
            aria-current={current ? 'true' : undefined}
            aria-label={badge > 0 ? `${item.label} (${badge} unread)` : item.label}
            title={item.label}
          >
            <Icon name={item.icon} size={19} />
            {badge > 0 && (
              <span className={styles.badge} aria-hidden>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
};
