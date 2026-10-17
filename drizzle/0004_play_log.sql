CREATE TABLE "EndlessPlayLog" (
	"attemptId" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"stageId" text NOT NULL,
	"outcome" text NOT NULL,
	"accepted" boolean NOT NULL,
	"reason" text,
	"claimedSeedLeft" integer,
	"serverElapsedMs" integer NOT NULL,
	"logVersion" integer,
	"events" jsonb,
	"logError" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"auditedAt" timestamp (3),
	"audit" jsonb
);
--> statement-breakpoint
ALTER TABLE "EndlessPlayLog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "EndlessPlayLog_unaudited_createdAt_idx" ON "EndlessPlayLog" USING btree ("createdAt") WHERE "auditedAt" is null;