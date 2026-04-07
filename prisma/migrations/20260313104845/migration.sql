-- CreateEnum
CREATE TYPE "AdminPresence" AS ENUM ('online', 'offline');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "presence" "AdminPresence" NOT NULL DEFAULT 'offline';
