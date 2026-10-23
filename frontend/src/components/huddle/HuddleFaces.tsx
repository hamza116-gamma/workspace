import { Avatar } from '@/components/ui/Avatar';
import type { HuddleUser } from '@/types/huddle';
import styles from './HuddleFaces.module.css';

export const HuddleFaces = ({
  users,
  max = 3,
  size = 24,
}: {
  users: HuddleUser[];
  max?: number;
  size?: number;
}) => (
  <span className={styles.faces}>
    {users.slice(0, max).map((user) => (
      <span key={user.id} className={styles.face} title={user.fullName}>
        <Avatar name={user.fullName} src={user.avatarUrl} size={size} />
      </span>
    ))}
    {users.length > max && <span className={styles.more}>+{users.length - max}</span>}
  </span>
);
