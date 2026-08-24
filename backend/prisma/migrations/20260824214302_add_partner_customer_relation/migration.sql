-- CreateTable
CREATE TABLE "crm"."PartnerCustomerRelation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "crm"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "leadSource" TEXT,
    "assignedTo" TEXT,
    "lifecycle" TEXT,
    "tags" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PartnerCustomerRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."PartnerCustomerRelationHistory" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCustomerRelationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerCustomerRelation_partnerId_idx" ON "crm"."PartnerCustomerRelation"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerCustomerRelation_customerId_idx" ON "crm"."PartnerCustomerRelation"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCustomerRelation_partnerId_customerId_key" ON "crm"."PartnerCustomerRelation"("partnerId", "customerId");

-- CreateIndex
CREATE INDEX "PartnerCustomerRelationHistory_relationId_idx" ON "crm"."PartnerCustomerRelationHistory"("relationId");

-- AddForeignKey
ALTER TABLE "crm"."PartnerCustomerRelation" ADD CONSTRAINT "PartnerCustomerRelation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "crm"."Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."PartnerCustomerRelation" ADD CONSTRAINT "PartnerCustomerRelation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."PartnerCustomerRelationHistory" ADD CONSTRAINT "PartnerCustomerRelationHistory_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "crm"."PartnerCustomerRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
