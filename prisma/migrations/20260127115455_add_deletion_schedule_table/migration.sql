-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'RECOVERED', 'DELETED');

-- CreateTable
CREATE TABLE "DeletionSchedule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "recoveredAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "reason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeletionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletionSchedule_userId_key" ON "DeletionSchedule"("userId");

-- CreateIndex
CREATE INDEX "DeletionSchedule_status_scheduledAt_idx" ON "DeletionSchedule"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "DeletionSchedule" ADD CONSTRAINT "DeletionSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
