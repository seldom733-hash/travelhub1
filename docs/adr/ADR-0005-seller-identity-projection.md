# ADR-0005: Public Seller Identity — Marketplace projection, not raw CRM Partner

- **Status:** Accepted (Phase 1 Step 1.11)
- **Date:** 2026-08-08
- **Related:** ADR-0001 (modular monolith), ADR-0002 (auth/RBAC), ADR-0003 (Buyer↔Customer mapping), ADR-0004 (Partner approval orchestration)

## Context

CRM хранит `crm.Partner` (name, legalName, taxId, contactEmail, registrationNumber,
внутренние данные). Витрина (public catalog) раньше отдавала `PublicProvider { id, name }`
напрямую из `crm.Partner.name` — raw CRM identity публиковалась без контроля.

Требование Step 1.11: разделить `CRM Partner Identity` и `Marketplace Public Seller Identity`;
не публиковать raw CRM данные (legalName/taxId/phone/email/website/socials/адреса/notes);
контролируемая публичная идентичность (ANONYMOUS / VERIFIED_ALIAS / PUBLIC_BRAND) с
консервативным default `ANONYMOUS`; изменения — через moderated proposal; анти-disintermediation
политика для контента.

## Decision

1. **`PublicSellerProfile` живёт в `catalog.*` (собственная schema Catalog).** Это
   marketplace-проекция продавца — публичный read-контур витрины принадлежит Catalog
   (как `PublicCatalogService`). CRM Partner остаётся CRM-owned; Catalog НЕ пишет в `crm.*`
   и НЕ копирует CRM-поля в профиль (только ссылка `partnerId` без FK, ADR-0001).

2. **Создание профиля — событийное (ADR-0001: события + чтение по ID), без новой
   synchronous orchestration.** Catalog подписан на `PartnerCreated` (consumer создаёт
   консервативный ANONYMOUS профиль, idempotent по unique `partnerId`). Для существующих
   ACTIVE Partners — детерминированный идемпотентный backfill при старте (только
   create-if-missing, default ANONYMOUS, никаких fallback-имён/угадываний). ADR-0003/0004
   (узкие synchronous orchestration contracts для registration/approve) не расширяются.

3. **Публичный контракт — только seller-safe projection.** `seller { publicId, displayName,
   visibilityMode, verified, memberSince, locationLabel }`. `partnerId` не отдаётся;
   HIDDEN/отсутствующий профиль → `seller = null`. ANONYMOUS → generic label
   (локализует фронтенд), VERIFIED_ALIAS/PUBLIC_BRAND → approved имя. Даже PUBLIC_BRAND
   НЕ раскрывает контакты/юр. данные автоматически.

4. **Изменения идентичности — только через moderated proposal** (`PublicSellerProfileProposal`):
   PARTNER предлагает (DRAFT → SUBMITTED), MODERATOR решает (approve alias/brand, reject,
   request changes), применяется к профилю только при APPROVED (no silent overwrite).
   PARTNER не может self-approve и не может сам переключить visibilityMode; PUBLIC_BRAND
   выдаёт MODERATOR правом `seller_public_profile.approve_brand`.

5. **Anti-disintermediation — политика контента Catalog (moderation concern).**
   Детерминированный текстовый детектор (email/URL/phone/мессенджеры/social/QR/внешние
   booking-домены) блокирует submit Product и seller proposal (controlled validation,
   не silent mutation — контент не меняется автоматически). Reason codes
   `EXTERNAL_CONTACT_INFO`, `EXTERNAL_BOOKING_LINK`, `QR_CODE_OR_CONTACT_MEDIA`,
   `DISINTERMEDIATION_ATTEMPT` добавлены в модерируемые причины. AI/OCR не внедряются
   (Step 1.11 §21); policy явно запрещает контакты/QR в media.

6. **MODERATOR получает `seller_public_profile.*`, но НЕ CRM edit rights**
   (в матрице нет `crm.partner.write` у MODERATOR — RBAC-инвариант сохраняется).

## Consequences

- Публичная идентичность продавца контролируется модерацией; default консервативен.
- CRM-данные не текут в public контур (проверяется e2e: raw JSON без private полей).
- Событийное создание профиля — eventual, но публичный контур безопасно падает на
  `seller = null` (идентичность не показывается, а не «угадывается»).
- Другие cross-domain flows это решение не наследуют (исключение узкое, как в ADR-0003/0004).

## Alternatives considered

- **Публиковать `crm.Partner` напрямую (status quo)** — отклонено: утечка raw CRM identity.
- **PublicSellerProfile в `crm.*`** — отклонено: это marketplace-проекция, не CRM-сущность;
  CRM не владеет публичной витриной и не должен модерироваться через Catalog.
- **Синхронное создание профиля при approve (Security→Catalog)** — отклонено: требует
  нового узкого orchestration contract; событийная модель (PartnerCreated) достаточна,
  а отсутствие профиля безопасно (seller=null).
