import { ValidationDomainError } from "../../shared/errors";
import { validateAttributes, type AttributeDef } from "./category-schema.validation";

/**
 * PHASE 1 STEP 1.8A — Service Unit (Seller Commercial Unit) — чистые валидаторы.
 *
 * DD-025 B: Seller commercial/service unit — Catalog-owned сущность ВНУТРИ Product.
 * Здесь только structure-and-identity валидация: никаких price/availability полей.
 *
 * Ключевые инварианты:
 *  - Seller-определённое коммерческое название сохраняется verbatim (только trim;
 *    case/порядок слов НЕ нормализуются, НЕ переводятся);
 *  - normalized attributes валидируются ПО CategorySchema-снапшоту (whitelist-ключи);
 *  - import identity (source, externalKey) — server/trusted: PARTNER передать НЕ
 *    может (422), staff/ADMIN — trusted provisioning контекст;
 *  - client не контролирует ownership/lifecycle/version/temporal/identity.
 */

/**
 * Поля, которые клиент НИКОГДА не может передать при create Service Unit.
 * source/externalKey отсутствуют в списке create: это server/trusted import
 * identity, НО staff/ADMIN (catalog.product.write) могут задавать их при
 * trusted provisioning; PARTNER блокируется в СЕРВИСЕ (422) — разный authority.
 */
export const SERVICE_UNIT_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "productId",
  "categoryId",
  "categorySchemaId",
  "schemaVersion",
  "partnerId",
  "ownerId",
  "sellerId",
  "status",
  "version",
  "publishedAt",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "actorId",
  "actorName",
] as const;

/**
 * PATCH Service Unit: те же server-owned поля + name/attributes не запрещены
 * (это легитимные editable-поля), но import identity (source/externalKey)
 * immutable после создания — смена = delete + create.
 */
export const SERVICE_UNIT_UPDATE_FORBIDDEN_KEYS = [
  ...SERVICE_UNIT_CREATE_FORBIDDEN_KEYS,
  "source",
  "externalKey",
] as const;

/** Максимальная длина коммерческого названия юнита (после trim). */
export const SERVICE_UNIT_NAME_MAX = 200;

/**
 * Валидация Seller-определённого коммерческого названия.
 * Возвращает ТОЛЬКО trim-нормализацию: внутренний порядок слов, case, пунктуация,
 * исходные названия («Deluxe Room Sea View», «Premium Double Ocean Side») НЕ
 * меняются. Пустое после trim → 422. Control-символы запрещены (безопасность).
 */
export function validateServiceUnitName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ValidationDomainError("Service unit name must be a string");
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationDomainError("Service unit name is required");
  }
  if (trimmed.length > SERVICE_UNIT_NAME_MAX) {
    throw new ValidationDomainError(`Service unit name must be at most ${SERVICE_UNIT_NAME_MAX} characters`);
  }
  // Control chars (0x00-0x1F, 0x7F) — недопустимы в коммерческом названии.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new ValidationDomainError("Service unit name contains invalid control characters");
  }
  return trimmed;
}

/**
 * Import identity — source (server/trusted integration context, §17/§18).
 * 1.8A импорт НЕ реализуется: минимальная future-safe строковая репрезентация
 * (enum-like формат, верхний регистр + подчёркивание), без жёсткого enum-листа
 * (интеграции CHANNEL_MANAGER/API_SUPPLIER ещё не существуют — §18 «no premature enum»).
 * Устанавливается ТОЛЬКО staff/ADMIN (trusted provisioning); PARTNER → 422.
 */
export const SERVICE_UNIT_SOURCE_MAX = 50;
export const SERVICE_UNIT_SOURCE_PATTERN = /^[A-Z][A-Z0-9_]{0,49}$/;

export function validateImportSource(source: unknown): string | null {
  if (source === undefined || source === null) return null;
  if (typeof source !== "string") {
    throw new ValidationDomainError("Import source must be a string");
  }
  const trimmed = source.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > SERVICE_UNIT_SOURCE_MAX) {
    throw new ValidationDomainError(`Import source must be at most ${SERVICE_UNIT_SOURCE_MAX} characters`);
  }
  if (!SERVICE_UNIT_SOURCE_PATTERN.test(trimmed)) {
    throw new ValidationDomainError(
      'Import source must be an enum-like token (uppercase letters/digits with underscores, e.g. "CHANNEL_MANAGER")',
    );
  }
  return trimmed;
}

/** Внешний ключ импорта: безопасный формат, ≤100, без control-символов/пробелов. */
export const SERVICE_UNIT_EXTERNAL_KEY_MAX = 100;
export const SERVICE_UNIT_EXTERNAL_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export function validateExternalKey(externalKey: unknown): string | null {
  if (externalKey === undefined || externalKey === null) return null;
  if (typeof externalKey !== "string") {
    throw new ValidationDomainError("External key must be a string");
  }
  const trimmed = externalKey.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > SERVICE_UNIT_EXTERNAL_KEY_MAX) {
    throw new ValidationDomainError(`External key must be at most ${SERVICE_UNIT_EXTERNAL_KEY_MAX} characters`);
  }
  if (!SERVICE_UNIT_EXTERNAL_KEY_PATTERN.test(trimmed)) {
    throw new ValidationDomainError(
      "External key must match [A-Za-z0-9][A-Za-z0-9._:-]{0,99} (no spaces/control characters)",
    );
  }
  return trimmed;
}

/**
 * Согласованность import identity: внешний ключ БЕЗ source запрещён
 * (externalKey осмыслен только в контексте trusted integration source;
 * manual units не получают fabricated external key — §17).
 * source без externalKey допустим (integration context ещё не присвоил ключ).
 */
export function assertImportIdentityConsistency(source: string | null, externalKey: string | null): void {
  if (externalKey !== null && source === null) {
    throw new ValidationDomainError("externalKey requires a source (import identity is server/trusted)");
  }
}

/**
 * Валидация normalized unit attributes по CategorySchema-снапшоту.
 * Переиспользует канонический validateAttributes (тот же whitelist-контракт,
 * что у Product.attributes) — без отдельного hotel-specific валидатора.
 * attributes = null/undefined → { } (юнит без атрибутов допустим, если schema
 * не требует обязательных).
 */
export function validateUnitAttributes(
  schema: { attributes: AttributeDef[] } | null,
  attributes: unknown,
): Record<string, unknown> {
  if (attributes === undefined || attributes === null) return {};
  if (schema) {
    return validateAttributes(schema, attributes);
  }
  // Нет CategorySchema-контекста (Product без категории): attributes запрещены
  // (иначе произвольный unbounded JSON без authority — §24).
  if (typeof attributes === "object" && attributes !== null && !Array.isArray(attributes)) {
    if (Object.keys(attributes as Record<string, unknown>).length > 0) {
      throw new ValidationDomainError(
        "Service unit attributes require a category/schema context (Product has none)",
      );
    }
  }
  if (typeof attributes !== "object" || attributes === null || Array.isArray(attributes)) {
    throw new ValidationDomainError("Service unit attributes must be an object");
  }
  return attributes as Record<string, unknown>;
}
