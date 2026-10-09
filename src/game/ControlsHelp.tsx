import { MousePointerClick, Move, Pointer } from 'lucide-react';
import { HelpCol } from '../ui/HelpCard';

export const CONTROLS = [
  { icon: <Pointer size={20} aria-hidden="true" />, lines: ['한 번 톡,', '표시 남기기'] },
  { icon: <MousePointerClick size={20} aria-hidden="true" />, lines: ['두 번 톡톡,', '햄스터 부르기'] },
  { icon: <Move size={20} aria-hidden="true" />, lines: ['밀어서 쭉,', '표시하고 지우기'] },
];

export function ControlsPage() {
  return (
    <>
      {CONTROLS.map((c) => (
        <HelpCol key={c.lines[0]}>
          {c.icon}
          <p>
            {c.lines[0]}
            <br />
            {c.lines[1]}
          </p>
        </HelpCol>
      ))}
    </>
  );
}
