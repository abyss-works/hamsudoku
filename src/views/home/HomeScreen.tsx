import type { ReactNode } from 'react';
import { PawPrint, Settings, Sprout, User } from 'lucide-react';
import { Button } from '../../ui/Button';
import { HomeMenu } from './HomeMenu';

export interface HomeScreenProps {
  showWallet: boolean;
  walletBalance?: number;
  walletAriaLabel?: string | null;
  endlessEnabled: boolean;
  onBrowse: () => void;
  enterEndless: () => void;
  openProfile: () => void;
  openSettings: () => void;
  openRank: () => void;
  overlays?: ReactNode;
  children?: ReactNode;
}

export function HomeScreen({
  showWallet,
  walletBalance = 0,
  walletAriaLabel = '',
  endlessEnabled,
  onBrowse,
  enterEndless,
  openProfile,
  openSettings,
  openRank,
  overlays,
  children,
}: HomeScreenProps) {
  return (
    <div className="home">
      <div className="home-top">
        <Button variant="sticker" aria-label="프로필" onClick={openProfile}>
          <User size={22} aria-hidden="true" />
        </Button>
        <Button variant="sticker" aria-label="설정" onClick={openSettings}>
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
      {showWallet && (
        <div className="seed-box" role="status" aria-label={walletAriaLabel ?? undefined}>
          <Sprout size={20} aria-hidden="true" />
          <span className="seed-count">{walletBalance}</span>
        </div>
      )}
      <HomeMenu
        endlessEnabled={endlessEnabled}
        onBrowse={onBrowse}
        onEndless={enterEndless}
        onRank={openRank}
      />
      {overlays ?? children}
    </div>
  );
}
