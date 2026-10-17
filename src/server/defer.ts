/** 응답 뒤에 실행할 작업을 받는 함수. route handler는 Next.js after를 전달하고 테스트는 작업을 모은다. */
export type Defer = (task: () => Promise<void>) => void;
