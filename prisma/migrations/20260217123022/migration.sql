/*
  Warnings:

  - A unique constraint covering the columns `[tag,createdBy]` on the table `Hashtag` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_tag_createdBy_key" ON "Hashtag"("tag", "createdBy");
