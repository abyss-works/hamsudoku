import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

// 접근성 모션 감소 설정의 감지. 표현 생명주기의 환경 연결 경계로, 조립 계층이 읽어 View에 값으로 전달한다.
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}
