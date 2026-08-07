-- Sales↔Order связь (Baseline §5): один заказ ← одна сделка.
CREATE UNIQUE INDEX "Sale_orderId_key" ON "Sale"("orderId");
