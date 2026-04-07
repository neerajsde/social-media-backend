-- CreateEnum
CREATE TYPE "SearchType" AS ENUM ('foryou', 'account', 'trending', 'tags');

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SearchType" NOT NULL,
    "query" TEXT NOT NULL,
    "queryNormalized" TEXT NOT NULL,
    "resultCount" INTEGER,
    "clickedResult" BOOLEAN NOT NULL DEFAULT false,
    "targetUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchHistory_userId_createdAt_idx" ON "SearchHistory"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SearchHistory_userId_queryNormalized_idx" ON "SearchHistory"("userId", "queryNormalized");

-- CreateIndex
CREATE INDEX "SearchHistory_type_createdAt_idx" ON "SearchHistory"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SearchHistory_targetUserId_idx" ON "SearchHistory"("targetUserId");

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
