-- CreateTable
CREATE TABLE "TokenHash" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,

    CONSTRAINT "TokenHash_pkey" PRIMARY KEY ("id")
);
