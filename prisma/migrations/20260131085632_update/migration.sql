/*
  Warnings:

  - You are about to drop the column `userId` on the `AdminSession` table. All the data in the column will be lost.
  - Added the required column `adminId` to the `AdminSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AdminSession" DROP CONSTRAINT "AdminSession_userId_fkey";

-- DropIndex
DROP INDEX "AdminSession_userId_idx";

-- AlterTable
ALTER TABLE "AdminSession" DROP COLUMN "userId",
ADD COLUMN     "adminId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "AdminOtp" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminTotp" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT 'Stardom',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTotp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminOtp_adminId_purpose_idx" ON "AdminOtp"("adminId", "purpose");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminOtp" ADD CONSTRAINT "AdminOtp_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTotp" ADD CONSTRAINT "AdminTotp_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
