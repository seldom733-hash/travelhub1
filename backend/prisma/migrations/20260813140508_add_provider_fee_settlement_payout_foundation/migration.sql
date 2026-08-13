-- CreateTable
CREATE TABLE "finance"."ProviderFee" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "providerRef" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "actorType" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."Settlement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "actorType" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."Payout" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "providerRef" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "actorType" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderFee_code_key" ON "finance"."ProviderFee"("code");

-- CreateIndex
CREATE INDEX "ProviderFee_sourceType_sourceId_idx" ON "finance"."ProviderFee"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderFee_sourceType_sourceId_provider_key" ON "finance"."ProviderFee"("sourceType", "sourceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_code_key" ON "finance"."Settlement"("code");

-- CreateIndex
CREATE INDEX "Settlement_sourceType_sourceId_idx" ON "finance"."Settlement"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_sourceType_sourceId_key" ON "finance"."Settlement"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_code_key" ON "finance"."Payout"("code");

-- CreateIndex
CREATE INDEX "Payout_sourceType_sourceId_idx" ON "finance"."Payout"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_sourceType_sourceId_key" ON "finance"."Payout"("sourceType", "sourceId");
