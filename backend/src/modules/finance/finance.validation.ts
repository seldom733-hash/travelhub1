/**
 * PHASE 2 STEP 2.10 — Finance master-data validation (Currency/ExchangeRate/Tax/TaxRule).
 *
 * Step 2.10 — Finance Domain FOUNDATION: только master data CRUD (Finance Center
 * экраны Currency/Exchange Rates/Tax/Tax Rules, Screen Design §7). Payment/
 * Refund/Invoice/Commission/... создание НЕ реализуется (§15/§52) — агрегатные
 * модели существуют в схеме, но клиентские write-пути отсутствуют.
 *
 * Mass-assignment: server-owned поля (id/code/createdAt/updatedAt/version)
 * запрещены громко (422, project convention loud-forbidden-key) — не silent strip.
 */
import { IsBoolean, IsEnum, IsISO8601, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, MinLength, ValidateIf } from "class-validator";
import { Type } from "class-transformer";
import { ValidationDomainError } from "../../shared/errors";
import { Prisma } from "../../generated/prisma/client";
import { CommissionAccrualStatus, CommissionChannel, CommissionStatus } from "../../generated/prisma/enums";

/** Запрещённые server-owned поля для всех Finance master-data write DTO. */
export const FINANCE_MASTER_FORBIDDEN_KEYS = [
  "id",
  "code",
  "createdAt",
  "updatedAt",
  "version",
] as const;

/** ISO 4217 (валюта): ровно 3 заглавные латинские буквы. */
const ISO_CODE_RE = /^[A-Z]{3}$/;

/** ISO 3166-1 alpha-2 (страна): ровно 2 заглавные латинские буквы (AZ, RU, ...).
 *  Не путать с валютными кодами (USD) и НЕ с locale-строками (ru/az/en). */
const COUNTRY_ISO_RE = /^[A-Z]{2}$/;

function assertIsoCode(iso: string, label: string): void {
  if (!ISO_CODE_RE.test(iso)) {
    throw new ValidationDomainError(`${label} must be a 3-letter ISO 4217 code (e.g. USD, AZN, EUR)`);
  }
}

function assertCountryIso(iso: string, label: string): void {
  if (!COUNTRY_ISO_RE.test(iso)) {
    throw new ValidationDomainError(`${label} must be a 2-letter ISO 3166-1 alpha-2 country code (e.g. AZ, RU)`);
  }
}

// ── Currency ──────────────────────────────────────────────────────────────────

export class CreateCurrencyDto {
  @IsString()
  @Length(3, 3)
  isoCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8)
  symbol!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  decimals?: number;
}

/** Update: частичное обновление, isoCode неизменяем (canonical ключ). */
export class UpdateCurrencyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  symbol?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  decimals?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── ExchangeRate ──────────────────────────────────────────────────────────────

export class CreateExchangeRateDto {
  @IsString()
  @Length(3, 3)
  baseCurrencyIso!: string;

  @IsString()
  @Length(3, 3)
  quoteCurrencyIso!: string;

  @IsString()
  rate!: string;

  @IsISO8601()
  validFrom!: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;
}

export class UpdateExchangeRateDto {
  @IsOptional()
  @IsString()
  rate?: string;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Tax ──────────────────────────────────────────────────────────────────────

export class CreateTaxDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /** Ставка как строка Decimal (12,2), half-up; >= 0. */
  @IsString()
  rate!: string;

  @IsOptional()
  @ValidateIf((o: CreateTaxDto) => o.countryIso !== undefined)
  @IsString()
  @Length(2, 2)
  countryIso?: string;
}

export class UpdateTaxDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  rate?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryIso?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── TaxRule ──────────────────────────────────────────────────────────────────

export class CreateTaxRuleDto {
  /** Ссылка на Tax (без FK; валидируется сервисом read-by-ID). */
  @IsString()
  @MinLength(1)
  taxId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  productType?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryIso?: string;

  @IsISO8601()
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;
}

