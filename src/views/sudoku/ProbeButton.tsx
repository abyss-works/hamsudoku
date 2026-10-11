import { RotateCcw } from 'lucide-react';
import { HamsterFace } from '../../ui/HamsterFace';
import { probeButtonPresentation } from './probeButtonPresentation';

export interface ProbeButtonProps {
  active: boolean;
  slots: number;
  onToggle: () => void;
  onResetMarks: () => void;
}

// 임시 정답 아이템과 전체 지우기. 왼쪽 칸은 아이템이 부모 너비를 먹고,
// 오른쪽 칸은 고정 크기 리셋 버튼 하나만 둔다.
export function ProbeButton({ active, slots, onToggle, onResetMarks }: ProbeButtonProps) {
  const model = probeButtonPresentation(active, slots);

  return (
    <div className="probe-controls" role="group" aria-label="임시 정답">
      <div className="probe-cell">
        <button
          type="button"
          className={`btn probe-btn${active ? ' selected' : ''}`}
          aria-pressed={active}
          aria-label={model.toggleLabel}
          onClick={onToggle}
        >
          <span className="probe-face" aria-hidden="true">
            <HamsterFace />
            <span className="anchor-badge" aria-hidden="true">
              ?
            </span>
          </span>
          <span className="probe-count" aria-hidden="true">
            {model.slotText}
          </span>
        </button>
      </div>
      <button
        type="button"
        className="btn probe-reset"
        aria-label="정답마커 빼고 지우기"
        onClick={onResetMarks}
      >
        <RotateCcw size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
