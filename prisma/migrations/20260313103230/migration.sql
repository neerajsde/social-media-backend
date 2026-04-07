-- CreateEnum
CREATE TYPE "UserPresence" AS ENUM ('online', 'offline');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "presence" "UserPresence" NOT NULL DEFAULT 'offline';
