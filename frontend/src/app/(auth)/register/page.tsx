import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';
import styles from './page.module.css';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  return (
    <AuthCard
      className={styles.page}
      title={invite ? 'Join workspace' : 'Create workspace'}
      subtitle={
        invite
          ? 'Create your account to accept the invitation.'
          : 'Create your account and a new workspace.'
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