export class UpdateTaxRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  productType?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryIso?: string;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Pure validators (unit-testable) ───────────────────────────────────────────

/** Валидация ISO 4217 (3 заглавные). */
export function validateIsoCode(iso: string, label = "isoCode"): string {
  assertIsoCode(iso, label);
  return iso;
}

/** Валидация ISO 3166-1 alpha-2 country code (2 заглавные; locale не является страной). */
export function validateCountryIso(iso: string, label = "countryIso"): string {
  assertCountryIso(iso, label);
  return iso;
}

/** Валидация rate «1 base = rate quote»: > 0, до 6 знаков после запятой. */
export function validateRate(rate: string): string {
  const d = Number(rate);
  if (!Number.isFinite(d) || d <= 0) {
    throw new ValidationDomainError("rate must be a positive decimal number");
  }
  const parts = rate.split(".");
  if (parts.length === 2 && parts[1].length > 6) {
    throw new ValidationDomainError("rate supports at most 6 decimal places");
  }
  return rate;
}

/**
 * Step 2.10A — Ledger: валидация immutable amount (> 0, до 2 знаков,
 * DECIMAL(12,2) платформенный money-контракт). Строковый Decimal, без float.
 * Экономический смысл несёт type (не знак суммы).
 */
export function validateLedgerAmount(amount: string): string {
  const d = Number(amount);
  if (!Number.isFinite(d) || d <= 0) {
    throw new ValidationDomainError("ledger amount must be a positive decimal number");
  }
  const parts = amount.split(".");
  if (parts.length === 2 && parts[1].length > 2) {
    throw new ValidationDomainError("ledger amount supports at most 2 decimal places (DECIMAL(12,2) contract)");
  }
  return amount;
}

/**
 * Step 2.10C — Ledger occurredAt: business occurrence time (UTC instant).
 * NULL/undefined → NULL (неизвестное время наступления; без fabrication).
 *
 * STRICT REVIEW FIX (2.10C): голый Date.parse принимает locale/TZ-зависимые
 * форматы ("08/14/2026", "August 14, 2026", "2026-08-14 10:00:00"), которые
 * интерпретируются в ЛОКАЛЬНОМ TZ сервера (разные инстанты на разных машинах),
 * date-only ("2026-08-14" → выдуманная полночь UTC) и даже молча НОРМАЛИЗУЕТ
 * невозможные даты ("2026-02-30" → 2026-03-02). Для authoritative бизнес-
 * времени это недопустимо: контракт — UTC ISO 8601 instant. Поэтому:
 *  1) строгий структурный regex (только полный datetime + Z/±HH:MM(±HHMM));
 *  2) Date.parse отклоняет range-невозможное (month 13, hour 25, minute 60,
 *     offset +25:00);
 *  3) round-trip проверка: локальные компоненты (offset применён обратно)
 *     обязаны совпадать с написанными — невозможные календарные даты
 *     (Feb 30, Apr 31) никогда не становятся authority.
 * Malformed/impossible → ValidationDomainError. Отдельно от createdAt.
 */
const ISO_8601_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/;

function parseOffsetMinutes(offset: string): number {
  if (offset === "Z") return 0;
  const sign = offset[0] === "-" ? -1 : 1;
  const h = Number(offset.slice(1, 3));
  const m = Number(offset.slice(4, 6)); // "+0200" и "+02:00" → минуты с индекса 4
  return sign * (h * 60 + m);
}

