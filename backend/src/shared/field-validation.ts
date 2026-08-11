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
 * Поля SellerCapability, которые клиент НИКОГДА не может передать (Step 2.2A):
 * ownership (sellerId), identity (id/code/categoryId immutable после создания),
 * lifecycle/entitlement/version/timestamps/audit — серверные. acceptsBuyerRequests
 * на create НЕ принимается (безопасный default false; enable — явной командой
 * accept-requests).
 */
export const CAPABILITY_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "sellerId",
  "partnerId",
  "ownerId",
  "status",
  "version",
  "acceptsBuyerRequests",
  "createdAt",
  "updatedAt",
  "activatedAt",
  "deactivatedAt",
  "createdById",
  "categorySlug",
] as const;
/** PATCH destinations: categoryId также immutable (смена категории = deactivate + create). */
export const CAPABILITY_UPDATE_FORBIDDEN_KEYS = [...CAPABILITY_CREATE_FORBIDDEN_KEYS, "categoryId"] as const;

/**
 * Поля BuyerRequest, которые клиент НИКОГДА не может передать (Step 2.2B):
 * ownership (buyerId/customerId/ownerId), identity (id/code), lifecycle/status,
 * version (кроме expectedVersion — отдельное поле), acquisitionSource
 * (серверный BUYER_REQUEST), createdBy/timestamps, matching/distribution и
 * seller-поля (2.2C+), correlation/causation, entitlement.
 */
export const REQUEST_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "buyerId",
  "customerId",
  "ownerId",
  "status",
  "version",
  "acquisitionSource",
  "source",
  "createdBy",
  "createdAt",
  "updatedAt",
  "submittedAt",
  "cancelledAt",
  "categorySlug",
  "matchedSellerIds",
  "distributionState",
  "sellerIds",
  "correlationId",
  "causationId",
  "entitlementStatus",
] as const;
/** PATCH: categoryId редактируется в DRAFT (черновик Buyer-а) — остальные серверные поля запрещены. */
export const REQUEST_UPDATE_FORBIDDEN_KEYS = REQUEST_CREATE_FORBIDDEN_KEYS;

/**
 * Lifecycle-команды (submit/cancel) принимают ТОЛЬКО expectedVersion.
 * Все demand/ownership/lifecycle/source/temporal ключи запрещены → 422 (loud),
 * а не silent-strip через whitelist — серверные поля не client-authoritative.
 */
export const REQUEST_LIFECYCLE_FORBIDDEN_KEYS = [
  ...REQUEST_CREATE_FORBIDDEN_KEYS,
  "categoryId",
  "destinations",
  "serviceDateFrom",
  "serviceDateTo",
  "adults",
  "children",
  "infants",
  "budget",
  "preferences",
] as const;

/**
 * Matching-команда (Step 2.2C) принимает ТОЛЬКО buyerRequestId. Все forged
 * server-owned поля (sellerIds/self-match/status/timestamps/rank/score/
 * contactDisclosed/proposalId/actor) → 422 (loud), а не silent-strip.
 */
export const MATCH_RUN_FORBIDDEN_KEYS = [
  "sellerIds",
  "sellers",
  "sellerId",
  "status",
  "matchedAt",
  "distributedAt",
  "createdAt",
  "updatedAt",
  "eligibilityReason",
  "eligibility",
  "rank",
  "score",
  "contactDisclosed",
  "proposalId",
  "version",
  "actorId",
  "actorName",
  "createdBy",
  "correlationId",
  "causationId",
] as const;

/**
 * Поля SellerProposal, которые клиент НИКОГДА не может передать (Step 2.2D):
 * ownership (sellerId/partnerId/ownerId/buyerId), identity (id/code/
 * distributionId — server-derived: distribution резолвится сервисом по
 * (buyerRequestId, sellerId)), lifecycle/status, version (кроме
 * expectedVersion — отдельное поле), timestamps, acquisition/sales-
 * conversion поля (quoteId/saleId/selected/contactDisclosed), actor/correlation.
 *
 * ПРИМЕЧАНИЕ: buyerRequestId НЕ запрещён на create — это легитимный client-
 * вход (для какого распределённого request создаётся Proposal; сервер
 * проверяет существование distribution к этому Seller-у). На update/lifecycle
 * он запрещён (immutable после создания).
 */
export const PROPOSAL_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "sellerId",
  "partnerId",
  "ownerId",
  "buyerId",
  "distributionId",
  "status",
  "version",
  "acquisitionSource",
  "source",
  "createdBy",
  "createdAt",
  "updatedAt",
  "submittedAt",
  "withdrawnAt",
  "convertedAt",
  "quoteId",
  "saleId",
  "contactDisclosed",
  "selected",
  "accepted",
  "correlationId",
  "causationId",
] as const;
/**
 * PATCH: те же server-owned поля ПЛЮС buyerRequestId (immutable после
 * создания — смена request = отзыв + создание нового Proposal).
 */
