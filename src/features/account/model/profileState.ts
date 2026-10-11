export interface ProfileState {
  nickname: string | null;
  targetUid: string | null;
  generation: number;
}

export function createInitialProfileState(initialUid: string | null = null): ProfileState {
  return {
    nickname: null,
    targetUid: initialUid,
    generation: 0,
  };
}

export function setProfileTarget(
  state: ProfileState,
  nextUid: string | null,
  generation: number
): ProfileState {
  if (state.targetUid === nextUid && state.generation === generation) return state;
  return {
    targetUid: nextUid,
    nickname: null,
    generation,
  };
}

export function applyProfileNickname(
  state: ProfileState,
  targetUid: string | null,
  generation: number,
  nickname: string | null
): ProfileState {
  // 세대 또는 대상 uid가 불일치하는 오래된 응답은 무시한다
  if (state.generation !== generation) return state;
  if (state.targetUid !== targetUid) return state;
  if (state.nickname === nickname) return state;

  return {
    ...state,
    nickname,
  };
}

export function resetProfileState(state: ProfileState, generation: number): ProfileState {
  if (state.targetUid === null && state.nickname === null && state.generation === generation) {
    return state;
  }
  return {
    targetUid: null,
    nickname: null,
    generation,
  };
}