export function validateOccurredAt(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new ValidationDomainError("occurredAt must be a valid ISO 8601 datetime (UTC)");
  }
  const m = ISO_8601_DATETIME_RE.exec(value);
  if (!m) {
    throw new ValidationDomainError("occurredAt must be a valid ISO 8601 datetime (UTC)");
  }
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) {
    throw new ValidationDomainError("occurredAt must be a valid ISO 8601 datetime (UTC)");
  }
  // Round-trip: UTC instant + записанный offset → локальные компоненты ввода.
  // Расхождение = невозможная календарная дата, молча нормализованная Date.parse.
  const d = new Date(ts);
  const local = new Date(ts + parseOffsetMinutes(m[8]) * 60000);
  const ok =
    local.getUTCFullYear() === Number(m[1]) &&
    local.getUTCMonth() + 1 === Number(m[2]) &&
    local.getUTCDate() === Number(m[3]) &&
    local.getUTCHours() === Number(m[4]) &&
    local.getUTCMinutes() === Number(m[5]) &&
    local.getUTCSeconds() === Number(m[6]);
  if (!ok) {
    throw new ValidationDomainError("occurredAt must be a valid ISO 8601 datetime (UTC)");
  }
  return d;
}

/**
 * Step 2.13 — Refund amount: > 0, до 2 знаков (DECIMAL(12,2) контракт),
 * строковый Decimal без float. Server-validated (клиент запрашивает сумму,
 * сервер валидирует ≤ refundable отдельно — capacity guard в RefundService).
 */
export function validateRefundAmount(amount: string): string {
  if (typeof amount !== "string" || amount.trim().length === 0) {
    throw new ValidationDomainError("refund amount must be a positive decimal number");
  }
  const d = Number(amount);
  if (!Number.isFinite(d) || d <= 0) {
    throw new ValidationDomainError("refund amount must be a positive decimal number");
  }
  const parts = amount.split(".");
  if (parts.length === 2 && parts[1].length > 2) {
    throw new ValidationDomainError("refund amount supports at most 2 decimal places (DECIMAL(12,2) contract)");
  }
  return amount;
}

/**
 * Step 2.13A — Dispute amount: > 0, до 2 знаков (DECIMAL(12,2) контракт),
 * строковый Decimal без float. Server-validated (клиент запрашивает сумму,
 * сервер валидирует ≤ payment.amount отдельно — capacity guard в
 * DisputeService; НЕ netting с Refund — monetary netting deferred).
 */
export function validateDisputeAmount(amount: string): string {
  if (typeof amount !== "string" || amount.trim().length === 0) {
    throw new ValidationDomainError("dispute amount must be a positive decimal number");
  }
  const d = Number(amount);
  if (!Number.isFinite(d) || d <= 0) {
    throw new ValidationDomainError("dispute amount must be a positive decimal number");
  }
  const parts = amount.split(".");
  if (parts.length === 2 && parts[1].length > 2) {
    throw new ValidationDomainError("dispute amount supports at most 2 decimal places (DECIMAL(12,2) contract)");
  }
  return amount;
}

/** Валидация налоговой ставки: >= 0, до 2 знаков (DECIMAL(12,2) контракт). */
export function validateTaxRate(rate: string): string {
  const d = Number(rate);
  if (!Number.isFinite(d) || d < 0) {
    throw new ValidationDomainError("rate must be a non-negative decimal number");
  }
  const parts = rate.split(".");
  if (parts.length === 2 && parts[1].length > 2) {
    throw new ValidationDomainError("tax rate supports at most 2 decimal places");
  }
  return rate;
}

