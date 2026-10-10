import { useState } from 'react';

export function useHelpCarousel(count: number) {
  const [page, setPage] = useState(0);
  return { page, prev: () => setPage((p) => (p + count - 1) % count), next: () => setPage((p) => (p + 1) % count) };
}
