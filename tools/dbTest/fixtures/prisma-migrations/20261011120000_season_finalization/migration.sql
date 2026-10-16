-- CreateTable
CREATE TABLE "SeasonFinalization" (
    "season" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'finalized',

    CONSTRAINT "SeasonFinalization_pkey" PRIMARY KEY ("season")
);

-- CreateTable
CREATE TABLE "SeasonRankResult" (
    "season" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "SeasonRankResult_pkey" PRIMARY KEY ("season","userId")
);

-- CreateIndex
CREATE INDEX "SeasonFinalization_status_idx" ON "SeasonFinalization"("status");

-- CreateIndex
CREATE INDEX "SeasonRankResult_season_rank_idx" ON "SeasonRankResult"("season", "rank");

-- CreateIndex
CREATE INDEX "SeasonRankResult_userId_idx" ON "SeasonRankResult"("userId");

-- AddForeignKey
ALTER TABLE "SeasonRankResult" ADD CONSTRAINT "SeasonRankResult_season_fkey" FOREIGN KEY ("season") REFERENCES "SeasonFinalization"("season") ON DELETE CASCADE ON UPDATE CASCADE;
