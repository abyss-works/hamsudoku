import { useHelpCarousel } from './useHelpCarousel';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { HelpCard, HelpCol } from '../ui/HelpCard';
import { HamsterFace } from '../ui/HamsterFace';
import { ControlsPage } from './ControlsHelp';
import { RulesPage } from './RulesHelp';

function ProbePage() {
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

// 규칙·조작(무한모드는 임시 정답 장 추가)을 카드 안 좌우 버튼으로 돌려본다.
export function GameHelp({ probe = false }: { probe?: boolean }) {
  const pages = probe
    ? [
        { title: '기본 규칙', page: <RulesPage />, cols: 3 as const },
        { title: '기본 조작', page: <ControlsPage />, cols: 3 as const },
        { title: '임시 정답', page: <ProbePage />, cols: 2 as const },
      ]
    : [
        { title: '기본 규칙', page: <RulesPage />, cols: 3 as const },
        { title: '기본 조작', page: <ControlsPage />, cols: 3 as const },
      ];
  const { page, prev, next } = useHelpCarousel(pages.length);
  return (
    <div className="help-carousel">
      <HelpCard label={pages[page].title} cols={pages[page].cols}>
        <button type="button" className="btn help-arrow help-prev" aria-label="이전 도움말" onClick={prev}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="help-cols">{pages[page].page}</div>
        <div className="help-dots" aria-hidden="true">
          {pages.map((p, i) => (
            <i key={p.title} className={i === page ? 'on' : ''} />
          ))}
        </div>
        <button type="button" className="btn help-arrow help-next" aria-label="다음 도움말" onClick={next}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </HelpCard>
    </div>
  );
}
