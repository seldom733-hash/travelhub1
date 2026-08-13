-- CreateTable
CREATE TABLE "finance"."LedgerTransaction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "businessRef" TEXT,
    "correlationId" TEXT,
    "causationId" TEXT,
    "actorType" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_code_key" ON "finance"."LedgerTransaction"("code");

-- CreateIndex
CREATE INDEX "LedgerTransaction_sourceType_sourceId_idx" ON "finance"."LedgerTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_createdAt_idx" ON "finance"."LedgerTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_sourceType_sourceId_type_key" ON "finance"."LedgerTransaction"("sourceType", "sourceId", "type");
