-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales";

-- CreateEnum
CREATE TYPE "sales"."LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "sales"."OpportunityStatus" AS ENUM ('NEW', 'OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "sales"."QuoteStatus" AS ENUM ('DRAFT', 'ISSUED');

-- CreateEnum
CREATE TYPE "sales"."SaleStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "sales"."Lead" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "assignedToId" TEXT,
    "status" "sales"."LeadStatus" NOT NULL DEFAULT 'NEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."LeadHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."Opportunity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "assignedToId" TEXT,
    "status" "sales"."OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."OpportunityHistory" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."Quote" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT,
    "opportunityId" TEXT,
    "productId" TEXT,
    "status" "sales"."QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."QuoteHistory" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."Sale" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT,
    "opportunityId" TEXT,
    "quoteId" TEXT,
    "status" "sales"."SaleStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."SaleHistory" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_code_key" ON "sales"."Lead"("code");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "sales"."Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_customerId_idx" ON "sales"."Lead"("customerId");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "sales"."Lead"("assignedToId");

-- CreateIndex
CREATE INDEX "LeadHistory_leadId_idx" ON "sales"."LeadHistory"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_code_key" ON "sales"."Opportunity"("code");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "sales"."Opportunity"("status");

-- CreateIndex
CREATE INDEX "Opportunity_leadId_idx" ON "sales"."Opportunity"("leadId");

-- CreateIndex
CREATE INDEX "Opportunity_customerId_idx" ON "sales"."Opportunity"("customerId");

-- CreateIndex
CREATE INDEX "OpportunityHistory_opportunityId_idx" ON "sales"."OpportunityHistory"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_code_key" ON "sales"."Quote"("code");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "sales"."Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_opportunityId_idx" ON "sales"."Quote"("opportunityId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "sales"."Quote"("customerId");

-- CreateIndex
CREATE INDEX "QuoteHistory_quoteId_idx" ON "sales"."QuoteHistory"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_code_key" ON "sales"."Sale"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_quoteId_key" ON "sales"."Sale"("quoteId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "sales"."Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_opportunityId_idx" ON "sales"."Sale"("opportunityId");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "sales"."Sale"("customerId");

-- CreateIndex
CREATE INDEX "SaleHistory_saleId_idx" ON "sales"."SaleHistory"("saleId");

-- AddForeignKey
ALTER TABLE "sales"."LeadHistory" ADD CONSTRAINT "LeadHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."OpportunityHistory" ADD CONSTRAINT "OpportunityHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "sales"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."Quote" ADD CONSTRAINT "Quote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "sales"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."QuoteHistory" ADD CONSTRAINT "QuoteHistory_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "sales"."Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."Sale" ADD CONSTRAINT "Sale_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "sales"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."Sale" ADD CONSTRAINT "Sale_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "sales"."Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales"."SaleHistory" ADD CONSTRAINT "SaleHistory_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
