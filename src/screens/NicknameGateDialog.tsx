import { useState } from 'react';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
import { TextInput } from '../ui/TextInput';

interface NicknameGateDialogProps {
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onEnter: () => void;
  onLater: () => void;
}

export function NicknameGateDialog({ onSaveNickname, onEnter, onLater }: NicknameGateDialogProps) {
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await onSaveNickname(draft);
      if (!r.ok) {
        setMsg(r.msg ?? '저장하지 못했어요.');
        return;
      }
      setMsg(null);
      onEnter();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay label="닉네임 안내">
      <div className="guest-gate">
        <h2 className="guest-gate-title">랭킹에 표시될 닉네임을 정하세요</h2>
        <p className="guest-gate-sub">비워 두면 랭킹에 게스트로 표시돼요 (2~12자).</p>
        <TextInput
          aria-label="닉네임"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="닉네임을 입력하세요"
          disabled={saving}
        />
        {msg && (
          <p className="login-error" role="alert">
            {msg}
          </p>
        )}
        <div className="guest-gate-actions">
          <Button variant="sticker" className="btn-primary guest-gate-fill" onClick={() => void save()} disabled={saving}>
            정하고 계속하기
          </Button>
          <Button variant="sticker" className="guest-gate-fill" onClick={onLater} disabled={saving}>
            나중에 하기
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
