-- CreateTable
CREATE TABLE "finance"."OrderPaymentSchedule" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "percent" INTEGER,
    "condition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPaymentSchedule_orderId_idx" ON "finance"."OrderPaymentSchedule"("orderId");
