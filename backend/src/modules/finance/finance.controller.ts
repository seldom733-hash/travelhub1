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
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from 'express';
import { ExportService } from '../shared/export/export.service';
import { CommissionPolicyService } from "./commission-policy.service";
import { CommissionService } from "./commission.service";
import { DisputeService } from "./dispute.service";
import { FinanceService } from "./finance.service";
import { LedgerService } from "./ledger.service";
import { PaymentService } from "./payment.service";
import { RefundService } from "./refund.service";
import { SettlementService } from "./settlement.service";
import { SupplierFxRateService } from "./supplier-fx-rate.service";
import { SupplierObligationService } from "./supplier-obligation.service";
import { SupplierPaymentService } from "./supplier-payment.service";
import { SupplierPaymentEvidenceService } from "./supplier-payment-evidence.service";
import { SupplierDebtReportService } from "./supplier-debt-report.service";
import { SupplierPaymentTermsService } from "./supplier-payment-terms.service";
import { FinanceOverviewService } from "./finance-overview.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import { assertNoForbiddenKeys } from "../../shared/field-validation";
import { Idempotent } from "../../shared/idempotency/idempotency.decorator";
import {
  COMMISSION_POLICY_FORBIDDEN_KEYS,
  CommissionAccrualListQueryDto,
  CommissionListQueryDto,
  CommissionPolicyListQueryDto,
  CreateCommissionPolicyDto,
  CreateCurrencyDto,
  CreateDisputeDto,
  CreateExchangeRateDto,
  CreatePaymentDto,
  CreateRefundDto,
  CreateSupplierPayoutDto,
  CreateSupplierPaymentDto,
  CancelSupplierPaymentDto,
  SupplierPaymentAllocationDto,
  SupplierPaymentListQueryDto,
  UpdateObligationTermsDto,
  UpsertSupplierPaymentTermsDto,
  CreateTaxDto,
  CreateTaxRuleDto,
  AdjustObligationDto,
  CancelObligationDto,
  DISPUTE_CREATE_FORBIDDEN_KEYS,
  DisputeListQueryDto,
  FactListQueryDto,
  FINANCE_MASTER_FORBIDDEN_KEYS,
  FinanceOverviewQueryDto,
  LedgerListQueryDto,
  ObligationListQueryDto,
  PAYMENT_CREATE_FORBIDDEN_KEYS,
  PaymentListQueryDto,
  REFUND_CREATE_FORBIDDEN_KEYS,
  RefundListQueryDto,
  ResolveCommissionPolicyQueryDto,
  SetSupplierFxRateDto,
  SupplierFxRateHistoryQueryDto,
  SupplierFxRateListQueryDto,
  SupplierPayoutListQueryDto,
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
    private readonly commissions: CommissionService,
    private readonly fxRates: SupplierFxRateService,
    private readonly obligations: SupplierObligationService,
    private readonly supplierPayments: SupplierPaymentService,
    private readonly supplierEvidence: SupplierPaymentEvidenceService,
    private readonly supplierDebtReport: SupplierDebtReportService,
    private readonly supplierPaymentTerms: SupplierPaymentTermsService,
    private readonly overview: FinanceOverviewService,
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

  // ── SupplierFxRate (UNIFIED FINANCE CENTER Phase 1) ───────────────────────
  // supplier-specific «1 source = N AZN» (пара supplier × sourceCurrency).
  // Read — finance.fx_rate.read (текущие курсы + история); write —
  // finance.fx_rate.manage (upsert current + append-only history + audit).
  // AZN→AZN всегда 1 (строка не хранится, reject при set).
  // Изменение курса влияет только на будущее — frozen snapshot'ы не мутируют.

  @Get("supplier-fx-rates")
  @RequirePermissions("finance.fx_rate.read")
  async listSupplierFxRates(@Query() query: SupplierFxRateListQueryDto) {
    return this.fxRates.listCurrent({
      supplierCode: query.supplierCode,
      sourceCurrencyIso: query.sourceCurrencyIso,
    });
  }

  @Get("supplier-fx-rates/history")
  @RequirePermissions("finance.fx_rate.read")
  async listSupplierFxRateHistory(@Query() query: SupplierFxRateHistoryQueryDto) {
    return this.fxRates.listHistory(
      {
        code: query.code,
        supplierCode: query.supplierCode,
        sourceCurrencyIso: query.sourceCurrencyIso,
      },
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  // Supplier registry для FX-админки: единый список поставщиков (∪ уже
  // настроенные), НЕ выводится из строк — дропдаун не пустеет при 0 курсах.
  @Get("supplier-fx-rates/suppliers")
  @RequirePermissions("finance.fx_rate.read")
  async listSupplierFxRateSuppliers() {
    return this.fxRates.listSuppliers();
  }

  @Get("supplier-fx-rates/:code")
  @RequirePermissions("finance.fx_rate.read")
  async getSupplierFxRate(@Param("code") code: string) {
    return this.fxRates.getCurrentByCode(code);
  }

  @Post("supplier-fx-rates")
  @RequirePermissions("finance.fx_rate.manage")
  async setSupplierFxRate(@Req() req: Request, @Body() dto: SetSupplierFxRateDto, @CurrentUser() actor: { id: string; username: string }) {
    // targetCurrencyIso — server-owned (V1 API фиксирует AZN, расширение
    // storage не означает открытый API) → forged value 422, не тихий override.
    assertNoForbiddenKeys(req.body, [...FINANCE_MASTER_FORBIDDEN_KEYS, "targetCurrencyIso"]);
    return this.fxRates.setCurrent(dto, actor);
  }

  // ── SupplierObligation / SupplierPayout (UNIFIED FINANCE CENTER Phase 2) ──
  // Read обязательств — finance.obligation.read; read выплат —
  // finance.supplier_payout.read; частичная выплата/cancel/adjust —
  // finance.obligation.manage / finance.supplier_payout.manage (FINANCE/ADMIN).

  @Get("overview")
  @RequirePermissions("finance.overview.read")
  async getOverview(@Query() query: FinanceOverviewQueryDto) {
    return this.overview.getOverview({ from: query.from, to: query.to });
  }

  @Get("obligations")
  @RequirePermissions("finance.obligation.read")
  async listObligations(@Query() query: ObligationListQueryDto) {
    return this.obligations.listObligations(query);
  }

  @Get("obligations/export")
  @RequirePermissions("finance.obligation.read")
  async exportObligations(
    @Query() query: ObligationListQueryDto & { format?: string },
    @Res() res: Response,
  ) {
    const rows = await this.obligations.exportRows(query);
    const columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Supplier", key: "supplierCode", width: 16 },
      { header: "Partner", key: "partnerCode", width: 16 },
      { header: "Invoice", key: "invoiceNumber", width: 18 },
      { header: "Due date", key: "dueDate", width: 14 },
      { header: "Overdue", key: "overdue", width: 10 },
      { header: "Order", key: "orderCode", width: 16 },
      { header: "Booking", key: "bookingCode", width: 16 },
      { header: "Source amount", key: "sourceAmount", width: 16 },
      { header: "Source currency", key: "sourceCurrency", width: 10 },
      { header: "AZN", key: "aznAmount", width: 14 },
      { header: "Paid AZN", key: "paidAmount", width: 14 },
      { header: "Remaining AZN", key: "remainingAmount", width: 14 },
      { header: "Confirmed", key: "confirmedAt", width: 22 },
    ];
    return this.sendExport(res, "supplier_obligations", query.format, columns, rows);
  }

  @Get("supplier-payment-terms")
  @RequirePermissions("finance.obligation.read")
  async listSupplierPaymentTerms() {
    return this.supplierPaymentTerms.list();
  }

  @Put("supplier-payment-terms")
  @RequirePermissions("finance.obligation.manage")
  async upsertSupplierPaymentTerms(
    @Body() dto: UpsertSupplierPaymentTermsDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.supplierPaymentTerms.upsert(dto, actor);
  }

  @Get("reports/supplier-debt")
  @RequirePermissions("finance.obligation.read")
  async supplierDebtAsOf(
    @Query("asOf") asOf?: string,
    @Query("supplierCode") supplierCode?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.supplierDebtReport.getReport({
      asOf,
      supplierCode,
      search,
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });
  }

  @Get("reports/supplier-debt/export")
  @RequirePermissions("finance.obligation.read")
  async exportSupplierDebtAsOf(
    @Query("format") format: string | undefined,
    @Query("asOf") asOf: string | undefined,
    @Query("supplierCode") supplierCode: string | undefined,
    @Query("search") search: string | undefined,
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const rows = await this.supplierDebtReport.exportRows({ asOf, supplierCode, search });
    const columns = [
      { header: "As of", key: "asOf", width: 12 },
      { header: "Obligation", key: "obligationCode", width: 18 },
      { header: "Invoice", key: "invoiceNumber", width: 18 },
      { header: "Supplier", key: "supplierCode", width: 16 },
      { header: "Partner", key: "partnerCode", width: 16 },
      { header: "Order", key: "orderCode", width: 16 },
      { header: "Booking", key: "bookingCode", width: 16 },
      { header: "Source amount", key: "sourceAmount", width: 16 },
      { header: "Currency", key: "sourceCurrency", width: 8 },
      { header: "AZN", key: "aznAmount", width: 14 },
      { header: "Paid AZN", key: "paidAzn", width: 14 },
      { header: "Remaining AZN", key: "remainingAzn", width: 14 },
      { header: "Due date", key: "dueDate", width: 14 },
      { header: "Status", key: "status", width: 14 },
      { header: "Overdue", key: "overdue", width: 8 },
      { header: "Precision", key: "precision", width: 16 },
    ];
    await this.supplierDebtReport.auditExport(actor, asOf ?? "today", { supplierCode: supplierCode ?? null, search: search ?? null });
    return this.sendExport(res, "supplier_debt_as_of", format, columns, rows);
  }

  @Get("obligations/:code")
  @RequirePermissions("finance.obligation.read")
  async getObligation(@Param("code") code: string) {
    return this.obligations.getObligation(code);
  }

  @Post("obligations/:code/payouts")
  @RequirePermissions("finance.supplier_payout.manage")
  async createObligationPayout(
    @Param("code") code: string,
    @Req() req: Request,
    @Body() dto: CreateSupplierPayoutDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    assertNoForbiddenKeys(req.body, [...FINANCE_MASTER_FORBIDDEN_KEYS, "obligationCode"]);
    return this.obligations.createPayout({ ...dto, obligationCode: code }, actor);
  }

  @Post("obligations/:code/cancel")
  @HttpCode(200)
  @RequirePermissions("finance.obligation.manage")
  async cancelObligation(
    @Param("code") code: string,
    @Body() dto: CancelObligationDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.obligations.cancelObligation(code, dto.reason ?? null, actor);
  }

  @Post("obligations/:code/adjust")
  @HttpCode(200)
  @RequirePermissions("finance.obligation.manage")
  async adjustObligation(
    @Param("code") code: string,
    @Req() req: Request,
    @Body() dto: AdjustObligationDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    assertNoForbiddenKeys(req.body, [...FINANCE_MASTER_FORBIDDEN_KEYS, "obligationCode"]);
    return this.obligations.adjustObligation(
      code,
      { newAznAmount: dto.newAznAmount, newSourceAmount: dto.newSourceAmount, reason: dto.reason ?? null },
      actor,
    );
  }

  @Get("payouts")
  @RequirePermissions("finance.supplier_payout.read")
  async listSupplierPayouts(@Query() query: SupplierPayoutListQueryDto) {
    return this.obligations.listPayouts(query);
  }

  // ── Supplier payments registry (Finance completion) ─────────────────────────
  // read — finance.supplier_payout.read; регистрация/распределение/отмена —
  // finance.supplier_payout.manage; подтверждение исполнения — отдельное
  // finance.supplier_payment.confirm (PENDING → CONFIRMED).

  @Patch("obligations/:code")
  @RequirePermissions("finance.obligation.manage")
  async updateObligationTerms(
    @Param("code") code: string,
    @Body() dto: UpdateObligationTermsDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.obligations.updateTerms(
      code,
      { dueDate: dto.dueDate, invoiceNumber: dto.invoiceNumber, reason: dto.reason ?? null },
      actor,
    );
  }

  @Get("obligations/:code/history")
  @RequirePermissions("finance.obligation.read")
  async getObligationHistory(@Param("code") code: string) {
    return this.obligations.getHistory(code);
  }

  @Get("supplier-payments")
  @RequirePermissions("finance.supplier_payout.read")
  async listSupplierPayments(@Query() query: SupplierPaymentListQueryDto) {
    return this.supplierPayments.list(query);
  }

  @Get("supplier-payments/export")
  @RequirePermissions("finance.supplier_payout.read")
  async exportSupplierPayments(
    @Query() query: SupplierPaymentListQueryDto & { format?: string },
    @Res() res: Response,
  ) {
    const rows = await this.supplierPayments.exportRows(query);
    const columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Status", key: "status", width: 12 },
      { header: "Supplier", key: "supplierCode", width: 16 },
      { header: "Partner", key: "partnerCode", width: 16 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "Currency", key: "currency", width: 8 },
      { header: "AZN", key: "aznAmount", width: 14 },
      { header: "Allocated AZN", key: "allocatedAzn", width: 14 },
      { header: "Unallocated AZN", key: "unallocatedAzn", width: 14 },
      { header: "Unallocated reason", key: "unallocatedReason", width: 18 },
      { header: "Method", key: "method", width: 14 },
      { header: "Bank reference", key: "providerRef", width: 22 },
      { header: "Purpose", key: "purpose", width: 30 },
      { header: "Obligations", key: "obligations", width: 30 },
      { header: "Occurred", key: "occurredAt", width: 22 },
      { header: "Confirmed", key: "confirmedAt", width: 22 },
      { header: "Cancelled", key: "cancelledAt", width: 22 },
    ];
    return this.sendExport(res, "supplier_payments", query.format, columns, rows);
  }

  @Get("supplier-payments/:code")
  @RequirePermissions("finance.supplier_payout.read")
  async getSupplierPayment(@Param("code") code: string) {
    return this.supplierPayments.getByCodeOrId(code);
  }

  @Get("supplier-payments/:code/documents")
  @RequirePermissions("finance.supplier_payout.read")
  async listSupplierPaymentDocuments(@Param("code") code: string) {
    return this.supplierEvidence.list(code);
  }

  @Post("supplier-payments/:code/documents")
  @RequirePermissions("finance.supplier_payout.manage")
  @UseInterceptors(FilesInterceptor("files", 5, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadSupplierPaymentDocuments(
    @Param("code") code: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.supplierEvidence.upload(code, files ?? [], actor);
  }

  @Get("supplier-payments/:code/documents/:documentId/download")
  @RequirePermissions("finance.supplier_payout.read")
  async downloadSupplierPaymentDocument(
    @Param("code") code: string,
    @Param("documentId") documentId: string,
  ) {
    return this.supplierEvidence.download(code, documentId);
  }

  @Delete("supplier-payments/:code/documents/:documentId")
  @RequirePermissions("finance.supplier_payout.manage")
  async deleteSupplierPaymentDocument(
    @Param("code") code: string,
    @Param("documentId") documentId: string,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.supplierEvidence.remove(code, documentId, actor);
  }

  @Get("supplier-payments/:code/history")
  @RequirePermissions("finance.supplier_payout.read")
  async getSupplierPaymentHistory(@Param("code") code: string) {
    return this.supplierPayments.getHistory(code);
  }

  @Post("supplier-payments")
  @RequirePermissions("finance.supplier_payout.manage")
  @Idempotent("supplier_payment.create")
  async createSupplierPayment(
    @Req() req: AuthedRequest,
    @Body() dto: CreateSupplierPaymentDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    assertNoForbiddenKeys(req.body, FINANCE_MASTER_FORBIDDEN_KEYS);
    return this.supplierPayments.create(dto, actor, req.idempotencySlotKey ?? null);
  }

  @Post("supplier-payments/:code/confirm")
  @HttpCode(200)
  @RequirePermissions("finance.supplier_payment.confirm")
  async confirmSupplierPayment(
    @Param("code") code: string,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.supplierPayments.confirm(code, actor);
  }

  @Post("supplier-payments/:code/allocations")
  @HttpCode(200)
  @RequirePermissions("finance.supplier_payout.manage")
  async allocateSupplierPayment(
    @Param("code") code: string,
    @Body() dto: SupplierPaymentAllocationDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.supplierPayments.allocate(code, dto, actor);
  }

  @Post("supplier-payments/:code/cancel")
  @HttpCode(200)
  @RequirePermissions("finance.supplier_payout.manage")
  async cancelSupplierPayment(
    @Param("code") code: string,
    @Body() dto: CancelSupplierPaymentDto,
    @CurrentUser() actor: { id: string; username: string },
  ) {
    return this.supplierPayments.cancel(code, dto.reason ?? null, actor);
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

  @Get("payments/export")
  @RequirePermissions("finance.payment.read")
  async exportPayments(
    @Query() query: PaymentListQueryDto & { format?: string },
    @CurrentUser() actor: AuthedRequest["user"],
    @Res() res: Response,
  ) {
    const format = query.format || 'csv';
    const { rows } = await this.payments.exportPayments({
      orderId: query.orderId,
      status: query.status,
      paymentStatus: query.paymentStatus,
      refundStatus: query.refundStatus,
      search: query.search,
      currency: query.currency,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      acquisitionSource: query.acquisitionSource,
      dateField: query.dateField,
    });
    const columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Code', key: 'code', width: 22 },
      { header: 'Reference', key: 'referenceNumber', width: 22 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
      { header: 'paidAt', key: 'paidAt', width: 22 },
      { header: 'Order ID', key: 'orderId', width: 38 },
      { header: 'Order Code', key: 'orderCode', width: 22 },
      { header: 'Order Reference', key: 'orderReference', width: 22 },
      { header: 'Partner ID', key: 'partnerId', width: 38 },
      { header: 'Partner Code', key: 'partnerCode', width: 16 },
      { header: 'Partner Name', key: 'partnerName', width: 28 },
      { header: 'Customer ID', key: 'customerId', width: 38 },
      { header: 'Customer Code', key: 'customerCode', width: 16 },
      { header: 'Customer Name', key: 'customerName', width: 28 },
    ];
    const svc = new ExportService();
    if (format === 'xlsx') {
      const buf = await svc.toXlsx(columns, rows, 'Payments');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="payments_export.xlsx"`);
      return res.send(buf);
    }
    const csv = svc.toCsv(columns, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payments_export.csv"`);
    return res.send(csv);
  }

  @Get("payments/:code")
  @RequirePermissions("finance.payment.read")
  async getPayment(@Param("code") code: string) {
    return this.payments.getByCode(code);
  }

  @Post("payments")
  @RequirePermissions("finance.payment.create")
  // Step 2.12H: payment-initiation boundary — защищённая операция (external
  // Idempotency-Key обязателен; retry/replay/divergent — контракт 2.12H).
  @Idempotent("payment.create")
  async createPayment(@Req() req: AuthedRequest, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: CreatePaymentDto) {
    // raw req.body — forged server-owned поля (money/status/milestones/...) → 422.
    assertNoForbiddenKeys(req.body, PAYMENT_CREATE_FORBIDDEN_KEYS);
    return this.payments.createPayment(
      { orderId: dto.orderId, amount: dto.amount ?? null, paymentMethod: dto.paymentMethod ?? null, reason: dto.reason ?? null, initialNote: dto.initialNote },
      { id: actor.id, username: actor.username },
      // SlotKey ставит ТОЛЬКО IdempotencyInterceptor (server-owned) — бизнес-
      // идемпотентность payment.create (MULTI/PARTIAL §13 / 2.12H window 3).
      req.idempotencySlotKey ?? null,
    );
  }

  @Post("payments/:code/confirm")
  @RequirePermissions("finance.payment.manage")
  async confirmPayment(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.payments.confirmPayment(code, { id: actor.id, username: actor.username });
  }

  @Post("payments/:code/fail")
  @RequirePermissions("finance.payment.manage")
  async failPayment(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.payments.failPayment(code, { id: actor.id, username: actor.username });
  }

  @Post("payments/:code/cancel")
  @RequirePermissions("finance.payment.manage")
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
      { paymentId: dto.paymentId, amount: dto.amount, reason: dto.reason ?? null, initialNote: dto.initialNote },
      { id: actor.id, username: actor.username },
    );
  }

  @Post("refunds/:code/approve")
  @RequirePermissions("finance.refund.approve")
  async approveRefund(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.refunds.approveRefund(code, { id: actor.id, username: actor.username });
  }

  @Post("refunds/:code/process")
  @RequirePermissions("finance.refund.execute")
  async processRefund(@Param("code") code: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.refunds.processRefund(code, { id: actor.id, username: actor.username });
  }

  @Post("refunds/:code/fail")
  @RequirePermissions("finance.refund.execute")
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

  // ── Commission facts / CommissionAccrual read (Step 2.12E, PARTNER_COLLECT) ─
  // Immutable финансовые факты (producer — CommissionAccrualConsumer на
  // OrderCreated). Read: finance.commission.read (FINANCE/DIRECTOR/ANALYST);
  // mutation API отсутствует (immutable; status-переходы — future шаги).

  @Get("commissions")
  @RequirePermissions("finance.commission.read")
  async listCommissions(@Query() query: CommissionListQueryDto) {
    return this.commissions.listCommissions(query);
  }

  @Get("commissions/:code")
  @RequirePermissions("finance.commission.read")
  async getCommission(@Param("code") code: string) {
    return this.commissions.getCommissionByCode(code);
  }

  @Get("commission-accruals")
  @RequirePermissions("finance.commission.read")
  async listCommissionAccruals(@Query() query: CommissionAccrualListQueryDto) {
    return this.commissions.listAccruals(query);
  }

  @Get("commission-accruals/:code")
  @RequirePermissions("finance.commission.read")
  async getCommissionAccrual(@Param("code") code: string) {
    return this.commissions.getAccrualByCode(code);
  }

  /** Единый CSV/XLSX-ответ для реестров Finance (supplier obligations/payments). */
  private async sendExport(
    res: Response,
    filename: string,
    format: string | undefined,
    columns: Array<{ header: string; key: string; width: number }>,
    rows: Array<Record<string, string | null>>,
  ): Promise<Response> {
    const svc = new ExportService();
    if ((format ?? "csv") === "xlsx") {
      const buf = await svc.toXlsx(columns, rows, filename);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
      return res.send(buf);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(svc.toCsv(columns, rows));
  }
}
