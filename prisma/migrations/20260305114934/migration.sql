-- CreateEnum
CREATE TYPE "SharePostStatus" AS ENUM ('seen', 'sent', 'unsent');

-- CreateTable
CREATE TABLE "SharePost" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "source" "SharePostStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharePost_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SharePost" ADD CONSTRAINT "SharePost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharePost" ADD CONSTRAINT "SharePost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
