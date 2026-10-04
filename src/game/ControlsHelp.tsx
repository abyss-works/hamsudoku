import { MousePointerClick, Pointer } from 'lucide-react';

const CONTROLS = [
  { icon: <Pointer size={20} aria-hidden="true" />, text: '한 번 톡, 표시 남기기' },
  { icon: <MousePointerClick size={20} aria-hidden="true" />, text: '두 번 톡톡, 햄스터 부르기' },
];

export function ControlsHelp() {
  return (
    <div className="help-card" aria-label="기본 조작">
      {CONTROLS.map((c) => (
        <div key={c.text} className="help-row">
          {c.icon}
          <p>{c.text}</p>
        </div>
      ))}
    </div>
  );
}
