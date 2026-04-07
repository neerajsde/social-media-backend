/*
  Warnings:

  - A unique constraint covering the columns `[fileKey]` on the table `AwsUploads` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `AwsUploads` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('CREATED', 'USED', 'DELETED');

-- AlterTable
ALTER TABLE "AwsUploads" ADD COLUMN     "status" "UploadStatus" NOT NULL DEFAULT 'CREATED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AwsUploads_fileKey_key" ON "AwsUploads"("fileKey");

-- CreateIndex
CREATE INDEX "AwsUploads_userId_idx" ON "AwsUploads"("userId");

-- CreateIndex
CREATE INDEX "AwsUploads_status_idx" ON "AwsUploads"("status");
