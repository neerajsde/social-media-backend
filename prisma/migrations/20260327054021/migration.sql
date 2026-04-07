-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('view', 'like', 'unlike', 'comment', 'share', 'bookmark', 'unbookmark', 'repost');

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('feed', 'explore', 'random', 'profile', 'search', 'direct');

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "source" "ActivitySource" NOT NULL DEFAULT 'feed',
    "durationSec" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivity_userId_idx" ON "UserActivity"("userId");

-- CreateIndex
CREATE INDEX "UserActivity_postId_idx" ON "UserActivity"("postId");

-- CreateIndex
CREATE INDEX "UserActivity_userId_type_idx" ON "UserActivity"("userId", "type");

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserActivity_postId_type_idx" ON "UserActivity"("postId", "type");

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
