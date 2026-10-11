import { useEffect, useRef, useState } from 'react';
import { fetchRemoteSessionUser } from '../account/remoteSessionService';
import { useAdminRank } from './useAdminRank';
import { adminRankModel } from './rankLogic';

export function useAdminRankPanelService() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void fetchRemoteSessionUser().then((user) => {
      if (alive) setUid(user.uid);
    });
    return () => {
      alive = false;
    };
  }, []);

  const rank = useAdminRank(uid);
  const deleting = useRef(false);

  const remove = async () => {
    if (deleting.current) return;
    deleting.current = true;
    try {
      await rank.removeSelected();
    } catch {}
    finally {
      deleting.current = false;
    }
  };

  const refresh = () => {
    void rank.refresh();
  };

  const model = adminRankModel(rank.entries, rank.guestEntries, rank.selected);

  return { ...rank, ...model, remove, refresh };
}
