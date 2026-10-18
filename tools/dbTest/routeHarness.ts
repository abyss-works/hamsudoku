import { createHash, createHmac } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { createTestDatabase, type TestDatabase } from './testDatabase';

// route handler를 실제 데이터베이스로 호출하는 테스트 도구.
// 세션·Sentry·순위 저장소·응답 후 작업·외부 HTTP만 대체하고 저장소 구현은 그대로 실행한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** 실제 현재 시각 이후의 가장 가까운 수요일 12:00 KST. 진행 중인 시즌의 마감 창 밖이다. */
function nextWednesdayNoonKst(real: Date): Date {
  const kst = new Date(real.getTime() + KST_OFFSET_MS);
  const midnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const daysAhead = (3 - kst.getUTCDay() + 7) % 7 || 7;
  return new Date(midnight + daysAhead * DAY_MS + 12 * HOUR_MS - KST_OFFSET_MS);
}

// 테스트 시각은 실제 시각보다 뒤에 둔다. 데이터베이스 기본값으로 기록되는 시각이 테스트 시각보다 앞서게 된다.
export const ACTIVE_NOW = nextWednesdayNoonKst(new Date());
/** ACTIVE_NOW 다음 월요일 01:00 KST. 집계 마감 창 안이다. */
export const FROZEN_NOW = new Date(ACTIVE_NOW.getTime() + 4 * DAY_MS + 13 * HOUR_MS);

/** 애플리케이션의 Date만 고정한다. 타이머는 실제로 동작해 연결 대기와 잠금 대기가 유지된다. */
export function useFixedNow(now: Date): void {
  vi.useFakeTimers({ toFake: ['Date'], now });
}

// ---- 세션 ----

export const session: { uid: string | null; email: string | null } = { uid: null, email: null };

export function signInAs(uid: string, email: string | null = null): void {
  session.uid = uid;
  session.email = email;
}

export function signOut(): void {
  session.uid = null;
  session.email = null;
}

type AuthResult = { ok: true } | { ok: false; msg: string; code?: string };

/** 이메일 인증 호출의 결과. 성공하면 지정한 uid로 세션이 바뀐다. */
export const authResults: { signIn: AuthResult; signUp: AuthResult; nextUid: string | null } = {
  signIn: { ok: true },
  signUp: { ok: true },
  nextUid: null,
};

export function mockAuth<T extends object>(original: T): T {
  return {
    ...original,
    getSessionUser: async () => ({ uid: session.uid, email: session.email }),
    ensureSession: async () => session.uid,
    signInWithEmail: async (email: string) => {
      if (authResults.signIn.ok && authResults.nextUid) signInAs(authResults.nextUid, email);
      return authResults.signIn;
    },
    signUpWithEmail: async (email: string) => {
      if (authResults.signUp.ok && session.uid) session.email = email;
      return authResults.signUp;
    },
  };
}

// ---- Sentry ----

export const sentryLogs: { level: string; message: string; attributes: unknown }[] = [];

/** Sentry로 보낸 오류 이벤트의 태그와 cron 모니터 체크인 이름. */
export const sentryEvents = { exceptions: [] as { tags: unknown }[], monitors: [] as string[] };

export function mockSentry() {
  const record = (level: string) => (message: string, attributes?: unknown) => {
    sentryLogs.push({ level, message, attributes });
  };
  return {
    logger: { info: record('info'), warn: record('warn'), error: record('error') },
    captureException: (_error: unknown, context?: { tags?: unknown }) => {
      sentryEvents.exceptions.push({ tags: context?.tags });
    },
    withMonitor: (slug: string, callback: () => unknown) => {
      sentryEvents.monitors.push(slug);
      return callback();
    },
  };
}

// ---- 응답 후 작업 ----

// 운영의 after처럼 응답이 끝난 뒤에 실행하도록 작업을 모아 두었다가 flushDeferred에서 시작한다.
const deferred: ((() => unknown) | Promise<unknown>)[] = [];

export function mockNextServer<T extends object>(original: T): T {
  return {
    ...original,
    after: (task: (() => unknown) | Promise<unknown>) => {
      deferred.push(task);
    },
  };
}

async function flushDeferred(): Promise<void> {
  while (deferred.length > 0) {
    const tasks = deferred.splice(0);
    await Promise.allSettled(tasks.map((task) => (typeof task === 'function' ? Promise.resolve().then(task) : task)));
  }
}

// ---- 순위 저장소 ----

interface RankEntry {
  userId: string;
  score: number;
}

