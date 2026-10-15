// 전체 스위트를 병렬 실행할 때 DOM 렌더 대기가 Testing Library 기본 1초를 넘겨 간헐 실패한다.
// DOM 환경에서만 비동기 대기 한도를 늘린다. 개별 단언의 실패 판정은 바뀌지 않는다.
if (typeof document !== 'undefined') {
  const { configure } = await import('@testing-library/react');
  configure({ asyncUtilTimeout: 5000 });
}

export {};