/** Whitelist-query для чтения фактов 2.10B (ProviderFee/Settlement/Payout). */
export class FactListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Whitelist-query для чтения Ledger (Finance Center ledger view). */
export class LedgerListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Дата «до» должна быть позже даты «с». */
export function assertValidRange(validFrom: string, validTo: string | undefined, label = "period"): void {
  if (validTo !== undefined && new Date(validTo) <= new Date(validFrom)) {
    throw new ValidationDomainError(`${label}: validTo must be after validFrom`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2.12 — Payment Flow (provider-neutral Payment runtime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server-owned Payment поля — громкий 422 при forged-вводе (mass assignment
 * HARD GATE §32): id/code/status/amount/currency/customerId/partnerId/
 * milestones/version/timestamps/providerRef/isActivePayment. Клиент передаёт
 * ТОЛЬКО orderId (+ опциональный paymentMethod) — деньги и статус серверные.
 */
export const PAYMENT_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "status",
  "amount",
  "currency",
  "customerId",
  "partnerId",
  "providerRef",
  "version",
  "createdAt",
  "updatedAt",
  "paidAt",
  "failedAt",
  "cancelledAt",
  "isActivePayment",
] as const;

/** Create Payment: orderId обязателен; paymentMethod — опциональный descriptive
 *  label (manual/provider-neutral, ≤64, без PII/секретов; НЕ authority). */
export class CreatePaymentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  orderId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  paymentMethod?: string;
}

/** Whitelist-query для чтения Payment (Finance Center). */
export class PaymentListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2.13 — Refund Flow (provider-neutral Refund runtime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server-owned Refund поля — громкий 422 при forged-вводе (mass assignment
 * HARD GATE §35): id/code/status/currency/orderId/version/milestones/
 * timestamps/isActiveRefund. Клиент передаёт ТОЛЬКО paymentId + amount
 * (server-validated ≤ refundable) + опциональный reason. orderId server-derived
 * из Payment; currency server-copied verbatim из Payment.
 */
export const REFUND_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "status",
  "currency",
  "orderId",
  "customerId",
  "version",
  "createdAt",
  "updatedAt",
  "requestedAt",
  "approvedAt",
  "processedAt",
  "failedAt",
  "isActiveRefund",
  "providerRef",
] as const;

/** Create Refund: paymentId (CAPTURED Payment — source authority) + amount
 *  (Decimal string, > 0, ≤ 2 знаков, server-validated ≤ refundable) + reason
 *  (descriptive, без PII). */
export class CreateRefundDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  paymentId!: string;

  /** Decimal string (как validateLedgerAmount контракт): > 0, ≤ 2 знаков. */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  amount!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2.13A — Chargeback / Dispute Foundation (provider-neutral)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server-owned Dispute поля — громкий 422 при forged-вводе (mass assignment
 * HARD GATE §20): id/code/status/currency/orderId/version/milestones/
 * timestamps/isActiveDispute. Клиент передаёт ТОЛЬКО paymentId + amount
 * (server-validated ≤ payment.amount) + опциональный reason. orderId
 * server-derived из Payment; currency server-copied verbatim из Payment.
 */
export const DISPUTE_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "status",
  "currency",
  "orderId",
  "customerId",
  "version",
  "createdAt",
  "updatedAt",
  "openedAt",
  "resolvedAt",
  "cancelledAt",
  "isActiveDispute",
  "providerRef",
] as const;

/** Create Dispute: paymentId (CAPTURED Payment — source authority) + amount
 *  (Decimal string, > 0, ≤ 2 знаков, server-validated ≤ payment.amount) +
 *  reason (descriptive, без PII). */
export class CreateDisputeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  paymentId!: string;

  /** Decimal string (как validateRefundAmount контракт): > 0, ≤ 2 знаков. */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  amount!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason?: string;
}

/** Whitelist-query для чтения Dispute (Finance Center). */
export class DisputeListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Whitelist-query для чтения Refund (Finance Center). */
export class RefundListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2.14E — Channel-Based Commission Rules Foundation (ADR-0013)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server-owned CommissionPolicy поля — громкий 422 при forged-вводе (mass
 * assignment HARD GATE §15): id/code/version/createdAt/updatedAt/status/
 * rateType (server-derived, V1 = PERCENTAGE)/audit-поля. Клиент передаёт ТОЛЬКО
 * channel + rate + effectiveFrom/effectiveTo.
 */
export const COMMISSION_POLICY_FORBIDDEN_KEYS = [
  "id",
  "code",
  "version",
  "createdAt",
  "updatedAt",
  "status",
  "rateType",
  "actorId",
  "actorName",
  "correlationId",
  "causationId",
];

/**
 * Валидация commission rate (ADR-0013 D3/D5, §8): десятичная ДОЛЯ, 0 < rate < 1
 * (0.15 = 15%). Representation документирован: «10» НЕ валиден (10 ≥ 1) —
 * только 0.10. Точность ≤ 6 знаков (DECIMAL(18,6), прецедент ExchangeRate —
 * rate ≠ amount). Строковый Decimal, без JS float authority.
 */
