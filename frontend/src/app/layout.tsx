import type { Metadata } from 'next';
import { Work_Sans } from 'next/font/google';
import '@/styles/tokens.css';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-work',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Circle Chat',
  description: 'Circle Chat - channels, messages and huddles for your team',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={workSans.variable} suppressHydrationWarning>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
