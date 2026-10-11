import { useHelpCarousel } from '../../features/sudoku/service/useHelpCarousel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HelpCard } from '../../ui/HelpCard';
import { ControlsPage } from './help/ControlsHelp';
import { RulesPage } from './help/RulesHelp';
import { ProbePage } from './help/ProbePage';

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
