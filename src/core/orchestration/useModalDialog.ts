import { useCallback, useRef } from 'react';

// dialog 요소의 modal 수명을 ref 콜백으로 소유한다. 붙을 때 showModal로 열어 배경 입력을 차단하고
// 떨어질 때 close로 닫아 포커스 복원을 맡긴다. showModal이 없는 환경은 open 속성으로만 표시한다.
export function useModalDialog(): (el: HTMLDialogElement | null) => void {
  const current = useRef<HTMLDialogElement | null>(null);
  return useCallback((el: HTMLDialogElement | null) => {
    if (el === current.current) return;
    const prev = current.current;
    if (prev && prev.open && typeof prev.close === 'function') prev.close();
    current.current = el;
    if (!el) return;
    if (typeof el.showModal === 'function') {
      if (!el.open) el.showModal();
    } else {
      el.open = true;
    }
  }, []);
}
