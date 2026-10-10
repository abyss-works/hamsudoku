export function homeGate(enabled: boolean, uid: string | null, email: string | null, nickname: string | null) {
  if (enabled && uid !== null && email === null)
    return 'guest';
  if (enabled && email !== null && !nickname)
    return 'nickname';
  return 'enter';
}
