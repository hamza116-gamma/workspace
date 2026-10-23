import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';
import styles from './page.module.css';

export default function LoginPage() {
  return (
    <AuthCard
      className={styles.page}
      title="Sign in to workspace"
      subtitle="Enter your credentials to access the secure workspace."
    >
      <LoginForm />
    </AuthCard>
  );
}
