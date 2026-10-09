import { HamsterFace } from '../ui/HamsterFace';

interface ProbeButtonProps {
  active: boolean;
  slots: number;
  onToggle: () => void;
}

// 임시 정답 아이템. 펜 자리에 하나 둔다. 놓을 앵커와 같은 얼굴을 보여준다.
export function ProbeButton({ active, slots, onToggle }: ProbeButtonProps) {
  return (
    <div className="probe-controls" role="group" aria-label="임시 정답">
      <button
        type="button"
        className={`btn probe-btn${active ? ' selected' : ''}`}
        aria-pressed={active}
        aria-label={active ? '임시 정답 끄기' : '임시 정답 켜기'}
        onClick={onToggle}
      >
        <span className="probe-face" aria-hidden="true">
          <HamsterFace />
          <span className="anchor-badge" aria-hidden="true">
            ?
          </span>
        </span>
        <span className="probe-count" aria-hidden="true">
          {slots}/3
        </span>
      </button>
    </div>
  );
}
