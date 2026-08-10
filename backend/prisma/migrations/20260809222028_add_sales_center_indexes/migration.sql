-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "sales"."Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_status_idx" ON "sales"."Lead"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_status_createdAt_idx" ON "sales"."Opportunity"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_assignedToId_status_idx" ON "sales"."Opportunity"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Quote_status_createdAt_idx" ON "sales"."Quote"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_status_createdAt_idx" ON "sales"."Sale"("status", "createdAt");
