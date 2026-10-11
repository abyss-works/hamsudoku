// 닉네임 규칙 — 랭킹 표시용 이름. 식별자는 userId이며 중복을 허용한다.
const MIN_LEN = 2;
const MAX_LEN = 12;

export function normalizeNickname(input: string): string {
  return input.trim();
}

export function validateNickname(input: string): { ok: true; nickname: string } | { ok: false; msg: string } {
  const nickname = normalizeNickname(input);
  if (nickname.length === 0) return { ok: false, msg: '닉네임을 입력하세요.' };
  if ([...nickname].length < MIN_LEN || [...nickname].length > MAX_LEN) {
    return { ok: false, msg: `닉네임은 ${MIN_LEN}~${MAX_LEN}자로 입력하세요.` };
  }
  return { ok: true, nickname };
}
