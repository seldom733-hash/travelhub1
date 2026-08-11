-- PHASE 2 STEP 2.2F — Proposal → Canonical Sales Conversion (DD-030, target = Opportunity)
-- Аддитивные изменения БЕЗ backfill и БЕЗ cross-schema FK (ADR-0001/ADR-0012).
-- Новые nullable-колонки — legacy-safe (существующие строки остаются NULL честно).

-- reverse.BuyerRequest: канонический выбранный Proposal (trusted ref без FK).
-- @unique = DB-invariant «один выбранный Proposal на request» + «один request на
-- выбранный Proposal» (one-winner при concurrent A/B selection).
ALTER TABLE "reverse"."BuyerRequest" ADD COLUMN "selectedProposalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BuyerRequest_selectedProposalId_key" ON "reverse"."BuyerRequest"("selectedProposalId");

-- reverse.SellerProposal: selection/conversion state (status enum НЕ меняется —
-- DRAFT/SUBMITTED/WITHDRAWN остаются; selection — отдельный server-owned факт).
ALTER TABLE "reverse"."SellerProposal" ADD COLUMN "selectedAt" TIMESTAMP(3),
ADD COLUMN "convertedOpportunityId" TEXT,
ADD COLUMN "convertedAt" TIMESTAMP(3);

-- CreateIndex: «один Proposal → максимум одна Opportunity» (duplicate-conversion guard).
CREATE UNIQUE INDEX "SellerProposal_convertedOpportunityId_key" ON "reverse"."SellerProposal"("convertedOpportunityId");

-- sales.Opportunity: provenance (BuyerRequest/Proposal/Seller) + server-derived
-- acquisition source. Все refs — по ID без FK (trusted refs, ADR-0001).
ALTER TABLE "sales"."Opportunity" ADD COLUMN "buyerRequestId" TEXT,
ADD COLUMN "proposalId" TEXT,
ADD COLUMN "sellerId" TEXT,
ADD COLUMN "acquisitionSource" "sales"."SalesAcquisitionSource";

-- CreateIndex: один Proposal → одна Opportunity (DD-030 §12, DB-level invariant).
CREATE UNIQUE INDEX "Opportunity_proposalId_key" ON "sales"."Opportunity"("proposalId");

-- CreateIndex: provenance queries по request.
CREATE INDEX "Opportunity_buyerRequestId_idx" ON "sales"."Opportunity"("buyerRequestId");

-- CreateIndex: provenance queries по seller.
CREATE INDEX "Opportunity_sellerId_idx" ON "sales"."Opportunity"("sellerId");

-- sales.Quote: acquisition source propagation (наследуется из Opportunity при
-- создании Quote по opportunityId; Checkout выводит source из Quote server-side).
ALTER TABLE "sales"."Quote" ADD COLUMN "acquisitionSource" "sales"."SalesAcquisitionSource";
