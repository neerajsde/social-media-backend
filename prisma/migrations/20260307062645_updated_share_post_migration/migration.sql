/*
  Warnings:

  - The values [link,friend] on the enum `SharePostSource` will be removed. If these variants are still used in the database, this will fail.
  - The values [unsent] on the enum `SharePostStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `userId` on the `SharePost` table. All the data in the column will be lost.
  - Added the required column `senderId` to the `SharePost` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SharePostSource_new" AS ENUM ('whatsapp', 'facebook', 'twitter', 'inApp');
ALTER TABLE "SharePost" ALTER COLUMN "source" TYPE "SharePostSource_new" USING ("source"::text::"SharePostSource_new");
ALTER TYPE "SharePostSource" RENAME TO "SharePostSource_old";
ALTER TYPE "SharePostSource_new" RENAME TO "SharePostSource";
DROP TYPE "public"."SharePostSource_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SharePostStatus_new" AS ENUM ('seen', 'sent');
ALTER TABLE "SharePost" ALTER COLUMN "status" TYPE "SharePostStatus_new" USING ("status"::text::"SharePostStatus_new");
ALTER TYPE "SharePostStatus" RENAME TO "SharePostStatus_old";
ALTER TYPE "SharePostStatus_new" RENAME TO "SharePostStatus";
DROP TYPE "public"."SharePostStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "SharePost" DROP CONSTRAINT "SharePost_userId_fkey";

-- AlterTable
ALTER TABLE "SharePost" DROP COLUMN "userId",
ADD COLUMN     "link" TEXT,
ADD COLUMN     "senderId" UUID NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'sent',
ALTER COLUMN "source" SET DEFAULT 'inApp';

-- AddForeignKey
ALTER TABLE "SharePost" ADD CONSTRAINT "SharePost_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
