/*
  Warnings:

  - Added the required column `browser` to the `LoginAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceName` to the `LoginAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `devicetype` to the `LoginAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message` to the `LoginAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `os` to the `LoginAttempt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LoginAttempt" ADD COLUMN     "browser" TEXT NOT NULL,
ADD COLUMN     "deviceName" TEXT NOT NULL,
ADD COLUMN     "devicetype" TEXT NOT NULL,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "os" TEXT NOT NULL;
