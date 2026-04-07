/*
  Warnings:

  - You are about to drop the column `video1080p` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `video1440p` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `video360p` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `video720p` on the `Video` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Video" DROP COLUMN "video1080p",
DROP COLUMN "video1440p",
DROP COLUMN "video360p",
DROP COLUMN "video720p",
ADD COLUMN     "hlsMasterKey" TEXT;
