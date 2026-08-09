
-- CreateEnum
CREATE TYPE "security"."ApplicantType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "security"."PartnerApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "crm"."Partner" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "taxId" TEXT;

-- CreateTable
CREATE TABLE "security"."PartnerApplication" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT,
    "status" "security"."PartnerApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicantType" "security"."ApplicantType" NOT NULL,
    "legalName" TEXT,
    "brandName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "website" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "businessDescription" TEXT,
    "serviceCategories" JSONB,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedByUsername" TEXT,
    "decisionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security"."PartnerApplicationHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerApplicationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApplication_code_key" ON "security"."PartnerApplication"("code");

-- CreateIndex
CREATE INDEX "PartnerApplication_status_idx" ON "security"."PartnerApplication"("status");

-- CreateIndex
CREATE INDEX "PartnerApplication_userId_idx" ON "security"."PartnerApplication"("userId");

-- CreateIndex
CREATE INDEX "PartnerApplicationHistory_applicationId_idx" ON "security"."PartnerApplicationHistory"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_unique_contactEmail" ON "crm"."Partner"("contactEmail") WHERE ("contactEmail" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_unique_registrationNumber" ON "crm"."Partner"("registrationNumber") WHERE ("registrationNumber" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "security"."PartnerApplication" ADD CONSTRAINT "PartnerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "security"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security"."PartnerApplicationHistory" ADD CONSTRAINT "PartnerApplicationHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "security"."PartnerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

