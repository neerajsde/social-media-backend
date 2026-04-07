/*
  Warnings:

  - Added the required column `status` to the `SharePost` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `source` on the `SharePost` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SharePostSource" AS ENUM ('whatsapp', 'link', 'facebook', 'twitter', 'friend');

-- AlterTable
ALTER TABLE "SharePost" ADD COLUMN     "receiverId" UUID,
ADD COLUMN     "status" "SharePostStatus" NOT NULL,
DROP COLUMN "source",
ADD COLUMN     "source" "SharePostSource" NOT NULL;

-- AddForeignKey
ALTER TABLE "SharePost" ADD CONSTRAINT "SharePost_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
