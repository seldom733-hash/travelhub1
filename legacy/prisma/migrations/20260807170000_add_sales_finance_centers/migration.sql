-- TravelHub — Phase 2: Sales Center (Lead/Opportunity/Quote/Sale) and
-- Finance Center (Payment/Refund/Invoice/Commission/Currency/ExchangeRate/Tax/TaxRule).
-- OrderEvent.orderId становится опциональным: события Sales Center (QUOTE_ACCEPTED,
-- SALE_COMPLETED, ORDER_REQUESTED) предшествуют созданию Order.

-- ── OrderEvent: пересоздание таблицы (orderId теперь nullable) ──
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "correlationId" TEXT,
    "causationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderEvent" ("id", "orderId", "type", "payload", "status", "error", "correlationId", "causationId", "createdAt", "publishedAt")
    SELECT "id", "orderId", "type", "payload", "status", "error", "correlationId", "causationId", "createdAt", "publishedAt" FROM "OrderEvent";
DROP TABLE "OrderEvent";
ALTER TABLE "new_OrderEvent" RENAME TO "OrderEvent";
PRAGMA foreign_keys=ON;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Sales Center (Baseline §0.7)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Сайт',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "interest" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "qualification" TEXT NOT NULL DEFAULT 'cold',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "nextAction" TEXT,
    "nextActionAt" DATETIME,
    "slaDueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Lead_code_key" ON "Lead"("code");

CREATE TABLE "LeadHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "comment" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "need" TEXT,
    "productsRef" TEXT NOT NULL DEFAULT '[]',
    "budget" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expectedCloseDate" DATETIME,
    "probability" INTEGER NOT NULL DEFAULT 50,
    "stage" TEXT NOT NULL DEFAULT 'QUALIFICATION',
    "nextAction" TEXT,
    "nextActionAt" DATETIME,
    "risks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Opportunity_code_key" ON "Opportunity"("code");

CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "discount" REAL NOT NULL DEFAULT 0,
    "fees" REAL NOT NULL DEFAULT 0,
    "validUntil" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approval" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Quote_code_key" ON "Quote"("code");

CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'WON',
    "closedAt" DATETIME,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Sale_code_key" ON "Sale"("code");
CREATE UNIQUE INDEX "Sale_quoteId_key" ON "Sale"("quoteId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Finance Center (Baseline §0.6)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "orderId" TEXT,
    "saleId" TEXT,
    "customerId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL DEFAULT 'Банковский перевод',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Payment_code_key" ON "Payment"("code");

CREATE TABLE "Refund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Refund_code_key" ON "Refund"("code");

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "orderId" TEXT,
    "saleId" TEXT,
    "customerId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuedAt" DATETIME,
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invoice_code_key" ON "Invoice"("code");

CREATE TABLE "Commission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "orderId" TEXT,
    "partnerId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "rate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Commission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Commission_code_key" ON "Commission"("code");

CREATE TABLE "Currency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "fromCode" TEXT NOT NULL,
    "toCode" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExchangeRate_fromCode_fkey" FOREIGN KEY ("fromCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExchangeRate_toCode_fkey" FOREIGN KEY ("toCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExchangeRate_code_key" ON "ExchangeRate"("code");
CREATE UNIQUE INDEX "ExchangeRate_fromCode_toCode_date_key" ON "ExchangeRate"("fromCode", "toCode", "date");

CREATE TABLE "Tax" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Tax_code_key" ON "Tax"("code");

CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "country" TEXT,
    "serviceType" TEXT,
    "rateOverride" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxRule_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaxRule_code_key" ON "TaxRule"("code");

-- ── Индексы ──
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");
CREATE INDEX "OrderEvent_status_idx" ON "OrderEvent"("status");
CREATE INDEX "OrderEvent_type_idx" ON "OrderEvent"("type");
CREATE INDEX "OrderEvent_createdAt_idx" ON "OrderEvent"("createdAt");
CREATE INDEX "OrderEvent_correlationId_idx" ON "OrderEvent"("correlationId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "LeadHistory_leadId_idx" ON "LeadHistory"("leadId");
CREATE INDEX "LeadHistory_createdAt_idx" ON "LeadHistory"("createdAt");
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");
CREATE INDEX "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");
CREATE INDEX "Opportunity_customerId_idx" ON "Opportunity"("customerId");
CREATE INDEX "Quote_opportunityId_idx" ON "Quote"("opportunityId");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE INDEX "Commission_orderId_idx" ON "Commission"("orderId");
CREATE INDEX "Commission_status_idx" ON "Commission"("status");
CREATE INDEX "ExchangeRate_date_idx" ON "ExchangeRate"("date");
CREATE INDEX "TaxRule_taxId_idx" ON "TaxRule"("taxId");
CREATE INDEX "TaxRule_country_idx" ON "TaxRule"("country");
