import { PawPrint } from 'lucide-react';

// 진입 게이트 전용. 진행 표시는 여기서 맡고, 베일과 겹치지 않게
// 진입 시작은 track하지 않는다(다음 판·재도전 같은 전환만 track).
export function BootSplash() {
  return (
    <div className="boot-splash" role="status" aria-label="불러오는 중">
      <div className="home-mascot" aria-hidden="true">
        <img src="/hamster-mascot.svg" alt="" />
      </div>
      <h1 className="home-title" aria-hidden="true">
        <PawPrint size={34} aria-hidden="true" /> hamsudoku
      </h1>
      <p className="home-sub" aria-hidden="true">
        숨은 햄스터를 찾아라
      </p>
      <div className="boot-actions" aria-hidden="true">
        <div className="boot-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
