-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "status" SET DEFAULT 'inactive';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
