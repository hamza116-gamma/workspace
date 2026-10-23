'use client';

import { useRouter } from 'next/navigation';
import { ChannelForm } from './ChannelForm';
import styles from './CreateChannelForm.module.css';

export const CreateChannelForm = () => {
  const router = useRouter();

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h1 className={styles.title}>Create a channel</h1>
        <p className={styles.subtitle}>
          Channels are how conversations stay organized — by team, project, or topic.
        </p>
      </header>

      <ChannelForm
        onCreated={(channel) => router.push(`/channels/${channel.id}`)}
        onCancel={() => router.push('/channels')}
      />
    </section>
  );
};
