import { Suspense } from 'react';
import { SearchView } from '@/components/search/SearchView';
import { Spinner } from '@/components/ui/Spinner';

export default function SearchPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SearchView />
    </Suspense>
  );
}
