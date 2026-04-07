/*
  Warnings:

  - You are about to drop the column `devicetype` on the `LoginAttempt` table. All the data in the column will be lost.
  - Added the required column `deviceType` to the `LoginAttempt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LoginAttempt" DROP COLUMN "devicetype",
ADD COLUMN     "deviceType" TEXT NOT NULL;
