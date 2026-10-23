import { ProfileIdCard } from '@/components/profile/ProfileIdCard';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { ThemeSelector } from '@/components/profile/ThemeSelector';
import { SessionsList } from '@/components/profile/SessionsList';
import styles from './page.module.css';

export default function ProfilePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Profile & account</h1>
        <p className={styles.sub}>
          Manage how you appear to your team, your appearance preferences, your
          password and signed-in devices.
        </p>
      </header>

      <div className={styles.grid}>
        <div className={styles.side}>
          <ProfileIdCard />
        </div>

        <div className={styles.main}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Profile details</h2>
            <ProfileForm />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <ThemeSelector />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Change password</h2>
            <ChangePasswordForm />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Active sessions</h2>
            <SessionsList />
          </section>
        </div>
      </div>
    </div>
  );
}
