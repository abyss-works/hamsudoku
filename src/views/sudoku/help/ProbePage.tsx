import { RotateCcw } from 'lucide-react';
import { HelpCol } from '../../../ui/HelpCard';
import { HamsterFace } from '../../../ui/HamsterFace';

export function ProbePage() {
  return (
    <>
      <HelpCol>
        <span className="help-icon">
          <span className="probe-face" aria-hidden="true">
            <HamsterFace />
            <span className="anchor-badge" aria-hidden="true">
              ?
            </span>
          </span>
        </span>
        <p>
          임시 정답 켜고,
          <br />
          톡으로 놓기·회수
        </p>
      </HelpCol>
      <HelpCol>
        <span className="help-icon">
          <RotateCcw size={20} aria-hidden="true" />
        </span>
        <p>
          리셋은 정답마커
          <br />
          빼고 지우기
        </p>
      </HelpCol>
    </>
  );
}
