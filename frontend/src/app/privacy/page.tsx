import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Privacy policy · Circle Chat' };

// Public page (no sign-in): required by Google for the OAuth consent screen.
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <p className={styles.eyebrow}>Circle Chat</p>
        <h1 className={styles.title}>Privacy policy</h1>
        <p className={styles.updated}>Last updated: 24 October 2026</p>

        <h2>What we collect</h2>
        <p>
          Your name, email address and profile details; the workspaces, channels and direct
          messages you take part in; messages, reactions and files you share; and basic sign-in
          information (device, browser and IP address) used to keep your account secure.
        </p>

        <h2>How we use it</h2>
        <p>
          Only to run Circle Chat: showing your conversations to the people you share them
          with, sending notifications, and sending service emails such as invitations and
          password resets. We do not sell your data or use it for advertising.
        </p>

        <h2>Email</h2>
        <p>
          Service emails are sent through our Gmail account using Google&apos;s Gmail API, with
          permission only to send messages. We never read your mailbox.
        </p>

        <h2>Storage and services</h2>
        <p>
          Data is stored in MongoDB Atlas, uploaded files in Cloudinary, and the app is hosted on
          Vercel and Render. These providers process data only to provide their services to us.
        </p>

        <h2>Your choices</h2>
        <p>
          You can edit your profile, delete your messages, leave workspaces, and ask us to delete
          your account by contacting the workspace owner or the address below.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="mailto:hamza.shafique12123@gmail.com">hamza.shafique12123@gmail.com</a>
        </p>
      </article>
    </main>
  );
}
