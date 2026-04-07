-- CreateTable
CREATE TABLE "AdminTokenHash" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userIp" TEXT,
    "adminId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AdminTokenHash_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AdminTokenHash" ADD CONSTRAINT "AdminTokenHash_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
