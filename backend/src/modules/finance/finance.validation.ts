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
import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, MinLength, ValidateIf } from "class-validator";
import { Type } from "class-transformer";
import { ValidationDomainError } from "../../shared/errors";

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
