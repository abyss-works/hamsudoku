-- AlterTable
ALTER TABLE "EndlessStage" ADD COLUMN "clearTotalMs" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "EndlessStage_clears_idx" ON "EndlessStage"("clears");

-- CreateTable
CREATE TABLE "EndlessSupplyJob" (
    "id" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "seedStart" INTEGER NOT NULL,
    "seedEnd" INTEGER NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "leaseExpiresAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndlessSupplyJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndlessSupplyChunk" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stageCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndlessSupplyChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EndlessSupplyJob_status_leaseExpiresAt_idx" ON "EndlessSupplyJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "EndlessSupplyChunk_jobId_idx" ON "EndlessSupplyChunk"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "EndlessSupplyChunk_jobId_chunkIndex_key" ON "EndlessSupplyChunk"("jobId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "EndlessSupplyChunk" ADD CONSTRAINT "EndlessSupplyChunk_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "EndlessSupplyJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
