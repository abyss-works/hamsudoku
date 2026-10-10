import { AdminRankPanel } from '../../screens/AdminRankPanel';
import { QueryProvider } from '../../game/queryClient';

export const metadata = { title: '관리자 · 랭킹' };

export default function AdminPage() {
  return <QueryProvider><AdminRankPanel /></QueryProvider>;
}
