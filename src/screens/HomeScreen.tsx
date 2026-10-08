import { useEffect, useState } from 'react';
import { PawPrint, Settings, Sprout, Trophy, User } from 'lucide-react';
import { Button } from '../ui/Button';
import type { EndlessSummaryState } from '../game/useEndlessSummary';
import { ProfileDialog } from './ProfileDialog';
import { RankDialog } from './RankDialog';
import { SettingsDialog } from './SettingsDialog';
import { GuestEndlessDialog } from './GuestEndlessDialog';
import { AuthDialog } from './AuthDialog';

interface HomeScreenProps {
  /** 계정 연동 확정 — 유보를 풀고 데이터 교체를 진행한다. */
  onBaseChosen?: () => void;
  /** 기준 선택 없이 닫기 — 세션 취소(로그아웃), 데이터 무변경. */
  onCancelSignin?: () => void;
  email: string | null;
  nickname: string | null;
  uid: string | null;
  summary: EndlessSummaryState;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onSignup: (email: string, password: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  onSignin: (
    email: string,
    password: string,
    hold?: boolean,
  ) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  onReset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  onBrowse: () => void;
  onEndless: () => void;
  endlessEnabled: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function HomeScreen({ email, nickname, uid, summary, onSaveNickname, onSignup, onSignin, onReset, onBaseChosen, onCancelSignin, onBrowse, onEndless, endlessEnabled, onLogin, onLogout }: HomeScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const guest = endlessEnabled && uid !== null && email === null;
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // 홈에 들어올 때마다 요약(씨앗 잔액·내 순위)을 최신으로 맞춘다.
  // 조용한 재요청을 쓴다 — loading 토글이 부팅 게이트를 재고정하면 화면 전환 직후
  // 스플래시로 되돌아가는 결함이 생긴다.
  useEffect(() => {
    void summary.refreshSoft();
    // summary 객체는 렌더마다 새로 만들어지므로 최초 1회만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="home">
      <div className="home-top">
        <Button variant="sticker" aria-label="프로필" onClick={() => setProfileOpen(true)}>
          <User size={22} aria-hidden="true" />
        </Button>
        <Button variant="sticker" aria-label="설정" onClick={() => setSettingsOpen(true)}>
          <Settings size={22} aria-hidden="true" />
        </Button>
      </div>
      <div className="home-mascot" aria-hidden="true">
        <img src="/hamster-mascot.svg" alt="" />
      </div>
      <h1 className="home-title">
        <PawPrint size={34} aria-hidden="true" /> hamsudoku
      </h1>
      <p className="home-sub">숨은 햄스터를 찾아라</p>
      {endlessEnabled && summary.me && (
        <div className="seed-box" role="status" aria-label={`씨앗 ${summary.me.wallet.balance}개`}>
          <Sprout size={20} aria-hidden="true" />
          <span className="seed-count">{summary.me.wallet.balance}</span>
        </div>
      )}
      <div className="home-actions">
        <Button variant="sticker" className="btn-primary" onClick={onBrowse}>
          스테이지
        </Button>
        <div className="home-endless-row">
          <Button
            variant="sticker"
            className="btn-sun home-endless-main"
            disabled={!endlessEnabled}
            onClick={guest ? () => setGuestGateOpen(true) : onEndless}
          >
            무한모드
          </Button>
          {endlessEnabled && (
            <Button
              variant="sticker"
              className="btn-icon home-trophy"
              aria-label="랭킹"
              onClick={() => {
                setRankOpen(true);
                void summary.refresh();
              }}
            >
              <Trophy size={22} aria-hidden="true" />
            </Button>
          )}
        </div>
        {!endlessEnabled && <p className="home-note">무한모드는 온라인 연결이 필요해요</p>}
      </div>
      {guestGateOpen && (
        <GuestEndlessDialog
          onClose={() => setGuestGateOpen(false)}
          onLogin={() => {
            setGuestGateOpen(false);
            setAuthOpen(true);
          }}
        />
      )}
      {authOpen && (
        <AuthDialog
          signup={onSignup}
          signin={(e, p) => onSignin(e, p, true)}
          reset={onReset}
          fetchAccountSeeds={async () => {
            await summary.refreshSoft();
            return summary.me?.wallet.balance ?? 0;
          }}
          guest={guest ? { seeds: summary.me?.wallet.balance ?? 0, clears: summary.me?.clearedCount ?? 0 } : null}
          onBase={() => onBaseChosen?.()}
          onBack={() => {
            onCancelSignin?.();
            setAuthOpen(false);
          }}
          onDone={() => setAuthOpen(false)}
        />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {profileOpen && (
        <ProfileDialog
          email={email}
          nickname={nickname}
          onSaveNickname={onSaveNickname}
          onLogin={() => {
            setProfileOpen(false);
            onLogin();
          }}
          onLogout={onLogout}
          onClose={() => setProfileOpen(false)}
          onGuestLink={() => setAuthOpen(true)}
        />
      )}
      {rankOpen && (
        <RankDialog
          rank={summary.rank}
          uid={uid}
          signedIn={email !== null}
          onClose={() => setRankOpen(false)}
        />
      )}
    </div>
  );
}
