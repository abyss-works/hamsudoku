-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ClearRecord" (
    "userId" TEXT NOT NULL,
    "stageCode" TEXT NOT NULL,
    "bestElapsedSec" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastClearedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClearRecord_pkey" PRIMARY KEY ("userId","stageCode")
);

-- CreateTable
CREATE TABLE "ClearEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageCode" TEXT NOT NULL,
    "elapsedSec" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "clearedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClearEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClearRecord_userId_idx" ON "ClearRecord"("userId");

-- CreateIndex
CREATE INDEX "ClearEvent_userId_stageCode_idx" ON "ClearEvent"("userId", "stageCode");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");
