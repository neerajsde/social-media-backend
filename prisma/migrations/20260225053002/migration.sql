/*
  Warnings:

  - The values [private] on the enum `PostVisibility` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'repost';

-- AlterEnum
BEGIN;
CREATE TYPE "PostVisibility_new" AS ENUM ('public', 'followers');
ALTER TABLE "public"."Post" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "visibility" TYPE "PostVisibility_new" USING ("visibility"::text::"PostVisibility_new");
ALTER TYPE "PostVisibility" RENAME TO "PostVisibility_old";
ALTER TYPE "PostVisibility_new" RENAME TO "PostVisibility";
DROP TYPE "public"."PostVisibility_old";
ALTER TABLE "Post" ALTER COLUMN "visibility" SET DEFAULT 'public';
COMMIT;
