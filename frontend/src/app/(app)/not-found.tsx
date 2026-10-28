import { NotFoundState } from '@/components/ui/NotFoundState';

// Any unknown address inside the app (e.g. /channels/xyz/foo).
export default function NotFound() {
  return (
    <NotFoundState
      title="Page not found"
      text="This link doesn't lead anywhere. It may be old, or mistyped."
    />
  );
}
