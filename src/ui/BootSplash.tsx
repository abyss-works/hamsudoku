import { useState } from 'react';
import { PawPrint } from 'lucide-react';
import { pickMascot } from './mascots';

// 홈과 같은 뼈대의 정적 부분만 둔다. 진행 표시는 전역 베일(LoadingProvider)이 맡는다.
export function BootSplash() {
  // 홈과 같은 풀에서 고른다. 부팅 때마다 바뀔 수 있다.
  const [mascot] = useState(pickMascot);
  return (
    <div className="boot-splash" role="status" aria-label="불러오는 중">
      <div className="home-mascot" aria-hidden="true">
        <img src={mascot} alt="" />
      </div>
      <h1 className="home-title" aria-hidden="true">
        <PawPrint size={34} aria-hidden="true" /> hamsudoku
      </h1>
      <p className="home-sub" aria-hidden="true">
        숨은 햄스터를 찾아라
      </p>
    </div>
  );
}
