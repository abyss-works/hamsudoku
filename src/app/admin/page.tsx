import { AdminRankPanel } from '../../views/ranking/AdminRankPanel';
import { QueryProvider } from '../../application/queryClient';

export const metadata = { title: '관리자 · 랭킹' };

export default function AdminPage() {
  return <QueryProvider><AdminRankPanel /></QueryProvider>;
}
