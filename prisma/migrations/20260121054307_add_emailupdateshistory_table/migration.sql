-- CreateTable
CREATE TABLE "EmailUpdatesHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "previousEmail" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailUpdatesHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailUpdatesHistory_previousEmail_key" ON "EmailUpdatesHistory"("previousEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EmailUpdatesHistory_newEmail_key" ON "EmailUpdatesHistory"("newEmail");

-- AddForeignKey
ALTER TABLE "EmailUpdatesHistory" ADD CONSTRAINT "EmailUpdatesHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
