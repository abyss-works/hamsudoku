export function locationSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

export function removeRecoveryLocation(): void {
  if (typeof window !== 'undefined') window.history.replaceState({}, '', window.location.pathname);
}

export function dismissStaticSplash(): void {
  if (typeof document !== 'undefined') document.getElementById('boot-static')?.remove();
}