/** Redis 순위 저장소 대역. 표시 캐시는 항상 비어 있어 원장 조회 함수를 호출한다. */
export class FakeRankStore {
  readonly increments: { season: string; userId: string; amount: number }[] = [];
  readonly removed: { season: string; userId: string }[] = [];
  scores = new Map<string, number>();

  async increment(season: string, userId: string, amount: number): Promise<void> {
    this.increments.push({ season, userId, amount });
    this.scores.set(userId, (this.scores.get(userId) ?? 0) + amount);
  }

  async top(season: string, limit: number, loadScores?: () => Promise<RankEntry[]>) {
    const entries = loadScores ? await loadScores() : this.sorted();
    return { at: new Date().toISOString(), season, entries: sortEntries(entries).slice(0, limit) };
  }

  async topAll(season: string, limit: number) {
    return { at: new Date().toISOString(), season, entries: this.sorted().slice(0, limit) };
  }

  async remove(season: string, userId: string): Promise<number> {
    this.removed.push({ season, userId });
    return this.scores.delete(userId) ? 1 : 0;
  }

  async rankOf(_season: string, userId: string) {
    const index = this.sorted().findIndex((e) => e.userId === userId);
    return index < 0 ? { rank: null, score: 0 } : { rank: index + 1, score: this.scores.get(userId) ?? 0 };
  }

  async setScore(_season: string, userId: string, score: number): Promise<void> {
    this.scores.set(userId, score);
  }

  private sorted(): RankEntry[] {
    return sortEntries([...this.scores].map(([userId, score]) => ({ userId, score })));
  }
}

function sortEntries(entries: RankEntry[]): RankEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || (a.userId < b.userId ? 1 : a.userId > b.userId ? -1 : 0));
}

export const rankStore: { current: FakeRankStore | null } = { current: null };

export function mockRank<T extends object>(original: T): T {
  return { ...original, rankStoreFromEnv: () => rankStore.current };
}

// ---- 외부 HTTP (QStash) ----

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export const outbound: { requests: CapturedRequest[]; status: number } = { requests: [], status: 200 };

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const text = await request.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // 본문이 JSON이 아니면 문자열로 남긴다.
  }
  outbound.requests.push({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body,
  });
  return new Response(JSON.stringify({ messageId: `msg-${outbound.requests.length}` }), {
    status: outbound.status,
    headers: { 'content-type': 'application/json' },
  });
}

export const INTERNAL_SECRET = 'test-internal-secret';
const QSTASH_SIGNING_KEY = 'test-qstash-signing-key';

const TEST_ENV: Record<string, string | undefined> = {
  APP_URL: 'http://app.test',
  QSTASH_URL: 'http://qstash.test',
  QSTASH_TOKEN: 'test-qstash-token',
  QSTASH_CURRENT_SIGNING_KEY: QSTASH_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY: QSTASH_SIGNING_KEY,
  QSTASH_PROTECTION_BYPASS: undefined,
  RANKING_FINALIZE_DESTINATION_URL: undefined,
  INTERNAL_SECRET,
  CRON_SECRET: undefined,
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
  ADMIN_UIDS: undefined,
};

// ---- 데이터베이스 ----

export interface RouteDatabase {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * 테스트 파일 단위 데이터베이스를 준비한다. route 모듈은 이 함수 뒤에 등록한 beforeAll에서 import한다.
 * 각 테스트 전에 모든 테이블을 비우고 세션·대역·시각을 초기화한다.
 */
export function useRouteDatabase(): RouteDatabase {
  let database: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    database = await createTestDatabase();
    for (const [key, value] of Object.entries(TEST_ENV)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    process.env.DATABASE_URL = database.url;
    pool = new Pool({ connectionString: database.url, max: 2 });
  });

  afterAll(async () => {
    await pool?.end();
    // route가 만든 앱 데이터베이스 싱글톤 풀을 닫아 데이터베이스 삭제 전에 연결을 남기지 않는다.
    const app = globalThis as unknown as { hamsudokuDatabase?: { pool: Pool } };
    await app.hamsudokuDatabase?.pool.end();
    delete app.hamsudokuDatabase;
    await database?.drop();
  });

  beforeEach(async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    if (rows.length > 0) {
      await pool.query(`truncate table ${rows.map((r) => `"${r.tablename}"`).join(', ')} cascade`);
    }
    signOut();
    authResults.signIn = { ok: true };
    authResults.signUp = { ok: true };
    authResults.nextUid = null;
    sentryLogs.length = 0;
    sentryEvents.exceptions.length = 0;
    sentryEvents.monitors.length = 0;
    rankStore.current = null;
    outbound.requests.length = 0;
    outbound.status = 200;
    vi.stubGlobal('fetch', fakeFetch);
    useFixedNow(ACTIVE_NOW);
  });

  afterEach(async () => {
    await flushDeferred();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as T[];
    },
  };
}

