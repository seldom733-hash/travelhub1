import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

/**
 * PHASE 2 STEP 2.10 — Finance Domain Foundation (новый bounded context, finance.*).
 * Владелец: Payment/Refund/Invoice/Commission/CommissionAccrual/Currency/
 * ExchangeRate/Tax/TaxRule (+ future ProviderFee/Settlement/Payout/Ledger).
 *
 * Step 2.10 scope — foundation: master-data CRUD (Currency/ExchangeRate/Tax/
 * TaxRule). Агрегатные модели (Payment/PaymentTerms/Refund/Invoice/Commission/
 * CommissionAccrual) — схемные foundation без клиентских write-путей (создание
 * — 2.12–2.14). НЕ пишет в Order/Booking/Catalog/Availability (ADR-0001).
 */
@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
