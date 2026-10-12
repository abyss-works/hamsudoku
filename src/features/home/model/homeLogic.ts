export function homeGate(enabled: boolean, uid: string | null, email: string | null, nickname: string | null) {
  if (enabled && uid !== null && email === null) return 'guest';
  if (enabled && email !== null && !nickname) return 'nickname';
  return 'enter';
}

export function homeModel({
  endlessEnabled,
  summary,
  email,
}: {
  endlessEnabled: boolean;
  summary: { me?: { wallet: { balance: number } } | null };
  email: string | null;
}) {
  const showWallet = Boolean(endlessEnabled && summary.me);
  const walletBalance = summary.me?.wallet.balance ?? 0;
  const walletAriaLabel = summary.me ? `씨앗 ${summary.me.wallet.balance}개` : null;
  const signedIn = email !== null;
  return { showWallet, walletBalance, walletAriaLabel, signedIn };
}
