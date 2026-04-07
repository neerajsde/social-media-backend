/*
  Warnings:

  - The values [UPLOADING] on the enum `ProcessStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `video144p` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `video480p` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `video540p` on the `Video` table. All the data in the column will be lost.
  - Made the column `durationSec` on table `Video` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProcessStatus_new" AS ENUM ('UPLOADED', 'QUEUED', 'SCANNING', 'PROCESSING', 'TRANSCODING', 'COMPLETED', 'FAILED');
ALTER TABLE "public"."Video" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Video" ALTER COLUMN "status" TYPE "ProcessStatus_new" USING ("status"::text::"ProcessStatus_new");
ALTER TYPE "ProcessStatus" RENAME TO "ProcessStatus_old";
ALTER TYPE "ProcessStatus_new" RENAME TO "ProcessStatus";
DROP TYPE "public"."ProcessStatus_old";
ALTER TABLE "Video" ALTER COLUMN "status" SET DEFAULT 'UPLOADED';
COMMIT;

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "video144p",
DROP COLUMN "video480p",
DROP COLUMN "video540p",
ALTER COLUMN "durationSec" SET NOT NULL,
ALTER COLUMN "durationSec" SET DEFAULT 0;
