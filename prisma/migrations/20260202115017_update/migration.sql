/*
  Warnings:

  - You are about to drop the column `Browser` on the `AdminSession` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AdminSession" DROP COLUMN "Browser",
ADD COLUMN     "browser" TEXT;
