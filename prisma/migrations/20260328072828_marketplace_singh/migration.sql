-- CreateTable
CREATE TABLE "MarketPlace" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "qtySold" INTEGER NOT NULL DEFAULT 0,
    "totalQty" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPlace_userId_idx" ON "MarketPlace"("userId");

-- CreateIndex
CREATE INDEX "MarketPlace_category_subcategory_idx" ON "MarketPlace"("category", "subcategory");

-- CreateIndex
CREATE INDEX "MarketPlace_price_idx" ON "MarketPlace"("price");

-- CreateIndex
CREATE INDEX "MarketPlace_createdAt_idx" ON "MarketPlace"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketPlace" ADD CONSTRAINT "MarketPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