export function validateCommissionRate(rate: string): string {
  // Каноническая форма — десятичная ДОЛЯ «0.dddddd», 1–6 знаков, не все нули:
  //   /^0\.(?!0+$)\d{1,6}$/
  // Regex-authority без JS float arithmetic. Исключает:
  //  - научную нотацию («1e-7» = 0.0000001 → Postgres DECIMAL(18,6) округляет
  //    до 0.000000 — молчаливая 0%-policy; строгий review fix 2.14E),
  //  - whitespace (« 0.15 » → Prisma.Decimal бросает DecimalError → raw 500),
  //  - «10»/«15»/«1» (≥ 1 — percent-ambiguitiy), «0»/«0.0»/«0.000000» (= 0),
  //  - «-0.05», «+0.15», «.15», «0,15», NaN/Infinity/malformed.
  if (typeof rate !== "string" || !/^0\.(?!0+$)\d{1,6}$/.test(rate)) {
    throw new ValidationDomainError("commission rate must be a positive decimal fraction in (0, 1) with at most 6 decimal places — canonical form 0.15 = 15% (scientific notation, percent-as-number and whitespace are rejected)");
  }
  return rate;
}

/**
 * Проверка channel-значения: член vocabulary CommissionChannel (D15).
 * Неизвестные значения → ValidationDomainError (400).
 */
export function validateCommissionChannel(channel: string): string {
  const values = Object.values(CommissionChannel);
  if (!values.includes(channel as CommissionChannel)) {
    throw new ValidationDomainError(`commission channel must be one of: ${values.join(", ")}`);
  }
  return channel;
}

/**
 * V1 create-гейт (ADR-0013 D15/D2): commission policy можно создать ТОЛЬКО для
 * MARKETPLACE. PARTNER_STOREFRONT (SaaS, ADR-0006) / DIRECT / BUYER_REQUEST —
 * no-commission каналы: generic CRUD НЕ должен случайно дать им policy (T6).
 */
export function assertCommissionPolicyCreateChannel(channel: string): void {
  if (channel !== CommissionChannel.MARKETPLACE) {
    throw new ValidationDomainError("V1 commission policy creation is allowed only for channel MARKETPLACE (no-commission channels: PARTNER_STOREFRONT/DIRECT/BUYER_REQUEST)");
  }
}

/** Create CommissionPolicy: channel + rate (доля) + effectiveFrom/effectiveTo. */
export class CreateCommissionPolicyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  channel!: string;

  /** Decimal-строка (validateCommissionRate): доля 0 < rate < 1, ≤ 6 знаков. */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  rate!: string;

  @IsISO8601()
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;
}

/** Update CommissionPolicy (ТОЛЬКО в DRAFT; version инкремент server-side). */
export class UpdateCommissionPolicyDto {
  /** Decimal-строка (validateCommissionRate). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  rate?: string;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  /** null = open-ended (убрать effectiveTo). */
  @IsOptional()
  @ValidateIf((o) => o.effectiveTo !== null)
  @IsISO8601()
  effectiveTo?: string | null;
}

/** Whitelist-list-query для CommissionPolicy (канал/статус/пагинация). */
export class CommissionPolicyListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Resolution-query: channel + business instant (UTC ISO 8601). */
export class ResolveCommissionPolicyQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  channel!: string;

  @IsISO8601()
  at!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2.12E — PARTNER_COLLECT / CommissionAccrual Foundation (ADR-0013 D7/D9)
// ─────────────────────────────────────────────────────────────────────────────

/** Каноническая форма frozen commission snapshot (ADR-0013 D7). */
export interface CommissionSnapshotShape {
  policyCode: string;
  policyVersion: number;
  rateType: string;
  rate: string;
  baseAmount: string;
  baseCurrency: string;
  channel: string;
  sellerPartnerId: string | null;
  selectedAt: string;
  roundingContractVersion: string;
}

