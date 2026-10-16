// 스테이징 프로젝트와 같은 Supabase Postgres 이미지 버전으로 고정한다.
export const DB_TEST_IMAGE = 'supabase/postgres:17.11.0.003';

// 마이그레이션을 적용한 원본 데이터베이스. 테스트 데이터베이스는 이 원본을 복제한다.
export const TEMPLATE_DATABASE = 'app_template';

// 호스팅 환경의 데이터베이스 기본값과 맞춘다.
export const STATEMENT_TIMEOUT = '2min';
