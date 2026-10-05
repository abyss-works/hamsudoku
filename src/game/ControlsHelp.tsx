import { MousePointerClick, Move, Pointer } from 'lucide-react';
import { HelpCard, HelpCol } from '../ui/HelpCard';

const CONTROLS = [
  { icon: <Pointer size={20} aria-hidden="true" />, text: '한 번 톡, 표시 남기기' },
  { icon: <MousePointerClick size={20} aria-hidden="true" />, text: '두 번 톡톡, 햄스터 부르기' },
  { icon: <Move size={20} aria-hidden="true" />, text: '밀어서 쭉, 표시하고 지우기' },
];

export function ControlsHelp() {
  return (
    <HelpCard label="기본 조작">
      {CONTROLS.map((c) => (
        <HelpCol key={c.text}>
          {c.icon}
          <p>{c.text}</p>
        </HelpCol>
      ))}
    </HelpCard>
  );
}
