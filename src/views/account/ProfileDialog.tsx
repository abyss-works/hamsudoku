import { useNicknameService } from '../../features/account/service/useNicknameService';
import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';
import { Panel } from '../../ui/Panel';
import { Section } from '../../ui/Section';
import { TextInput } from '../../ui/TextInput';

export interface ProfileDialogProps {
  email: string | null;
  nickname: string | null;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onLogin: () => void;
  onLogout: () => void;
  onClose: () => void;
  /** 게스트일 때 계정 연동 클릭 — 상위(AuthDialog)를 연다. */
  onGuestLink: () => void;
}

export function ProfileDialog({ email, nickname, onSaveNickname, onLogin, onLogout, onClose, onGuestLink }: ProfileDialogProps) {
  const { draft, setDraft, msg, saving, save } = useNicknameService({ nickname, onSaveNickname });

  return (
    <Overlay label="프로필">
      <div className="settings">
        <Panel title="프로필">
          <Section title="계정">
            {email ? (
              <div className="setting-row">
                <span>{email}</span>
                <Button onClick={onLogout}>로그아웃</Button>
              </div>
            ) : (
              <>
                <p className="login-note">지금은 이 기기에만 기록돼요.</p>
                <Button variant="sticker" onClick={onGuestLink || onLogin}>
                  계정 연동
                </Button>
              </>
            )}
          </Section>
          <Section title="닉네임">
            <TextInput
              aria-label="닉네임"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="닉네임을 입력하세요"
              disabled={saving}
            />
            <p className="login-note">랭킹에 표시돼요 (2~12자).</p>
            <Button variant="sticker" onClick={() => void save()} disabled={saving}>
              저장
            </Button>
            {msg && (
              <p className="login-error" role="alert">
                {msg}
              </p>
            )}
          </Section>
          <Button variant="sticker" onClick={onClose}>
            닫기
          </Button>
        </Panel>
      </div>
    </Overlay>
  );
}
