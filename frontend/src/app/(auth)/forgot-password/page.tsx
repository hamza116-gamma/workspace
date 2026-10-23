import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import styles from './page.module.css';

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      className={styles.page}
      title="Reset your password"
      subtitle="We'll email you a secure reset link."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
