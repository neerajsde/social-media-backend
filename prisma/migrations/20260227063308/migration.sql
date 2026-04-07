-- CreateTable
CREATE TABLE "TrinityUserAuthenticate" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "logs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrinityUserAuthenticate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrinityUserAuthenticate" ADD CONSTRAINT "TrinityUserAuthenticate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
