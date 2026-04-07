/*
  Warnings:

  - You are about to drop the column `userAgent` on the `UserSession` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserSession" DROP COLUMN "userAgent",
ADD COLUMN     "browser" TEXT,
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "os" TEXT;
