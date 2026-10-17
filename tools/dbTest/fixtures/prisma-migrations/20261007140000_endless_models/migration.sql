-- CreateTable
CREATE TABLE "EndlessStage" (
    "id" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "regions" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "clears" INTEGER NOT NULL DEFAULT 0,
    "avgClearMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndlessStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndlessProgress" (
    "userId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndlessProgress_pkey" PRIMARY KEY ("userId","stageId")
);

-- CreateTable
CREATE TABLE "SeedWallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SeedWallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SeedLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "stageId" TEXT,
    "season" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeedLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndlessEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "seedLeft" INTEGER NOT NULL,
    "elapsedMs" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndlessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndlessStreak" (
    "userId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EndlessStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "EndlessProgress_userId_cleared_idx" ON "EndlessProgress"("userId", "cleared");

-- CreateIndex
CREATE INDEX "SeedLedger_season_kind_idx" ON "SeedLedger"("season", "kind");

-- CreateIndex
CREATE INDEX "SeedLedger_userId_season_idx" ON "SeedLedger"("userId", "season");

-- CreateIndex
CREATE INDEX "EndlessEvent_userId_stageId_idx" ON "EndlessEvent"("userId", "stageId");
