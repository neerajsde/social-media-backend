/*
  Warnings:

  - You are about to drop the column `durationSec` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `mediaUrl` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnailUrl` on the `Post` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'TRANSCODING', 'UPLOADING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "durationSec",
DROP COLUMN "mediaUrl",
DROP COLUMN "thumbnailUrl";

-- CreateTable
CREATE TABLE "Video" (
    "postId" UUID NOT NULL,
    "status" "ProcessStatus" NOT NULL DEFAULT 'UPLOADED',
    "orignalVideo" TEXT NOT NULL,
    "durationSec" INTEGER,
    "thumbnail" TEXT,
    "video144p" TEXT,
    "video360p" TEXT,
    "video480p" TEXT,
    "video540p" TEXT,
    "video720p" TEXT,
    "video1080p" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("postId")
);

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
