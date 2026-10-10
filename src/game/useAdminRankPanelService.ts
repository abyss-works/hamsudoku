import { useEffect, useRef, useState } from 'react';
import { cloudAuthApi } from '../api/stagesApi';
import { useAdminRank } from './useAdminRank';
export function useAdminRankPanelService() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void cloudAuthApi.me().then(me => { if (alive)
      setUid(me.uid); }).catch(() => { if (alive)
      setUid(null); });
    return () => { alive = false; };
  }, []);
  const rank = useAdminRank(uid);
  const deleting = useRef(false);
  const remove = async () => {
    if (deleting.current)
      return;
    deleting.current = true;
    try {
      await rank.removeSelected();
    }
    catch { }
    finally {
      deleting.current = false;
    }
  };
  const refresh = () => { void rank.refresh(); };
  return { ...rank, remove, refresh };
}
