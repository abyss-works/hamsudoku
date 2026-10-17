ALTER TABLE "EndlessProgress" ADD COLUMN "bestSeedLeft" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- 기존 클리어의 최고 잔여 씨앗을 검증된 클리어 이벤트에서 채운다.
UPDATE "EndlessProgress" p SET "bestSeedLeft" = e."best"
FROM (SELECT "userId", "stageId", max("seedLeft") AS "best" FROM "EndlessEvent" WHERE "verified" GROUP BY "userId", "stageId") e
WHERE p."cleared" AND p."userId" = e."userId" AND p."stageId" = e."stageId";
