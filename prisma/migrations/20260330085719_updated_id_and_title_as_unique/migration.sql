/*
  Warnings:

  - You are about to drop the column `subcategory` on the `MarketPlace` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id]` on the table `MarketPlace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[title]` on the table `MarketPlace` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subCategory` to the `MarketPlace` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MarketPlace_category_subcategory_idx";

-- AlterTable
ALTER TABLE "MarketPlace" DROP COLUMN "subcategory",
ADD COLUMN     "subCategory" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MarketPlace_id_key" ON "MarketPlace"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPlace_title_key" ON "MarketPlace"("title");

-- CreateIndex
CREATE INDEX "MarketPlace_category_subCategory_idx" ON "MarketPlace"("category", "subCategory");