export const PROPOSAL_UPDATE_FORBIDDEN_KEYS = [...PROPOSAL_CREATE_FORBIDDEN_KEYS, "buyerRequestId"] as const;

/**
 * Lifecycle-команды (submit/withdraw) принимают ТОЛЬКО expectedVersion.
 * Все content/ownership/lifecycle/source/temporal ключи запрещены → 422 (loud).
 */
export const PROPOSAL_LIFECYCLE_FORBIDDEN_KEYS = [
  ...PROPOSAL_CREATE_FORBIDDEN_KEYS,
  "buyerRequestId", // immutable после создания (как в update)
  "amount",
  "currency",
  "description",
  "includedServices",
  "exclusions",
  "conditions",
  "notes",
  "validUntil",
] as const;

/**
 * Selection-команда (Step 2.2F) принимает ТОЛЬКО expectedVersion (CAS request).
 * Все forged server-owned поля → 422 (loud), а не silent-strip: ownership
 * (buyerId/customerId/sellerId/partnerId/ownerId), identity (id/code/
 * opportunityId/leadId/quoteId), lifecycle/version/timestamps, acquisitionSource,
 * amount/currency (Proposal money НЕ-binding и НЕ client-authoritative), 
 * selected/converted/contactDisclosed/salesOwner, correlation.
 */
export const PROPOSAL_SELECT_FORBIDDEN_KEYS = [
  // LIFECYCLE наследует PROPOSAL_CREATE (id/code/sellerId/partnerId/ownerId/
  // buyerId/status/version/acquisitionSource/quoteId/saleId/selected/accepted/
  // convertedAt/...) + контент/money/validUntil. Ниже — только genuinely новые.
  ...PROPOSAL_LIFECYCLE_FORBIDDEN_KEYS,
  "customerId",
  "opportunityId",
  "leadId",
  "salesOwner",
  "assignedTo",
  "assignedToId",
  // Conversion-специфичные server-owned ключи (без них select-команда видела бы
  // forged conversion state): lifecycle-маркеры, refs, timestamps.
  "converted",
  "convertedOpportunityId",
  "selectedAt",
  "selectedProposalId",
  "proposalCode",
  "opportunityCode",
] as const;

/**
 * Поля pre-sale conversation open-команды (Step 2.2E), которые клиент НЕ может
 * передать: ownership (buyerId/customerId/ownerId/sellerId/partnerId/memberIds),
 * identity (id/code/threadId), lifecycle/status, version, timestamps, context
 * refs (proposalId/distributionId — server-derived, auto-attach), sales-
 * conversion/contact поля, actor/correlation. Клиент передаёт ТОЛЬКО
 * buyerRequestId (+ sellerPublicId для BUYER).
 */
export const CONVERSATION_OPEN_FORBIDDEN_KEYS = [
  "id",
  "code",
  "threadId",
  "conversationId",
  "buyerId",
  "customerId",
  "ownerId",
  "sellerId",
  "partnerId",
  "memberIds",
  "members",
  "buyerCustomerId",
  "sellerPartnerId",
  "proposalId",
  "distributionId",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "createdBy",
  "actorId",
  "actorName",
  "acquisitionSource",
  "source",
  "contactDisclosed",
  "converted",
  "selected",
  "accepted",
  "quoteId",
  "saleId",
  "correlationId",
  "causationId",
] as const;

/**
 * Поля send-команды (Step 2.2E): ТОЛЬКО body (+ subject). Всё остальное
 * (sender/recipient/ownership/direction/status/timestamps/context refs) —
 * server-derived из actor и thread → 422 (loud), а не silent-strip.
 */
export const CONVERSATION_SEND_FORBIDDEN_KEYS = [
  "id",
  "code",
  "threadId",
  "conversationId",
  "buyerRequestId",
  "buyerId",
  "customerId",
  "ownerId",
  "sellerId",
  "partnerId",
  "memberIds",
  "members",
  "sender",
  "senderId",
  "senderType",
  "senderName",
  "recipient",
  "recipientId",
  "recipientType",
  "direction",
  "status",
  "version",
  "occurredAt",
  "createdAt",
  "updatedAt",
  "createdBy",
  "actorId",
  "actorName",
  "contactDisclosed",
  "converted",
  "selected",
  "accepted",
  "quoteId",
  "saleId",
  "correlationId",
  "causationId",
] as const;

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
