/*
  Warnings:

  - Added the required column `ipAddress` to the `AwsUploads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AwsUploads" ADD COLUMN     "ipAddress" TEXT NOT NULL;
