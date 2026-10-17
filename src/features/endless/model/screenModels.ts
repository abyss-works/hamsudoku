export interface EndlessClearModel {
  showConfetti: boolean;
  title: string;
  note: string | null;
  actionsDisabled: boolean;
  /** 같은 판 다시 하기 표시 여부. 씨앗 3개로 깼으면 숨기고 저장에 실패하면 보인다. */
  showRetry: boolean;
}

export function endlessClearModel({
  result,
  error,
  submitting,
  starting,
  seedLeft,
}: {
  result: { ok: boolean; earned: number } | null;
  error: string | null;
  submitting: boolean;
  starting: boolean;
  /** 클리어 시점의 남은 씨앗. */
  seedLeft: number;
}): EndlessClearModel {
  const pending = submitting || starting;
  const showPending = pending || result === null;
  const failed = result !== null && result.ok === false;

  let title: string;
  if (showPending || result === null) {
    title = '기록을 저장하는 중…';
  } else if (result.ok === false) {
    title = error ?? '기록을 저장하지 못했어요.';
  } else {
    title = `햄스터를 다 찾았다! 씨앗 ${result.earned}개를 얻었어요`;
  }

  const showConfetti = !showPending && !failed;
  const note = !showPending && !failed && error ? error : null;

  return {
    showConfetti,
    title,
    note,
    actionsDisabled: showPending,
    showRetry: seedLeft !== 3 || failed,
  };
}

export function endlessHudModel(balance: number, seeds: number) {
  return {
    balance,
    seeds,
    ariaLabel: `씨앗 ${balance}개, 목숨 ${seeds}개`,
  };
}
