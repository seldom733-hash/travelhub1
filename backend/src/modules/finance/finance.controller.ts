/**
 * PHASE 2 STEP 2.10 — FinanceController (Finance Center master data).
 *
 * Scope: master-data CRUD — Currency/ExchangeRate/Tax/TaxRule (Screen Design §7,
 * Architecture §8: Finance — единственный владелец; Settings НЕ дублирует).
 *
 * RBAC (RBAC Matrix §5/FINANCE, permissions.constants):
 *  - finance.currency.manage / finance.exchange_rate.manage / finance.tax.manage
 *    — только FINANCE/ADMIN (DIRECTOR — read-only finance.payment/refund/
 *    invoice/commission без master-data manage);
 *  - BUYER/PARTNER/OPERATOR/... не имеют finance.* master-data прав → 403.
 *
 * Payment/Refund/Invoice/Commission write-endpoints НЕ существуют в Step 2.10
 * (foundation, §15/§52) — агрегатные модели в схеме, создание — 2.12–2.14.
 */
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CommissionPolicyService } from "./commission-policy.service";
import { DisputeService } from "./dispute.service";
import { FinanceService } from "./finance.service";
import { LedgerService } from "./ledger.service";
import { PaymentService } from "./payment.service";
import { RefundService } from "./refund.service";
import { SettlementService } from "./settlement.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import {
  COMMISSION_POLICY_FORBIDDEN_KEYS,
  CommissionPolicyListQueryDto,
  CreateCommissionPolicyDto,
  CreateCurrencyDto,
  CreateDisputeDto,
  CreateExchangeRateDto,
  CreatePaymentDto,
  CreateRefundDto,
  CreateTaxDto,
  CreateTaxRuleDto,
  DISPUTE_CREATE_FORBIDDEN_KEYS,
  DisputeListQueryDto,
  FactListQueryDto,
  FINANCE_MASTER_FORBIDDEN_KEYS,
  LedgerListQueryDto,
  PAYMENT_CREATE_FORBIDDEN_KEYS,
  PaymentListQueryDto,
  REFUND_CREATE_FORBIDDEN_KEYS,
  RefundListQueryDto,
  ResolveCommissionPolicyQueryDto,
  UpdateCommissionPolicyDto,
  UpdateCurrencyDto,
  UpdateExchangeRateDto,
  UpdateTaxDto,
  UpdateTaxRuleDto,
} from "./finance.validation";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("finance")
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly ledger: LedgerService,
    private readonly settlement: SettlementService,
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
    private readonly disputes: DisputeService,
    private readonly commissionPolicies: CommissionPolicyService,
  ) {}

  // ── Currency (finance.currency.manage) ──────────────────────────────────────

  @Get("currencies")
  @RequirePermissions("finance.currency.manage")
  async listCurrencies() {
    return this.finance.listCurrencies();
  }

  @Get("currencies/:code")
  @RequirePermissions("finance.currency.manage")
  async getCurrency(@Param("code") code: string) {
    return this.finance.getCurrencyByCode(code);
  }

  @Post("currencies")
  @RequirePermissions("finance.currency.manage")
  async createCurrency(@Req() req: Request, @Body() dto: CreateCurrencyDto) {
    // raw req.body — ValidationPipe whitelist может silent-strip; forged keys
    // должны давать ЯВНЫЙ 422 (конвенция Sales/Reverse/Booking/Order).
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.createCurrency(dto);
  }

  @Patch("currencies/:code")
  @RequirePermissions("finance.currency.manage")
  async updateCurrency(@Param("code") code: string, @Req() req: Request, @Body() dto: UpdateCurrencyDto) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.updateCurrency(code, dto);
  }

  // ── ExchangeRate (finance.exchange_rate.manage) ─────────────────────────────

  @Get("exchange-rates")
  @RequirePermissions("finance.exchange_rate.manage")
  async listExchangeRates() {
    return this.finance.listExchangeRates();
  }

  @Get("exchange-rates/:code")
  @RequirePermissions("finance.exchange_rate.manage")
  async getExchangeRate(@Param("code") code: string) {
    return this.finance.getExchangeRateByCode(code);
  }

  @Post("exchange-rates")
  @RequirePermissions("finance.exchange_rate.manage")
  async createExchangeRate(@Req() req: Request, @Body() dto: CreateExchangeRateDto) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.createExchangeRate(dto);
  }

  @Patch("exchange-rates/:code")
  @RequirePermissions("finance.exchange_rate.manage")
  async updateExchangeRate(@Param("code") code: string, @Req() req: Request, @Body() dto: UpdateExchangeRateDto) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.updateExchangeRate(code, dto);
  }

  // ── Tax (finance.tax.manage) ────────────────────────────────────────────────

  @Get("taxes")
  @RequirePermissions("finance.tax.manage")
  async listTaxes() {
    return this.finance.listTaxes();
  }

  @Get("taxes/:code")
  @RequirePermissions("finance.tax.manage")
  async getTax(@Param("code") code: string) {
    return this.finance.getTaxByCode(code);
  }

  @Post("taxes")
  @RequirePermissions("finance.tax.manage")
  async createTax(@Req() req: Request, @Body() dto: CreateTaxDto) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.createTax(dto);
  }

  @Patch("taxes/:code")
  @RequirePermissions("finance.tax.manage")
  async updateTax(@Param("code") code: string, @Req() req: Request, @Body() dto: UpdateTaxDto) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.updateTax(code, dto);
  }

  // ── TaxRule (finance.tax.manage) ────────────────────────────────────────────

  @Get("tax-rules")
  @RequirePermissions("finance.tax.manage")
  async listTaxRules() {
    return this.finance.listTaxRules();
  }

  @Get("tax-rules/:code")
  @RequirePermissions("finance.tax.manage")
  async getTaxRule(@Param("code") code: string) {
    return this.finance.getTaxRuleByCode(code);
  }

  @Post("tax-rules")
  @RequirePermissions("finance.tax.manage")
  async createTaxRule(@Req() req: Request, @Body() dto: CreateTaxRuleDto) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.createTaxRule(dto);
  }

  @Patch("tax-rules/:code")
  @RequirePermissions("finance.tax.manage")
  async updateTaxRule(@Param("code") code: string, @Req() req: Request, @Body() dto: UpdateTaxRuleDto) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.finance.updateTaxRule(code, dto);
  }

  // ── LedgerTransaction (Step 2.10A) — read-only (Finance Center ledger view).
  // Публичного write-API НЕТ: создание — только внутренний LedgerService
  // (canonical Finance creation path, §13 option A). Immutability: update/delete
  // эндпоинты не существуют.

  @Get("ledger-transactions")
  @RequirePermissions("finance.ledger.read")
  async listLedger(@Query() query: LedgerListQueryDto) {
    return this.ledger.list(query);
  }

  @Get("ledger-transactions/:code")
  @RequirePermissions("finance.ledger.read")
  async getLedger(@Param("code") code: string) {
    return this.ledger.getByCode(code);
  }

  // ── ProviderFee / Settlement / Payout (Step 2.10B) — read-only (Finance
  // Center views). Публичного write-API НЕТ: создание — только внутренний
  // SettlementService (canonical Finance creation path). Append-only факты
  // без lifecycle: update/delete не существуют.

  @Get("provider-fees")
  @RequirePermissions("finance.provider_fee.read")
  async listProviderFees(@Query() query: FactListQueryDto) {
    return this.settlement.listProviderFees(query);
  }

  @Get("provider-fees/:code")
  @RequirePermissions("finance.provider_fee.read")
  async getProviderFee(@Param("code") code: string) {
    return this.settlement.getProviderFeeByCode(code);
  }

  @Get("settlements")
  @RequirePermissions("finance.settlement.read")
  async listSettlements(@Query() query: FactListQueryDto) {
    return this.settlement.listSettlements(query);
  }

  @Get("settlements/:code")
  @RequirePermissions("finance.settlement.read")
  async getSettlement(@Param("code") code: string) {
    return this.settlement.getSettlementByCode(code);
  }

  @Get("payouts")
  @RequirePermissions("finance.payout.read")
  async listPayouts(@Query() query: FactListQueryDto) {
    return this.settlement.listPayouts(query);
  }

  @Get("payouts/:code")
  @RequirePermissions("finance.payout.read")
  async getPayout(@Param("code") code: string) {
    return this.settlement.getPayoutByCode(code);
  }

  // ── Payment (Step 2.12 — provider-neutral Payment runtime) ─────────────────
  // Payment — Finance-owned aggregate (PAY-*). Деньги/статус/милстоуны —
  // server-owned (frozen Order snapshot verbatim); клиент передаёт ТОЛЬКО
  // orderId + опциональный paymentMethod (descriptive, без PII).
  // PSP/authorize/capture/webhook — Step 2.12A/2.12B (здесь нет).

  @Get("payments")
  @RequirePermissions("finance.payment.read")
  async listPayments(@Query() query: PaymentListQueryDto) {
    return this.payments.list(query);
  }

  @Get("payments/:code")
  @RequirePermissions("finance.payment.read")
  async getPayment(@Param("code") code: string) {
    return this.payments.getByCode(code);
  }

  @Post("payments")
  @RequirePermissions("finance.payment.write")
  async createPayment(@Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: CreatePaymentDto) {
    // raw req.body — forged server-owned поля (money/status/milestones/...) → 422.
    assertNoForbiddenKeys(req.body, PAYMENT_CREATE_FORBIDDEN_KEYS);
    return this.payments.createPayment(
      { orderId: dto.orderId, paymentMethod: dto.paymentMethod ?? null },
      { id: actor.id, username: actor.username },
    );
  }

  @Post("payments/:code/confirm")
  @RequirePermissions("finance.payment.write")
  async confirmPayment(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.payments.confirmPayment(code, { id: actor.id, username: actor.username });
  }

  @Post("payments/:code/fail")
  @RequirePermissions("finance.payment.write")
  async failPayment(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.payments.failPayment(code, { id: actor.id, username: actor.username });
  }

  @Post("payments/:code/cancel")
  @RequirePermissions("finance.payment.write")
  async cancelPayment(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.payments.cancelPayment(code, { id: actor.id, username: actor.username });
  }

  // ── Refund (Step 2.13 — provider-neutral Refund runtime) ───────────────────
  // Refund — Finance-owned aggregate (RFD-*). Source authority — CAPTURED
  // Payment (currency/orderId server-derived verbatim); amount server-validated
  // ≤ refundable (serialized over-refund protection). Клиент передаёт ТОЛЬКО
  // paymentId + amount + reason. PSP refund — future (2.13A+; здесь нет).

  @Get("refunds")
  @RequirePermissions("finance.refund.read")
  async listRefunds(@Query() query: RefundListQueryDto) {
    return this.refunds.list(query);
  }

  @Get("refunds/:code")
  @RequirePermissions("finance.refund.read")
  async getRefund(@Param("code") code: string) {
    return this.refunds.getByCode(code);
  }

  @Post("refunds")
  @RequirePermissions("finance.refund.write")
  async createRefund(@Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: CreateRefundDto) {
    // raw req.body — forged server-owned поля (money/status/milestones/...) → 422.
    assertNoForbiddenKeys(req.body, REFUND_CREATE_FORBIDDEN_KEYS);
    return this.refunds.createRefund(
      { paymentId: dto.paymentId, amount: dto.amount, reason: dto.reason ?? null },
      { id: actor.id, username: actor.username },
    );
  }

  @Post("refunds/:code/approve")
  @RequirePermissions("finance.refund.approve")
  async approveRefund(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.refunds.approveRefund(code, { id: actor.id, username: actor.username });
  }

  @Post("refunds/:code/process")
  @RequirePermissions("finance.refund.write")
  async processRefund(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.refunds.processRefund(code, { id: actor.id, username: actor.username });
  }

  @Post("refunds/:code/fail")
  @RequirePermissions("finance.refund.write")
  async failRefund(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.refunds.failRefund(code, { id: actor.id, username: actor.username });
  }

  // ── Dispute (Step 2.13A — provider-neutral Chargeback/Dispute Foundation) ──
  // Dispute — Finance-owned aggregate (DSP-*). Source authority — CAPTURED
  // Payment (currency/orderId server-derived verbatim; amount server-validated
  // ≤ payment.amount). Клиент передаёт ТОЛЬКО paymentId + amount + reason.
  // PSP/chargeback-from-provider — 2.12A/2.12B (здесь нет); won/lost
  // liability-исход и ledger/commission/settlement adjustments — deferred.

  @Get("disputes")
  @RequirePermissions("finance.dispute.read")
  async listDisputes(@Query() query: DisputeListQueryDto) {
    return this.disputes.list(query);
  }

  @Get("disputes/:code")
  @RequirePermissions("finance.dispute.read")
  async getDispute(@Param("code") code: string) {
    return this.disputes.getByCode(code);
  }

  @Post("disputes")
  @RequirePermissions("finance.dispute.write")
  async createDispute(@Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: CreateDisputeDto) {
    // raw req.body — forged server-owned поля (money/status/milestones/...) → 422.
    assertNoForbiddenKeys(req.body, DISPUTE_CREATE_FORBIDDEN_KEYS);
    return this.disputes.createDispute(
      { paymentId: dto.paymentId, amount: dto.amount, reason: dto.reason ?? null },
      { id: actor.id, username: actor.username },
    );
  }

  @Post("disputes/:code/resolve")
  @RequirePermissions("finance.dispute.write")
  async resolveDispute(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.disputes.resolveDispute(code, { id: actor.id, username: actor.username });
  }

  @Post("disputes/:code/cancel")
  @RequirePermissions("finance.dispute.write")
  async cancelDispute(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.disputes.cancelDispute(code, { id: actor.id, username: actor.username });
  }

  // ── CommissionPolicy (Step 2.14E — ADR-0013 Channel-Based Commission Rules) ─
  // Finance-owned mutable master data (CMP-*, единственный authority). Read —
  // finance.commission.read (ФАКТИЧЕСКИЙ ROLE_PERMISSIONS: FINANCE/DIRECTOR/
  // ANALYST; SALES_MANAGER commission.read НЕ имеет — строгий review fix);
  // manage — finance.commission.manage (FINANCE/ADMIN). V1: channel MARKETPLACE
  // only; rateType PERCENTAGE; lifecycle DRAFT → ACTIVE → ARCHIVED. 0 фактов.

  @Get("commission-policies")
  @RequirePermissions("finance.commission.read")
  async listCommissionPolicies(@Query() query: CommissionPolicyListQueryDto) {
    return this.commissionPolicies.list(query);
  }

  // NOTE: resolve MUST be declared before ":code" route (Nest order).
  @Get("commission-policies/resolve")
  @RequirePermissions("finance.commission.read")
  async resolveCommissionPolicy(@Query() query: ResolveCommissionPolicyQueryDto) {
    return this.commissionPolicies.resolve(query.channel, query.at);
  }

  @Get("commission-policies/:code")
  @RequirePermissions("finance.commission.read")
  async getCommissionPolicy(@Param("code") code: string) {
    return this.commissionPolicies.getByCode(code);
  }

  @Post("commission-policies")
  @RequirePermissions("finance.commission.manage")
  async createCommissionPolicy(@Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: CreateCommissionPolicyDto) {
    // raw req.body — forged server-owned поля (code/version/status/rateType/...) → 422.
    assertNoForbiddenKeys(req.body, COMMISSION_POLICY_FORBIDDEN_KEYS);
    return this.commissionPolicies.create(
      { channel: dto.channel, rate: dto.rate, effectiveFrom: dto.effectiveFrom, effectiveTo: dto.effectiveTo },
      { id: actor.id, username: actor.username },
    );
  }

  @Patch("commission-policies/:code")
  @RequirePermissions("finance.commission.manage")
  async updateCommissionPolicy(@Param("code") code: string, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: UpdateCommissionPolicyDto) {
    assertNoForbiddenKeys(req.body, COMMISSION_POLICY_FORBIDDEN_KEYS);
    return this.commissionPolicies.update(
      code,
      { rate: dto.rate, effectiveFrom: dto.effectiveFrom, effectiveTo: dto.effectiveTo },
      { id: actor.id, username: actor.username },
    );
  }

  @Post("commission-policies/:code/activate")
  @RequirePermissions("finance.commission.manage")
  async activateCommissionPolicy(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.commissionPolicies.activate(code, { id: actor.id, username: actor.username });
  }

  @Post("commission-policies/:code/archive")
  @RequirePermissions("finance.commission.manage")
  async archiveCommissionPolicy(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.commissionPolicies.archive(code, { id: actor.id, username: actor.username });
  }
}
