import { ValidationDomainError } from "./errors";

/**
 * PHASE 1 STEP 1.9 — чистые валидаторы полей (own-scope / anti-mass-assignment).
 * Вынесены отдельно от контроллеров для unit-тестирования.
 */

/** Нормализация email для deterministic matching (CRM Customer link). */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Поля, которые клиент НИКОГДА не может передать при self-registration. */
export const REGISTER_FORBIDDEN_KEYS = [
  "role",
  "roleCode",
  "permissions",
  "partnerId",
  "customerId",
  "status",
  "userId",
  "id",
  "code",
  "isAdmin",
] as const;

/** Поля, которые клиент НЕ может менять через own-profile API (mass assignment). */
export const PROFILE_FORBIDDEN_KEYS = [
  "role",
  "roleCode",
  "permissions",
  "partnerId",
  "customerId",
  "status",
  "userId",
  "id",
  "code",
  "username",
  "password",
  "passwordHash",
] as const;

/**
 * Поля PartnerApplication, которые заявитель НЕ может менять через own PATCH
 * (Step 1.10): identity/lifecycle/decision-поля управляются сервером/ревьюером.
 */
export const PARTNER_APPLICATION_FORBIDDEN_KEYS = [
  "role",
  "roleCode",
  "permissions",
  "partnerId",
  "customerId",
  "status",
  "userId",
  "id",
  "code",
  "username",
  "password",
  "passwordHash",
  "applicantType",
  "termsAccepted",
  "submittedAt",
  "reviewedAt",
  "reviewedById",
  "reviewedByUsername",
  "decisionReason",
  "createdAt",
  "updatedAt",
  "history",
] as const;

/**
 * Поля Partner Storefront, которые PARTNER НЕ может передавать через own API
 * (Step 1.12.1 §7/§8): ownership (partnerId/ownerId), lifecycle (status),
 * id/code и все temporal/actor-поля управляются сервером.
 */
export const STOREFRONT_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "partnerId",
  "ownerId",
  "status",
  "entitlementStatus",
  // Step 1.12.2: countryCode — системная identity из crm.Partner (НЕ из body);
  // media/audit/temporal — управляются сервером.
  "countryCode",
  "createdAt",
  "updatedAt",
  "activatedAt",
  "deactivatedAt",
  "createdById",
  "updatedById",
  "activatedById",
  "deactivatedById",
] as const;

/**
 * Поля, запрещённые в PATCH storefront: всё из create-списка ПЛЮС slug
 * (immutable после создания — PATCH slug → 422, никогда не silent mutation).
 */
export const STOREFRONT_UPDATE_FORBIDDEN_KEYS = [...STOREFRONT_CREATE_FORBIDDEN_KEYS, "slug"] as const;

/**
 * Отклоняет запрос, содержащий запрещённые ключи (масс-assignment / role injection /
 * forged customerId/partnerId). Возвращает список задетых ключей (пусто — ок).
 * Чистая функция: не бросает сама (бросают сервисы), чтобы тестировать без Nest.
 */
export function findForbiddenKeys(body: unknown, forbidden: readonly string[]): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body).filter((k) => (forbidden as readonly string[]).includes(k));
}

/** То же, но бросает ValidationDomainError (422) при наличии запрещённых полей. */
export function assertNoForbiddenKeys(body: unknown, forbidden: readonly string[]): void {
  const hit = findForbiddenKeys(body, forbidden);
  if (hit.length > 0) {
    throw new ValidationDomainError(`Forbidden field(s) in request: ${hit.join(", ")}`);
  }
}
