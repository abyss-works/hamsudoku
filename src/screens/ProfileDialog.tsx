import { useState } from 'react';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

interface ProfileDialogProps {
  email: string | null;
  nickname: string | null;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onLogin: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export function ProfileDialog({ email, nickname, onSaveNickname, onLogin, onLogout, onClose }: ProfileDialogProps) {
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const r = await onSaveNickname(draft);
    setSaving(false);
    if (!r.ok) {
      setMsg(r.msg ?? '저장하지 못했어요.');
      return;
    }
    setDraft('');
    setMsg(null);
  };

  return (
    <Overlay label="프로필">
      <div className="settings">
        <h2 className="settings-title">프로필</h2>
        <div className="setting-row">
          <span>닉네임</span>
          <span>{nickname ?? '아직 없어요'}</span>
        </div>
        <div className="setting-row">
          <label htmlFor="nickname-input" className="setting-label">
            닉네임 입력
          </label>
          <input
            id="nickname-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="2~12자"
          />
          <Button onClick={() => void save()} disabled={saving}>
            저장
          </Button>
        </div>
        {msg && <p className="login-note">{msg}</p>}
        {email ? (
          <div className="setting-row">
            <span>{email}</span>
            <Button onClick={onLogout}>로그아웃</Button>
          </div>
        ) : (
          <>
            <p className="login-note">지금은 이 기기에만 기록돼요.</p>
            <Button variant="sticker" onClick={onLogin}>
              로그인
            </Button>
          </>
        )}
        <Button variant="sticker" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Overlay>
  );
}
