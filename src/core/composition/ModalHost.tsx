import type { ReactNode } from 'react';
import { useModalDialog } from '../orchestration/useModalDialog';

// 오버레이 내용을 네이티브 modal dialog로 감싼다. Escape의 cancel은 기존 닫기 정책
// (명시적 액션으로만 닫힘)을 유지하기 위해 막는다.
export function ModalHost({ children }: { children: ReactNode }) {
  const dialogRef = useModalDialog();
  return (
    <dialog ref={dialogRef} className="modal-host" onCancel={(e) => e.preventDefault()}>
      {children}
    </dialog>
  );
}
