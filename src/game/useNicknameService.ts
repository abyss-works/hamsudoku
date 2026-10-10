import { useEffect, useRef, useState } from 'react';
interface NicknameOptions {
  nickname?: string | null;
  onSaveNickname: (name: string) => Promise<{
    ok: boolean;
    msg?: string;
  }>;
  onEnter?: () => void;
}
export function useNicknameService({ nickname, onSaveNickname, onEnter }: NicknameOptions) {
  const [draft, setDraft] = useState(nickname ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setDraft(nickname ?? '');
  }, [nickname]);
  const save = async () => {
    if (pending.current)
      return;
    pending.current = true;
    setSaving(true);
    try {
      const r = await onSaveNickname(draft);
      if (!alive.current)
        return;
      if (!r.ok) {
        setMsg(r.msg ?? '저장하지 못했어요.');
        return;
      }
      setMsg(null);
      if (onEnter)
        onEnter();
      else
        setDraft('');
    }
    catch {
      if (alive.current)
        setMsg('저장하지 못했어요.');
    }
    finally {
      pending.current = false;
      if (alive.current)
        setSaving(false);
    }
  };
  return { draft, setDraft, msg, saving, save };
}
