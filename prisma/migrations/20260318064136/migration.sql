/*
  Warnings:

  - You are about to drop the column `orignalVideo` on the `Video` table. All the data in the column will be lost.
  - Added the required column `originalVideo` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Video" DROP COLUMN "orignalVideo",
ADD COLUMN     "originalVideo" TEXT NOT NULL;
