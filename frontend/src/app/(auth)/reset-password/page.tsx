import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import styles from './page.module.css';

export default function ResetPasswordPage() {
  return (
    <AuthCard
      className={styles.page}
      title="Choose a new password"
      subtitle="Enter and confirm your new password."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
