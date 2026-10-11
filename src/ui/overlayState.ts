import type { CloseOverlayOptions, OverlayRequest, OverlayState } from './overlayTypes';

const DEFAULT_SLOT = 'default';

export function createInitialOverlayState(initialScopeId?: string, initialScopeToken?: string): OverlayState {
  return {
    activeBySlot: {},
    activeScopeId: initialScopeId ?? null,
    activeScopeToken: initialScopeToken ?? null,
    expiredScopes: [],
    expiredTokens: [],
  };
}

export function openOverlay(state: OverlayState, request: OverlayRequest): OverlayState {
  const slot = request.slot ?? DEFAULT_SLOT;
  const requestedScope = request.scopeId;
  const requestedToken = request.scopeToken;

  // 1. 만료된 수명 인스턴스 토큰이거나 활성 토큰과 불일치하는 오래된 액션은 무시한다
  if (requestedToken) {
    if (state.expiredTokens.includes(requestedToken)) {
      return state;
    }
    if (state.activeScopeToken && requestedToken !== state.activeScopeToken) {
      return state;
    }
  }

  // 2. 토큰 없이 scopeId만 명시된 경우, 활성 스코프와 다른 오래된 액션은 무시한다
  if (requestedScope) {
    if (state.activeScopeId && requestedScope !== state.activeScopeId) {
      return state;
    }
  }

  // 3. 중복 요청 방지: 동일한 타입, 슬롯, 스코프, 토큰, 데이터이면 상태 객체를 새로 만들지 않는다
  const current = state.activeBySlot[slot];
  if (
    current &&
    current.type === request.type &&
    current.scopeId === request.scopeId &&
    current.scopeToken === request.scopeToken &&
    current.data === request.data
  ) {
    return state;
  }

  const normalizedRequest: OverlayRequest = {
    ...request,
    slot,
  };

  return {
    ...state,
    activeBySlot: {
      ...state.activeBySlot,
      [slot]: normalizedRequest,
    },
  };
}

export function closeOverlay(state: OverlayState, target?: string | CloseOverlayOptions): OverlayState {
  let targetType: string | undefined;
  let targetSlot: string | undefined;

  if (typeof target === 'string') {
    targetType = target;
  } else if (target) {
    targetType = target.type;
    targetSlot = target.slot;
  }

  const nextSlots = { ...state.activeBySlot };
  let modified = false;

  if (targetSlot) {
    const current = nextSlots[targetSlot];
    if (current && (!targetType || current.type === targetType)) {
      nextSlots[targetSlot] = null;
      modified = true;
    }
  } else if (targetType) {
    for (const [s, current] of Object.entries(nextSlots)) {
      if (current?.type === targetType) {
        nextSlots[s] = null;
        modified = true;
      }
    }
  } else {
    // 타겟이 없으면 default 슬롯 정리
    const current = nextSlots[DEFAULT_SLOT];
    if (current !== null && current !== undefined) {
      nextSlots[DEFAULT_SLOT] = null;
      modified = true;
    }
  }

  return modified ? { ...state, activeBySlot: nextSlots } : state;
}

export function setScope(
  state: OverlayState,
  nextScopeId: string | null,
  nextScopeToken?: string | null,
): OverlayState {
  const token = nextScopeToken ?? null;
  if (state.activeScopeId === nextScopeId && state.activeScopeToken === token) {
    return state;
  }

  const prevScope = state.activeScopeId;
  const prevToken = state.activeScopeToken;

  let expiredTokens = state.expiredTokens;
  if (prevToken && prevToken !== token && !expiredTokens.includes(prevToken)) {
    expiredTokens = [...expiredTokens, prevToken];
  }
  // StrictMode 등의 재진입/재마운트인 경우 해당 토큰을 다시 유효화한다
  if (token && expiredTokens.includes(token)) {
    expiredTokens = expiredTokens.filter((t) => t !== token);
  }

  // 이전 스코프/토큰에 바인딩된 오버레이들을 닫는다
  const nextSlots = { ...state.activeBySlot };
  for (const [slot, current] of Object.entries(nextSlots)) {
    if (!current) continue;
    const matchesToken = prevToken && current.scopeToken === prevToken;
    const matchesScope = prevScope && current.scopeId === prevScope && (!current.scopeToken || current.scopeToken === prevToken);
    if (matchesToken || matchesScope) {
      nextSlots[slot] = null;
    }
  }

  return {
    ...state,
    activeScopeId: nextScopeId,
    activeScopeToken: token,
    expiredScopes: prevScope && prevScope !== nextScopeId && !state.expiredScopes.includes(prevScope)
      ? [...state.expiredScopes, prevScope]
      : state.expiredScopes,
    expiredTokens,
    activeBySlot: nextSlots,
  };
}

export function expireScope(state: OverlayState, scopeId: string, scopeToken?: string | null): OverlayState {
  const expiredScopes = !state.expiredScopes.includes(scopeId)
    ? [...state.expiredScopes, scopeId]
    : state.expiredScopes;

  const expiredTokens = scopeToken && !state.expiredTokens.includes(scopeToken)
    ? [...state.expiredTokens, scopeToken]
    : state.expiredTokens;

  const nextSlots = { ...state.activeBySlot };
  for (const [slot, current] of Object.entries(nextSlots)) {
    if (!current) continue;
    if ((scopeToken && current.scopeToken === scopeToken) || (!current.scopeToken && current.scopeId === scopeId)) {
      nextSlots[slot] = null;
    }
  }

  const clearActive =
    Boolean(scopeToken && state.activeScopeToken === scopeToken) ||
    Boolean(!scopeToken && state.activeScopeId === scopeId);

  return {
    ...state,
    activeScopeId: clearActive ? null : state.activeScopeId,
    activeScopeToken: clearActive ? null : state.activeScopeToken,
    expiredScopes,
    expiredTokens,
    activeBySlot: nextSlots,
  };
}
