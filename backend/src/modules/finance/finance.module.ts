import { Module } from "@nestjs/common";
import { DisputeService } from "./dispute.service";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { LedgerService } from "./ledger.service";
import { PaymentService } from "./payment.service";
import { RefundService } from "./refund.service";
import { SettlementService } from "./settlement.service";

/**
 * PHASE 2 STEP 2.10 — Finance Domain Foundation (новый bounded context, finance.*).
 * Владелец: Payment/Refund/Invoice/Commission/CommissionAccrual/Currency/
 * ExchangeRate/Tax/TaxRule/LedgerTransaction (+ future ProviderFee/Settlement/
 * Payout).
 *
 * Step 2.10 scope — foundation: master-data CRUD (Currency/ExchangeRate/Tax/
 * TaxRule). Агрегатные модели (Payment/PaymentTerms/Refund/Invoice/Commission/
 * CommissionAccrual) — схемные foundation без клиентских write-путей (создание *  — 2.12–2.14). Step 2.10A: immutable LedgerTransaction foundation (LedgerService
 *  — единственный canonical writer; публичного POST нет; read — Finance Center).
 *  Step 2.10B: ProviderFee/Settlement/Payout foundation (SettlementService —
 *  единственный canonical writer этих фактов; публичного POST нет; read-only).
 *  НЕ пишет в Order/Booking/Catalog/Availability (ADR-0001).
 */
@Module({
  controllers: [FinanceController],
  providers: [FinanceService, LedgerService, PaymentService, RefundService, SettlementService, DisputeService],
})
export class FinanceModule {}
