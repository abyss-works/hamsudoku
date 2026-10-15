import { useEffect, useRef, type PointerEvent } from 'react';
import { delayForPointerType, type TapKind } from '../model/tap';

// onPress는 대기 중인 싱글탭 취소자를 함께 받는다. 보드가 스트로크를 확정하면 이를 호출해
// 시작 칸의 지연 single 확정이 스트로크 결과를 덮지 않게 한다.
export function useCellInteraction(onTap: (kind: TapKind) => void, onPress: (cancelPendingTap: () => void) => void) {
  const latestTap = useRef(onTap);
  latestTap.current = onTap;
  const timer = useRef<number | null>(null);
  const pointerKind = useRef<string | null>(null);
  const doubleCommitted = useRef(false);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    // 두 번째 탭이 윈도우 안에 들어오면 브라우저 dblclick과 무관하게 더블로 확정한다.
    // (모바일 더블탭은 dblclick을 안 주는 경우가 있어 클릭 타이밍으로 직접 판정)
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      doubleCommitted.current = true;
      latestTap.current('double');
      return;
    }
    doubleCommitted.current = false;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      latestTap.current('single');
    }, delayForPointerType(pointerKind.current));
  };

  const cancelPendingTap = () => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  };

  const handlePress = (e: PointerEvent) => {
    pointerKind.current = e.pointerType ?? null;
    onPress(cancelPendingTap);
  };

  const handleDoubleClick = () => {
    if (doubleCommitted.current) {
      doubleCommitted.current = false;
      return;
    }
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    latestTap.current('double');
  };

  return { handleClick, handlePress, handleDoubleClick };
}
