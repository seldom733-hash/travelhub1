/**
 * Supplier Markup (STRICT PROMPT §6/§7) — MarkupRule validation contract.
 *
 * Rate: десятичная доля 0 ≤ rate < 1 (0.05 = 5%), ≤ 6 знаков, regex-authority
 * без JS float arithmetic. Отличие от validateCommissionRate: явный «0»/«0.00»
 * ВАЛИден (explicit 0% — осознанный выбор, отличим от NOT_CONFIGURED, design §3);
 * «5» (percent-as-number), научная нотация, whitespace — отклоняются.
 *
 * supplierCode/serviceType — точные registry-ключи (SupplierAdapterRegistry +
 * FlightSupplierRegistry): новый supplier/service расширяет матрицу без
 * миграции (Gate A), поэтому никаких enum/хардкода vocabulary здесь.
 */
import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from "class-validator";
import { ValidationDomainError } from "../../shared/errors";

/** Каноническая форма: «0» либо «0.d…» (1–6 знаков). */
export function validateMarkupRate(rate: string): string {
  if (typeof rate !== "string" || !/^0(\.\d{1,6})?$/.test(rate)) {
    throw new ValidationDomainError(
      "markup rate must be a decimal fraction in [0, 1) with at most 6 decimal places — canonical form 0.05 = 5%, explicit 0 = configured 0% (percent-as-number, scientific notation and whitespace are rejected)",
    );
  }
  return rate;
}

/** supplierCode: точный ключ registry-регистрации (1–64: буквы/цифры/_.-). */
export function validateSupplierCode(code: string): string {
  if (typeof code !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(code)) {
    throw new ValidationDomainError("supplierCode must match the registry supplier code exactly (1-64 chars: letters, digits, _, ., -)");
  }
  return code;
}

/** serviceType: registry capability-токен (tours | hotels | flights и будущие). */
export function validateServiceType(serviceType: string): string {
  if (typeof serviceType !== "string" || !/^[a-z][a-z0-9_-]{0,31}$/.test(serviceType)) {
    throw new ValidationDomainError("serviceType must be a registry capability token (lowercase, e.g. tours | hotels | flights)");
  }
  return serviceType;
}

/** Create MarkupRule: supplierCode + serviceType + rate + effective period. */
export class CreateMarkupRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  supplierCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  serviceType!: string;

  /** Decimal-строка (validateMarkupRate): 0 ≤ rate < 1, ≤ 6 знаков. */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  rate!: string;

  /** default = now (server-owned, не клиентский произвол). */
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;
}

/** Update MarkupRule (ТОЛЬКО в DRAFT; version инкремент server-side). */
export class UpdateMarkupRuleDto {
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

  /** Optimistic concurrency (§32): stale версия → контролируемый 409. */
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

/** Whitelist-list-query (key/status/пагинация). */
export class MarkupRuleListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  serviceType?: string;

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

/** Resolve-query: key + business instant (для admin-проверки effective-окна). */
export class ResolveMarkupRuleQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  supplierCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  serviceType!: string;

  @IsISO8601()
  at!: string;
}

/** Сервер-owned поля — forged в create/update body → 422 (mass-assignment). */
export const MARKUP_RULE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "history",
] as const;
