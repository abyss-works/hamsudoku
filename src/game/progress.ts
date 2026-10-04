const KEY = 'hamsudoku:last-stage';

export function loadLastStageId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLastStageId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // 저장 실패는 무시 (프라이빗 모드 등)
  }
}
