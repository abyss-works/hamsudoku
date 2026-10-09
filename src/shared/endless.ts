import { z } from 'zod';

export const seasonIdSchema = z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/);

export const endlessStageSchema = z.object({
  id: z.string().min(1),
  size: z.number().int().min(5).max(7),
  regions: z.string().regex(/^\d+$/),
});

export const nextRequestSchema = z.object({
  clientPublicKey: z.string().min(1),
});

export const nextResponseSchema = z.object({
  stage: endlessStageSchema,
  solutionCipher: z.string().min(1),
  serverPublicKey: z.string().min(1),
  iv: z.string().min(1),
  attemptKey: z.string().min(1),
});

export const clearRequestSchema = z.object({
  attemptKey: z.string().min(1),
  stageId: z.string().min(1),
  solution: z.array(z.tuple([z.number().int().min(0).max(6), z.number().int().min(0).max(6)])),
  seedLeft: z.number().int().min(0).max(3),
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
});

/** 내 순위 별도 조회 응답. 스냅샷을 거치지 않은 실시간 값이다. */
export const myRankResponseSchema = z.object({
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
export type ClearRequest = z.infer<typeof clearRequestSchema>;
export type ClearResponse = z.infer<typeof clearResponseSchema>;
export type FailRequest = z.infer<typeof failRequestSchema>;
export type FailResponse = z.infer<typeof failResponseSchema>;
export type RankEntry = z.infer<typeof rankEntrySchema>;
export type RankResponse = z.infer<typeof rankResponseSchema>;
export type MyRankResponse = z.infer<typeof myRankResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type EndlessMirror = z.infer<typeof endlessMirrorSchema>;
