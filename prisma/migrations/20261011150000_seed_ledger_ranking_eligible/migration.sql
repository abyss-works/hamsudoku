-- AlterTable
ALTER TABLE "SeedLedger" ADD COLUMN "rankingEligible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "SeedLedger_season_rankingEligible_idx" ON "SeedLedger"("season", "rankingEligible");