/**
 * Валидация frozen commission snapshot (производится Finance producer-ом при
 * признании accrual — единый authority; snapshot заморожен на Quote ISSUE и
 * перенесён verbatim, НЕ пере-резолвится). Fail-closed: любая несостыковка
 * формы/rate/base → ValidationDomainError (событие FAILED, а не молчаливый
 * 0-факт). rate — каноническая форма validateCommissionRate (0<r<1, ≤6 знаков).
 */
export function validateCommissionSnapshot(snapshot: unknown): CommissionSnapshotShape {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new ValidationDomainError("commissionSnapshot must be an object");
  }
  const s = snapshot as Record<string, unknown>;
  const needString = ["policyCode", "rateType", "rate", "baseAmount", "baseCurrency", "channel", "selectedAt", "roundingContractVersion"] as const;
  for (const f of needString) {
    if (typeof s[f] !== "string" || (s[f] as string).trim().length === 0) {
      throw new ValidationDomainError(`commissionSnapshot is missing ${f}`);
    }
  }
  // selectedAt = freeze instant (ISO 8601). Malformed → fail-loud (коррупция
  // authoritative snapshot; НЕ молчаливый факт с битым provenance, STRICT REVIEW).
  if (typeof s.selectedAt !== "string" || !Number.isFinite(Date.parse(s.selectedAt))) {
    throw new ValidationDomainError("commissionSnapshot selectedAt must be a valid ISO 8601 instant");
  }
  if (typeof s.policyVersion !== "number" || !Number.isInteger(s.policyVersion) || (s.policyVersion as number) < 1) {
    throw new ValidationDomainError("commissionSnapshot policyVersion must be a positive integer");
  }
  if (s.sellerPartnerId !== null && s.sellerPartnerId !== undefined && (typeof s.sellerPartnerId !== "string" || (s.sellerPartnerId as string).trim().length === 0)) {
    throw new ValidationDomainError("commissionSnapshot sellerPartnerId is invalid");
  }
  if (typeof s.rate !== "string") {
    throw new ValidationDomainError("commissionSnapshot rate is invalid");
  }
  validateCommissionRate(s.rate); // 0 < rate < 1, ≤ 6 знаков, каноническая форма
  if (typeof s.baseAmount !== "string") {
    throw new ValidationDomainError("commissionSnapshot baseAmount is invalid");
  }
  let base: Prisma.Decimal;
  try {
    base = new Prisma.Decimal(s.baseAmount);
  } catch {
    throw new ValidationDomainError("commissionSnapshot baseAmount is not a valid amount");
  }
  if (base.isNegative()) {
    throw new ValidationDomainError("commissionSnapshot baseAmount must be >= 0");
  }
  if (s.channel !== CommissionChannel.MARKETPLACE) {
    throw new ValidationDomainError(`commissionSnapshot channel ${String(s.channel)} is not commission-bearing in V1`);
  }
  return {
    policyCode: s.policyCode as string,
    policyVersion: s.policyVersion as number,
    rateType: s.rateType as string,
    rate: s.rate as string,
    baseAmount: s.baseAmount as string,
    baseCurrency: s.baseCurrency as string,
    channel: s.channel as string,
    sellerPartnerId: (s.sellerPartnerId as string | null) ?? null,
    selectedAt: s.selectedAt as string,
    roundingContractVersion: s.roundingContractVersion as string,
  };
}

/** Whitelist list-query для Commission фактов (status/orderId/partnerId/пагинация).
 *  status — строго валидный CommissionStatus (invalid → 400, НЕ raw 500). */
export class CommissionListQueryDto {
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  partnerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Whitelist list-query для CommissionAccrual (status/partnerId/пагинация).
 *  status — строго валидный CommissionAccrualStatus (invalid → 400). */
export class CommissionAccrualListQueryDto {
  @IsOptional()
  @IsEnum(CommissionAccrualStatus)
  status?: CommissionAccrualStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  partnerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
