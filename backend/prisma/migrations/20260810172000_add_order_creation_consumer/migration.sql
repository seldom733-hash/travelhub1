-- AlterTable: canonical event-driven Order creation (Step 2.5).
-- customerId становится nullable — OrderRequested.customerId честно nullable
-- (internal-assisted flow без CRM-клиента, Step 2.4 §11). Существующие
-- bootstrap Orders сохраняют свой customerId (DROP NOT NULL не трогает данные).

ALTER TABLE "order"."Order" ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable: upstream refs (без FK, ADR-0001) + frozen commercial snapshot
-- из OrderRequested (без пересчёта; discount/payment/acquisition — String
-- snapshot, т.к. cross-schema enum ref запрещён).

ALTER TABLE "order"."Order" ADD COLUMN     "acquisitionSource" TEXT,
ADD COLUMN     "checkoutId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(12,2),
ADD COLUMN     "discountType" TEXT,
ADD COLUMN     "discountValue" DECIMAL(12,2),
ADD COLUMN     "initialAmount" DECIMAL(12,2),
ADD COLUMN     "orderRequestedEventId" TEXT,
ADD COLUMN     "paymentScheme" TEXT,
ADD COLUMN     "prepaymentType" TEXT,
ADD COLUMN     "prepaymentValue" DECIMAL(12,2),
ADD COLUMN     "quoteId" TEXT,
ADD COLUMN     "remainingAmount" DECIMAL(12,2),
ADD COLUMN     "reservationId" TEXT,
ADD COLUMN     "reservationIds" JSONB,
ADD COLUMN     "saleCode" TEXT,
ADD COLUMN     "saleId" TEXT,
ADD COLUMN     "subtotal" DECIMAL(12,2);

-- CreateIndex: DB-level инвариант «один Sale → один Order»
-- (идемпотентность НЕ зависит только от in-process inbox; NULL saleId
-- допускается — legacy/bootstrap Order).

CREATE UNIQUE INDEX "Order_saleId_key" ON "order"."Order"("saleId");
