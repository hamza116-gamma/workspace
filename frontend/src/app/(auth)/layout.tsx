import { RedirectIfAuth } from '@/components/guards/RedirectIfAuth';

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return <RedirectIfAuth>{children}</RedirectIfAuth>;
}