// ---- 요청 ----

export interface RouteResult<T = Record<string, unknown>> {
  status: number;
  body: T;
}

type Handler = (req: Request) => Promise<Response>;

/** handler를 호출하고 응답 후 작업까지 끝난 뒤 상태 코드와 JSON 본문을 돌려준다. */
export async function callRoute<T = Record<string, unknown>>(
  handler: Handler,
  init: { path?: string; method?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> } = {},
): Promise<RouteResult<T>> {
  const method = init.method ?? (init.body !== undefined || init.rawBody !== undefined ? 'POST' : 'GET');
  const body = init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined);
  const req = new Request(`http://app.test${init.path ?? '/'}`, {
    method,
    headers: { 'content-type': 'application/json', ...init.headers },
    body,
  });
  const res = await handler(req);
  await flushDeferred();
  return { status: res.status, body: (await res.json()) as T };
}

export function internalAuth(): Record<string, string> {
  return { authorization: `Bearer ${INTERNAL_SECRET}` };
}

// ---- 데이터 준비 ----

/** 세션 성립 시점에 만들어지는 사용자와 프로필 행. */
export async function seedUser(db: RouteDatabase, uid: string, nickname: string | null = null): Promise<void> {
  await db.query(`insert into "User" (id, email) values ($1, null)`, [uid]);
  await db.query(`insert into "Profile" ("userId", nickname, "updatedAt") values ($1, $2, now())`, [uid, nickname]);
}

export interface SeedStage {
  id: string;
  solution?: string;
  regions?: string;
  seed?: number;
  plays?: number;
  clears?: number;
  avgClearMs?: number;
  clearTotalMs?: number;
}

export const STAGE_SOLUTION = '0,0;1,2;2,4;3,6;4,1;5,3;6,5';
export const STAGE_SOLUTION_PAIRS: [number, number][] = [
  [0, 0],
  [1, 2],
  [2, 4],
  [3, 6],
  [4, 1],
  [5, 3],
  [6, 5],
];

export async function seedStage(db: RouteDatabase, stage: SeedStage): Promise<void> {
  await db.query(
    `insert into "EndlessStage" (id, size, regions, solution, tier, seed, plays, clears, "avgClearMs", "clearTotalMs")
     values ($1, 7, $2, $3, 1, $4, $5, $6, $7, $8)`,
    [
      stage.id,
      stage.regions ?? '0123456'.repeat(7),
      stage.solution ?? STAGE_SOLUTION,
      stage.seed ?? 10000,
      stage.plays ?? 0,
      stage.clears ?? 0,
      stage.avgClearMs ?? 0,
      stage.clearTotalMs ?? 0,
    ],
  );
}

/** 지정 시각에 발급된 입장 키. */
export interface SeedAttempt {
  id: string;
  userId: string;
  stageCode: string;
  issuedAt: Date;
  usedAt?: Date | null;
}

export async function seedAttempt(
  db: RouteDatabase,
  input: SeedAttempt,
): Promise<void> {
  await db.query(`insert into "Attempt" (id, "userId", "stageCode", "issuedAt", "usedAt") values ($1, $2, $3, $4, $5)`, [
    input.id,
    input.userId,
    input.stageCode,
    input.issuedAt,
    input.usedAt ?? null,
  ]);
}

export async function seedLedger(
  db: RouteDatabase,
  input: { id: string; userId: string; season: string; amount: number; createdAt: Date; rankingEligible?: boolean },
): Promise<void> {
  await db.query(
    `insert into "SeedLedger" (id, "userId", kind, amount, "stageId", season, "createdAt", "rankingEligible")
     values ($1, $2, 'earn', $3, null, $4, $5, $6)`,
    [input.id, input.userId, input.amount, input.season, input.createdAt, input.rankingEligible ?? true],
  );
}

export function secondsBefore(now: Date, seconds: number): Date {
  return new Date(now.getTime() - seconds * 1000);
}

/** 테스트 서명 키로 만든 QStash 요청 서명 헤더. 서명 대상은 요청 URL과 본문 해시다. */
export function qstashSigned(path: string, rawBody: string): Record<string, string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'Upstash',
    sub: `http://app.test${path}`,
    exp: now + 300,
    nbf: now - 10,
    body: createHash('sha256').update(rawBody).digest('base64url'),
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
  const signature = createHmac('sha256', QSTASH_SIGNING_KEY).update(unsigned).digest('base64url');
  return { 'upstash-signature': `${unsigned}.${signature}` };
}
