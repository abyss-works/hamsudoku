import { useEffect, useRef, useState } from 'react';

// 로딩 표시가 깜빡이지 않게 늦추는 훅이다.
// threshold 안에 끝나면 표시를 아예 안 띄우고, 뜬 뒤에는 최소 시간만큼 유지한다.
// 타이머는 ref에 모아 언마운트 때 한 번에 정리한다.
export function useDelayedLoading(loading: boolean, thresholdMs = 80, minVisibleMs = 350): boolean {
  const [show, setShow] = useState(false);
  const box = useRef<{ delay: ReturnType<typeof setTimeout> | null; hide: ReturnType<typeof setTimeout> | null; shown: boolean; shownAt: number }>({
    delay: null,
    hide: null,
    shown: false,
    shownAt: 0,
  });

  useEffect(() => {
    const b = box.current;
    if (loading) {
      if (b.hide) {
        clearTimeout(b.hide);
        b.hide = null;
      }
      if (!b.shown && !b.delay) {
        b.delay = setTimeout(() => {
          b.delay = null;
          b.shown = true;
          b.shownAt = Date.now();
          setShow(true);
        }, thresholdMs);
      }
    } else {
      if (b.delay) {
        clearTimeout(b.delay);
        b.delay = null;
      }
      if (b.shown) {
        const remain = minVisibleMs - (Date.now() - b.shownAt);
        if (remain <= 0) {
          b.shown = false;
          setShow(false);
        } else if (!b.hide) {
          b.hide = setTimeout(() => {
            b.hide = null;
            b.shown = false;
            setShow(false);
          }, remain);
        }
      }
    }
  }, [loading, thresholdMs, minVisibleMs]);

  useEffect(
    () => () => {
      const b = box.current;
      if (b.delay) clearTimeout(b.delay);
      if (b.hide) clearTimeout(b.hide);
    },
    [],
  );

  return show;
}
