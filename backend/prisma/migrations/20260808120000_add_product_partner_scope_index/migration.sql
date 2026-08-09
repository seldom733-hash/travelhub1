-- Step 1.3: server-side object scope PARTNER → Product.partnerId.
-- Индекс для scoped list/query/count (WHERE partnerId = actor.partnerId).
-- FK Product.partnerId → crm.Partner НЕ создаётся: между схемами FK запрещены
-- (ADR-0001), партнёр живёт в crm.*. Орфанные ссылки валидируются при установке.
CREATE INDEX "Product_partnerId_idx" ON "catalog"."Product"("partnerId");
