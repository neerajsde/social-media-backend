-- AlterTable
ALTER TABLE "TokenHash" ADD COLUMN     "userId" UUID;

-- AddForeignKey
ALTER TABLE "TokenHash" ADD CONSTRAINT "TokenHash_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
