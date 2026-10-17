import { z } from 'zod';

export const seasonIdSchema = z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/);

export const endlessStageSchema = z.object({
  id: z.string().min(1),
  size: z.number().int().min(5).max(7),
  regions: z.string().regex(/^\d+$/),
});

export const nextRequestSchema = z.object({
  clientPublicKey: z.string().min(1),
  /** 다시 도전할 판. 없으면 서버가 판을 고른다. */
  stageId: z.string().min(1).optional(),
});

export const nextResponseSchema = z.object({
  stage: endlessStageSchema,
  solutionCipher: z.string().min(1),
  serverPublicKey: z.string().min(1),
  iv: z.string().min(1),
  attemptKey: z.string().min(1),
});

export const PLAY_LOG_VERSION = 1;
/** 한 판 기록의 이벤트 상한. 초과한 기록은 저장하지 않는다. */
export const PLAY_LOG_MAX_EVENTS = 2000;

export const playEventCodeSchema = z.enum(['correct', 'wrong', 'mark', 'erase', 'reset', 'probe-on', 'probe-off']);

const playEventTimeSchema = z.number().int().min(0);
const playEventCellSchema = z.number().int().min(0).max(6);

/** 판 표시 시점부터의 경과 밀리초와 조작 결과. 칸 조작은 행·열 좌표를 함께 담는다. */
export const playEventSchema = z.union([
  z.tuple([playEventTimeSchema, playEventCodeSchema]),
  z.tuple([playEventTimeSchema, playEventCodeSchema, playEventCellSchema, playEventCellSchema]),
]);

export const playLogSchema = z.object({
  version: z.literal(PLAY_LOG_VERSION),
  events: z.array(playEventSchema).max(PLAY_LOG_MAX_EVENTS),
});

export const clearRequestSchema = z.object({
  attemptKey: z.string().min(1),
  stageId: z.string().min(1),
  solution: z.array(z.tuple([z.number().int().min(0).max(6), z.number().int().min(0).max(6)])),
  seedLeft: z.number().int().min(0).max(3),
  /** 플레이 기록 원문. 형식 검증은 저장 단계에서 하며 요청 수락 여부에 영향을 주지 않는다. */
  log: z.unknown().optional(),
});

export const clearResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    earned: z.number().int().min(0).max(3),
    balance: z.number().int().min(0),
    streak: z.number().int().min(0),
    suspicious: z.boolean(),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.string().min(1),
  }),
]);

export const failRequestSchema = z.object({
  attemptKey: z.string().min(1),
  /** 플레이 기록 원문. 형식 검증은 저장 단계에서 하며 요청 수락 여부에 영향을 주지 않는다. */
  log: z.unknown().optional(),
});

export const failResponseSchema = z.object({ ok: z.literal(true) });

export const rankEntrySchema = z.object({
  userId: z.string(),
  nickname: z.string().nullable(),
  score: z.number().int().min(0),
});

export const rankResponseSchema = z.object({
  season: seasonIdSchema,
  top: z.array(rankEntrySchema),
  snapshotAt: z.iso.datetime(),
  me: z.object({ rank: z.number().int().min(1).nullable(), score: z.number().int().min(0) }),
  frozen: z.boolean(),
  status: z.enum(['active', 'aggregating', 'finalized']).default('active'),
});

/** 내 순위 별도 조회 응답. 스냅샷을 거치지 않은 실시간 값이다. */
export const myRankResponseSchema = z.object({
  season: seasonIdSchema.optional(),
  rank: z.number().int().min(1).nullable(),
  score: z.number().int().min(0),
  nickname: z.string().nullable(),
});

export const meResponseSchema = z.object({
  wallet: z.object({ balance: z.number().int().min(0) }),
  clearedCount: z.number().int().min(0),
  streak: z.object({ current: z.number().int().min(0), best: z.number().int().min(0) }),
  season: seasonIdSchema,
});

export const endlessMirrorSchema = z.object({
  v: z.literal(1),
  wallet: z.object({ balance: z.number().int().min(0) }),
  clearedIds: z.array(z.string()),
  streak: z.object({ current: z.number().int().min(0), best: z.number().int().min(0) }),
  season: seasonIdSchema,
});

export const ENDLESS_MIRROR_KEY = 'hamsudoku:endless:v1';

export type EndlessStage = z.infer<typeof endlessStageSchema>;
export type NextRequest = z.infer<typeof nextRequestSchema>;
export type NextResponse = z.infer<typeof nextResponseSchema>;
export type PlayEventCode = z.infer<typeof playEventCodeSchema>;
export type PlayEvent = z.infer<typeof playEventSchema>;
export type PlayLog = z.infer<typeof playLogSchema>;
export type ClearRequest = z.infer<typeof clearRequestSchema>;
export type ClearResponse = z.infer<typeof clearResponseSchema>;
export type FailRequest = z.infer<typeof failRequestSchema>;
export type FailResponse = z.infer<typeof failResponseSchema>;
export type RankEntry = z.infer<typeof rankEntrySchema>;
export type RankResponse = z.infer<typeof rankResponseSchema>;
export type MyRankResponse = z.infer<typeof myRankResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type EndlessMirror = z.infer<typeof endlessMirrorSchema>;
