import { Plus } from 'lucide-react';

interface ProbeButtonProps {
  active: boolean;
  slots: number;
  onToggle: () => void;
}

// 임시 정답 아이템. 펜 자리에 하나 둔다. 켠 동안 톡은 앵커 놓기·회수만 한다.
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
        <Plus size={24} strokeWidth={3} aria-hidden="true" />
        <span className="probe-count" aria-hidden="true">
          {slots}/3
        </span>
      </button>
    </div>
  );
}
