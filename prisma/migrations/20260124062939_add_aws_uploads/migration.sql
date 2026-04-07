-- CreateTable
CREATE TABLE "AwsUploads" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "uploadUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwsUploads_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AwsUploads" ADD CONSTRAINT "AwsUploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
