import { useCallback, useEffect, useId, useMemo } from 'react';
import { useOverlay } from './overlayContext';
import type { CloseOverlayOptions, ScopedOverlayHandle, ScopedOverlayRequest } from './overlayTypes';

interface ScopeInstance {
  scopeId: string;
  scopeToken: string;
  isActive: boolean;
}

export function useOverlayScope(scopeId: string): ScopedOverlayHandle {
  const { setScope, expireScope, open: rawOpen, close: rawClose, isOpen, current } = useOverlay();

  // 인스턴스 식별은 렌더 중 가변 전역을 쓰지 않고 React가 부여하는 안정 id를 사용한다.
  const instanceId = useId();
  const instance = useMemo<ScopeInstance>(() => {
    return {
      scopeId,
      scopeToken: `${scopeId}__${instanceId}`,
      isActive: true,
    };
  }, [scopeId, instanceId]);

  useEffect(() => {
    instance.isActive = true;
    setScope(instance.scopeId, instance.scopeToken);
    return () => {
      instance.isActive = false;
      expireScope(instance.scopeId, instance.scopeToken);
    };
  }, [instance, setScope, expireScope]);

  const open = useCallback(
    <T = unknown>(request: ScopedOverlayRequest<T>) => {
      if (!instance.isActive) return;
      rawOpen({
        ...request,
        scopeId: instance.scopeId,
        scopeToken: instance.scopeToken,
      });
    },
    [rawOpen, instance],
  );

  const close = useCallback(
    (target?: string | CloseOverlayOptions) => {
      if (!instance.isActive) return;
      let targetSlot = 'default';
      let targetType: string | undefined;
      if (typeof target === 'string') {
        targetType = target;
      } else if (target) {
        targetSlot = target.slot ?? 'default';
        targetType = target.type;
      }

      const activeOverlay = current(targetSlot);
      if (activeOverlay) {
        if (activeOverlay.scopeToken && activeOverlay.scopeToken !== instance.scopeToken) {
          return;
        }
        if (targetType && activeOverlay.type !== targetType) {
          return;
        }
      }
      rawClose(target);
    },
    [rawClose, current, instance],
  );

  const scopedIsOpen = useCallback(
    (type?: string, slot?: string) => {
      if (!instance.isActive) return false;
      const targetSlot = slot ?? 'default';
      const cur = current(targetSlot);
      if (!cur) return false;
      if (cur.scopeToken && cur.scopeToken !== instance.scopeToken) return false;
      return isOpen(type, slot);
    },
    [isOpen, current, instance],
  );

  const scopedCurrent = useCallback(
    (slot?: string) => {
      if (!instance.isActive) return null;
      const cur = current(slot);
      if (!cur) return null;
      if (cur.scopeToken && cur.scopeToken !== instance.scopeToken) return null;
      return cur;
    },
    [current, instance],
  );

  return useMemo(
    () => ({
      scopeId: instance.scopeId,
      scopeToken: instance.scopeToken,
      open,
      close,
      isOpen: scopedIsOpen,
      current: scopedCurrent,
    }),
    [instance, open, close, scopedIsOpen, scopedCurrent],
  );
}
