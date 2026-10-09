import { RotateCcw } from 'lucide-react';
import { DotMark, HelpCol } from '../ui/HelpCard';

export const MARKERS = [
  { icon: <DotMark size={20} />, lines: ['펜을 골라,', '의심·가설 찍기'] },
  { icon: <RotateCcw size={20} aria-hidden="true" />, lines: ['고른 펜을 다시 눌러,', '그 색만 지우기'] },
];

export function MarkerPage() {
  return (
    <>
      {MARKERS.map((m) => (
        <HelpCol key={m.lines[0]}>
          {m.icon}
          <p>
            {m.lines[0]}
            <br />
            {m.lines[1]}
          </p>
        </HelpCol>
      ))}
    </>
  );
}
