import { NotFoundState } from '@/components/ui/NotFoundState';

// Addresses that match no route at all (outside the app shell too).
export default function NotFound() {
  return (
    <main style={{ display: 'grid', minHeight: '100vh', background: 'var(--canvas, #f6f7f5)' }}>
      <NotFoundState
        title="Page not found"
        text="This link doesn't lead anywhere. It may be old, or mistyped."
        actionLabel="Go to Circle Chat"
      />
    </main>
  );
}
