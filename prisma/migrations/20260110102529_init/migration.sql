-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('password', 'google', 'apple', 'trinity_network');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'blocked', 'deleted');

-- CreateEnum
CREATE TYPE "UserBatch" AS ENUM ('NONE', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('superadmin', 'admin', 'moderator', 'support', 'user');

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('manage_users', 'manage_content', 'view_reports', 'manage_settings');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('text', 'image', 'video', 'reel');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('like', 'comment', 'follow', 'mention', 'repost');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('public', 'followers', 'private');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('active', 'archived', 'draft', 'deleted');

-- CreateEnum
CREATE TYPE "AdObjective" AS ENUM ('traffic', 'engagement', 'app_install', 'video_views', 'conversions');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('draft', 'pending_review', 'active', 'paused', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "AdPlacement" AS ENUM ('feed', 'reel', 'story', 'profile');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('cpc', 'cpm', 'cpa');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'INR');

-- CreateEnum
CREATE TYPE "AdEventType" AS ENUM ('impression', 'click', 'conversion');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "batch" "UserBatch" NOT NULL DEFAULT 'NONE',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumEnds" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" UUID NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'other',
    "birthdate" TIMESTAMP(3),
    "location" TEXT,
    "websiteUrl" TEXT,
    "socialTwitter" TEXT,
    "socialFacebook" TEXT,
    "socialLinkedin" TEXT,
    "socialInstagram" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserAuth" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "identifier" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "loginIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTotp" (
    "userId" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT 'Stardom',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTotp_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserBackupCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOtp" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'user',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "permissions" "AdminPermission"[],
    "activitedAt" TIMESTAMP(3),
    "activatedBy" UUID,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" TEXT,
    "postType" "PostType" NOT NULL,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "durationSec" INTEGER,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "parentPostId" UUID,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'public',
    "status" "PostStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reel" (
    "postId" UUID NOT NULL,
    "musicName" TEXT,
    "musicUrl" TEXT,
    "loopEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" UUID,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" UUID NOT NULL,
    "followingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "PostView" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostHashtag" (
    "postId" UUID NOT NULL,
    "hashtagId" UUID NOT NULL,

    CONSTRAINT "PostHashtag_pkey" PRIMARY KEY ("postId","hashtagId")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "postId" UUID,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "objective" "AdObjective" NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'draft',
    "dailyBudget" DECIMAL(65,30) NOT NULL,
    "totalBudget" DECIMAL(65,30),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSet" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "billingType" "BillingType" NOT NULL,
    "bidAmount" DECIMAL(65,30) NOT NULL,
    "countries" TEXT[],
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "genders" TEXT[],
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "AdStatus" NOT NULL DEFAULT 'draft',

    CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCreative" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "ctaText" TEXT,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" UUID NOT NULL,
    "adSetId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'draft',
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdEvent" (
    "id" UUID NOT NULL,
    "adId" UUID NOT NULL,
    "type" "AdEventType" NOT NULL,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "idx_active_users" ON "User"("id");

-- CreateIndex
CREATE INDEX "UserAuth_userId_idx" ON "UserAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuth_provider_identifier_key" ON "UserAuth"("provider", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "UserSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_identifier_createdAt_idx" ON "LoginAttempt"("identifier", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserBackupCode_userId_idx" ON "UserBackupCode"("userId");

-- CreateIndex
CREATE INDEX "UserOtp_userId_purpose_idx" ON "UserOtp"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_tag_key" ON "Hashtag"("tag");

-- CreateIndex
CREATE INDEX "AdAccount_userId_idx" ON "AdAccount"("userId");

-- CreateIndex
CREATE INDEX "AdCampaign_adAccountId_idx" ON "AdCampaign"("adAccountId");

-- CreateIndex
CREATE INDEX "AdSet_campaignId_idx" ON "AdSet"("campaignId");

-- CreateIndex
CREATE INDEX "Ad_adSetId_idx" ON "Ad"("adSetId");

-- CreateIndex
CREATE INDEX "AdEvent_adId_type_idx" ON "AdEvent"("adId", "type");

-- CreateIndex
CREATE INDEX "AdEvent_createdAt_idx" ON "AdEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuth" ADD CONSTRAINT "UserAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTotp" ADD CONSTRAINT "UserTotp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBackupCode" ADD CONSTRAINT "UserBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOtp" ADD CONSTRAINT "UserOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHashtag" ADD CONSTRAINT "PostHashtag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHashtag" ADD CONSTRAINT "PostHashtag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "AdCreative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdEvent" ADD CONSTRAINT "AdEvent_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
