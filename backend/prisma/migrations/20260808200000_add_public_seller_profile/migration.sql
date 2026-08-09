-- CreateEnum
CREATE TYPE "catalog"."SellerVisibilityMode" AS ENUM ('ANONYMOUS', 'VERIFIED_ALIAS', 'PUBLIC_BRAND');

-- CreateEnum
CREATE TYPE "catalog"."SellerProfileStatus" AS ENUM ('APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "catalog"."SellerProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "catalog"."PublicSellerProfile" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" "catalog"."SellerProfileStatus" NOT NULL DEFAULT 'APPROVED',
    "visibilityMode" "catalog"."SellerVisibilityMode" NOT NULL DEFAULT 'ANONYMOUS',
    "publicDisplayName" TEXT,
    "publicDescription" TEXT,
    "publicLogoMediaId" TEXT,
    "countryLabel" TEXT,
    "cityLabel" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "memberSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByUsername" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicSellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."PublicSellerProfileProposal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "catalog"."SellerProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestedDisplayName" TEXT,
    "requestedDescription" TEXT,
    "requestedLogoMediaId" TEXT,
    "requestedCountryLabel" TEXT,
    "requestedCityLabel" TEXT,
    "requestedVisibilityMode" "catalog"."SellerVisibilityMode" NOT NULL DEFAULT 'VERIFIED_ALIAS',
    "approvedVisibilityMode" "catalog"."SellerVisibilityMode",
    "submittedById" TEXT,
    "submittedByUsername" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedByUsername" TEXT,
    "decisionReason" TEXT,
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicSellerProfileProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicSellerProfile_publicId_key" ON "catalog"."PublicSellerProfile"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicSellerProfile_partnerId_key" ON "catalog"."PublicSellerProfile"("partnerId");

-- CreateIndex
CREATE INDEX "PublicSellerProfile_status_idx" ON "catalog"."PublicSellerProfile"("status");

-- CreateIndex
CREATE INDEX "PublicSellerProfile_visibilityMode_idx" ON "catalog"."PublicSellerProfile"("visibilityMode");

-- CreateIndex
CREATE UNIQUE INDEX "PublicSellerProfileProposal_code_key" ON "catalog"."PublicSellerProfileProposal"("code");

-- CreateIndex
CREATE INDEX "PublicSellerProfileProposal_status_idx" ON "catalog"."PublicSellerProfileProposal"("status");

-- CreateIndex
CREATE INDEX "PublicSellerProfileProposal_profileId_idx" ON "catalog"."PublicSellerProfileProposal"("profileId");

-- AddForeignKey
ALTER TABLE "catalog"."PublicSellerProfileProposal" ADD CONSTRAINT "PublicSellerProfileProposal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "catalog"."PublicSellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

