// 로고 마스코트 4종. 원본과 변형을 균등 확률로 쓴다.
export const MASCOTS = [
  '/hamster-mascot.svg',
  '/hamster-mascot-pearl.svg',
  '/hamster-mascot-gray.svg',
  '/hamster-mascot-choco.svg',
] as const;

export function pickMascot(random: () => number = Math.random): string {
  const i = Math.min(Math.floor(random() * MASCOTS.length), MASCOTS.length - 1);
  return MASCOTS[i];
}
