// Postgres 오류 판정과 기록용 정제. 쿼리 빌더 오류는 원인(cause)에 드라이버 오류를 담고,
// 메시지에는 쿼리 인자가 포함되므로 기록에는 코드와 대상 이름만 남긴다.

const UNIQUE_VIOLATION = '23505';

interface PgErrorFields {
  code?: unknown;
  constraint?: unknown;
  table?: unknown;
}

function driverError(error: unknown): PgErrorFields | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && typeof current === 'object' && current !== null; depth += 1) {
    const fields = current as PgErrorFields & { cause?: unknown };
    if (typeof fields.code === 'string') return fields;
    current = fields.cause;
  }
  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  return driverError(error)?.code === UNIQUE_VIOLATION;
}

export interface DbErrorSummary {
  name: string;
  code?: string;
  constraint?: string;
  table?: string;
}

/** 로그·Sentry로 보낼 수 있는 오류 요약. 메시지와 쿼리 인자는 포함하지 않는다. */
export function describeDbError(error: unknown): DbErrorSummary {
  const name = error instanceof Error ? error.name : typeof error;
  const fields = driverError(error);
  const pick = (value: unknown) => (typeof value === 'string' ? value : undefined);
  return {
    name,
    code: pick(fields?.code),
    constraint: pick(fields?.constraint),
    table: pick(fields?.table),
  };
}

// 쿼리 빌더 오류 메시지는 `Failed query: <SQL>\nparams: <인자 목록>` 형식이다.
const QUERY_PARAMS = /\nparams: [\s\S]*$/;

/** 오류 메시지에서 쿼리 인자 목록을 가린다. SQL 문장은 남긴다. */
export function redactQueryParams(message: string): string {
  return message.replace(QUERY_PARAMS, '\nparams: [redacted]');
}

interface ScrubbableEvent {
  message?: string;
  exception?: { values?: { value?: string }[] };
}

/** 오류 추적 이벤트의 메시지와 예외 값에서 쿼리 인자를 가린다. */
export function scrubDatabaseErrorEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = redactQueryParams(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactQueryParams(exception.value);
  }
  return event;
}
