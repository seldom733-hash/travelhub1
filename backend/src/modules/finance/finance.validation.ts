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
import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Length, MaxLength, Min, MinLength, ValidateIf } from "class-validator";
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

/** Дата «до» должна быть позже даты «с». */
export function assertValidRange(validFrom: string, validTo: string | undefined, label = "period"): void {
  if (validTo !== undefined && new Date(validTo) <= new Date(validFrom)) {
    throw new ValidationDomainError(`${label}: validTo must be after validFrom`);
  }
}
