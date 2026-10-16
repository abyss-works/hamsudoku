CREATE TABLE "Profile" (
	"userId" text PRIMARY KEY NOT NULL,
	"nickname" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"stageCode" text NOT NULL,
	"issuedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"usedAt" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "Attempt" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "EndlessEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"stageId" text NOT NULL,
	"seedLeft" integer NOT NULL,
	"elapsedMs" integer NOT NULL,
	"verified" boolean NOT NULL,
	"suspicious" boolean DEFAULT false NOT NULL,
	"reason" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EndlessEvent" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "EndlessProgress" (
	"userId" text NOT NULL,
	"stageId" text NOT NULL,
	"cleared" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastPlayedAt" timestamp (3) NOT NULL,
	CONSTRAINT "EndlessProgress_pkey" PRIMARY KEY("userId","stageId")
);
--> statement-breakpoint
ALTER TABLE "EndlessProgress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "EndlessStreak" (
	"userId" text PRIMARY KEY NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"best" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EndlessStreak" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "SeedWallet" (
	"userId" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SeedWallet" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "EndlessStage" (
	"id" text PRIMARY KEY NOT NULL,
	"size" integer NOT NULL,
	"regions" text NOT NULL,
	"solution" text NOT NULL,
	"tier" integer NOT NULL,
	"seed" integer NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"clears" integer DEFAULT 0 NOT NULL,
	"avgClearMs" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"clearTotalMs" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EndlessStage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "EndlessSupplyChunk" (
	"id" text PRIMARY KEY NOT NULL,
	"jobId" text NOT NULL,
	"chunkIndex" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stageCount" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EndlessSupplyChunk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "EndlessSupplyJob" (
	"id" text PRIMARY KEY NOT NULL,
	"policyVersion" text NOT NULL,
	"seedStart" integer NOT NULL,
	"seedEnd" integer NOT NULL,
	"targetCount" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"leaseExpiresAt" timestamp (3),
	"lastSuccessAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EndlessSupplyJob" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "SeasonFinalization" (
	"season" text PRIMARY KEY NOT NULL,
	"startAt" timestamp (3) NOT NULL,
	"endAt" timestamp (3) NOT NULL,
	"finalizedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"status" text DEFAULT 'finalized' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SeasonFinalization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "SeasonRankResult" (
	"season" text NOT NULL,
	"userId" text NOT NULL,
	"score" integer NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "SeasonRankResult_pkey" PRIMARY KEY("season","userId")
);
--> statement-breakpoint
ALTER TABLE "SeasonRankResult" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "SeedLedger" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"stageId" text,
	"season" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"rankingEligible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SeedLedger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ClearEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"stageCode" text NOT NULL,
	"elapsedSec" integer NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"clearedAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ClearEvent" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ClearRecord" (
	"userId" text NOT NULL,
	"stageCode" text NOT NULL,
	"bestElapsedSec" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastClearedAt" timestamp (3) NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "ClearRecord_pkey" PRIMARY KEY("userId","stageCode")
);
--> statement-breakpoint
ALTER TABLE "ClearRecord" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "EndlessSupplyChunk" ADD CONSTRAINT "EndlessSupplyChunk_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."EndlessSupplyJob"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SeasonRankResult" ADD CONSTRAINT "SeasonRankResult_season_fkey" FOREIGN KEY ("season") REFERENCES "public"."SeasonFinalization"("season") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Attempt_userId_idx" ON "Attempt" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "EndlessEvent_userId_stageId_idx" ON "EndlessEvent" USING btree ("userId","stageId");--> statement-breakpoint
CREATE INDEX "EndlessProgress_userId_cleared_idx" ON "EndlessProgress" USING btree ("userId","cleared");--> statement-breakpoint
CREATE INDEX "EndlessStage_clears_idx" ON "EndlessStage" USING btree ("clears");--> statement-breakpoint
CREATE INDEX "EndlessSupplyChunk_jobId_idx" ON "EndlessSupplyChunk" USING btree ("jobId");--> statement-breakpoint
CREATE UNIQUE INDEX "EndlessSupplyChunk_jobId_chunkIndex_key" ON "EndlessSupplyChunk" USING btree ("jobId","chunkIndex");--> statement-breakpoint
CREATE INDEX "EndlessSupplyJob_status_leaseExpiresAt_idx" ON "EndlessSupplyJob" USING btree ("status","leaseExpiresAt");--> statement-breakpoint
CREATE INDEX "SeasonFinalization_status_idx" ON "SeasonFinalization" USING btree ("status");--> statement-breakpoint
CREATE INDEX "SeasonRankResult_season_rank_idx" ON "SeasonRankResult" USING btree ("season","rank");--> statement-breakpoint
CREATE INDEX "SeasonRankResult_userId_idx" ON "SeasonRankResult" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "SeedLedger_season_kind_idx" ON "SeedLedger" USING btree ("season","kind");--> statement-breakpoint
CREATE INDEX "SeedLedger_userId_season_idx" ON "SeedLedger" USING btree ("userId","season");--> statement-breakpoint
CREATE INDEX "SeedLedger_season_rankingEligible_idx" ON "SeedLedger" USING btree ("season","rankingEligible");--> statement-breakpoint
CREATE INDEX "ClearEvent_userId_stageCode_idx" ON "ClearEvent" USING btree ("userId","stageCode");--> statement-breakpoint
CREATE INDEX "ClearRecord_userId_idx" ON "ClearRecord" USING btree ("userId");