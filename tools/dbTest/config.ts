// 운영 Postgres(17)와 같은 주 버전의 공식 이미지로 고정한다.
export const DB_TEST_IMAGE = 'postgres:17.6';

// 마이그레이션을 적용한 원본 데이터베이스. 테스트 데이터베이스는 이 원본을 복제한다.
export const TEMPLATE_DATABASE = 'app_template';

// 애플리케이션 접속 역할. 슈퍼유저가 아니며 데이터베이스와 테이블의 소유자다.
// 소유자는 RLS를 우회하므로 RLS를 켠 표를 정책 없이 읽고 쓸 수 있다.
export const APP_ROLE = 'app';
export const APP_PASSWORD = 'test-only-app-password';

// 서버 배포 환경의 데이터베이스 기본값과 맞춘다.
export const STATEMENT_TIMEOUT = '2min';
