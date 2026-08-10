# Reverse Marketplace — Seller Commercial Capabilities & Destination Coverage (Step 2.2A)

**Status:** Implementation completed — waiting for Strict Review (Phase 2)
**Owner:** Reverse Marketplace (`reverse.*`, ADR-0012)
**Prerequisite:** ADR-0012 Accepted (Strict Review APPROVED WITH REVIEW FIXES)

## Purpose

Server-authoritative ответ на вопрос:

> Какие категории/сервисы Seller коммерчески способен предлагать, в каких
> дестинациях, и принимает ли Seller сейчас Buyer Requests?

Это НЕ inventory, НЕ публикация Product, НЕ pricing, НЕ availability, НЕ
matching. Capability ≠ inventory; capability ≠ entitlement.

## Ownership

`Seller Commercial Capabilities → reverse.*` (ADR-0012). НЕ в catalog.*,
PublicSellerProfile, Product, CRM, Sales, Security. Существующие домены
остаются authoritative для своих фактов. reverse.* хранит только trusted
references по ID (без cross-schema FK, ADR-0001) и не выполняет
cross-context writes.

## Schema / model (`reverse.*`)

- `reverse.SellerCapability` — capability на (Seller, категорию):
  - `code` CAP-00000001 (IdsService, атомарный счётчик);
  - `sellerId` — crm.Partner ref (БЕЗ FK), всегда из `actor.partnerId`;
  - `categoryId`/`categorySlug` — ref на catalog.Category (БЕЗ FK; Catalog
    остаётся владельцем taxonomy — DD-028: потребление, не владение);
    immutable после создания (смена категории = deactivate + create);
  - `destinations` JSONB — структурированное покрытие (см. ниже);
  - `acceptsBuyerRequests` Boolean default false — безопасный default;
  - `status` CapabilityStatus: DRAFT → ACTIVE → INACTIVE;
  - `version` — CAS (stale expectedVersion → 409);
  - `activatedAt`/`deactivatedAt` — реальные переходы (НЕ updatedAt), UTC;
  - `@@unique([sellerId, categoryId])` — один capability на (Seller, категорию).
- `reverse.SellerCapabilityHistory` — audit by default (action/from/to/fields/
  actorId/actorName), каскад с capability.

Ограничение модели (сознательное): destination-иерархия Country→Region→City
НЕ замораживается (DD-028); покрытие — структурные коды, расширяемо.

## Legal location ≠ coverage

Правовая/регистрационная страна Seller НЕ определяет и НЕ подставляется как
coverage. Пример: Seller из AZ/Baku объявляет HOTEL → TR/Turkey — persistence
и read-модель возвращают ровно TR; никакого implicit AZ (e2e #4/#6).

## Capability ≠ inventory

Создание/активация capability НЕ создаёт Product/Tariff/Availability/
AvailabilityReservation и НЕ меняет Catalog pricing/inventory (e2e #4/#15-17).
Seller может быть capable HOTEL → Turkey без единого live Product.

## Capability ≠ entitlement

Capability declaration НЕ даёт entitlement. Entitlement-модель НЕ реализуется
в 2.2A; matching-gate «eligible + entitlement» — Step 2.2C. enable
acceptsBuyerRequests НЕ создаёт BuyerRequest/Lead/Opportunity/Quote/Sale
(e2e #9).

## Limited-scope (до Service Templates 1.8A–1.8D)

Только лёгковесные seller-declared декларации: service categories +
destination coverage. НЕ реализованы room types, rate plans, period pricing/
availability, inventory, live availability, CSV import, channel manager,
supplier API, dynamic pricing.

## Destination representation

`destinations`: JSON-массив записей:

- `{ countryCode: "TR" }` — country-level (структурный ISO `^[A-Z]{2}$`);
- `{ countryCode: "TR", cityCode: "ANTALYA" }` — city-level из канонического
  справочника CITY_REF (catalog/seller/locations.ts, read-only); city обязан
  принадлежать указанной стране;
- `{ worldwide: true }` — broad coverage, ЭКСКЛЮЗИВНАЯ запись (единственная);
  код `WW` в countryCode ЗАПРЕЩЁН (reserved, fake country).

Нормализация: whitelist-ключи, reject дубликатов, детерминированная сортировка.
Ограничение: city-level доступно только для городов канонического справочника;
отсутствующий город → country-level coverage (документировано).

## API (partner-own, `/api/v1/partner/reverse/capabilities`)

| Метод | Путь | Право |
|---|---|---|
| GET | `/capabilities` (limit/offset) | `reverse.capability.read_own` |
| POST | `/capabilities` | `reverse.capability.write_own` |
| GET | `/capabilities/:id` | `reverse.capability.read_own` |
| GET | `/capabilities/:id/history` | `reverse.capability.read_own` |
| PATCH | `/capabilities/:id` (destinations) | `reverse.capability.write_own` |
| POST | `/capabilities/:id/accept-requests` | `reverse.capability.write_own` |
| POST | `/capabilities/:id/activate` | `reverse.capability.write_own` |
| POST | `/capabilities/:id/deactivate` | `reverse.capability.write_own` |

Ownership: `actor.partnerId` — единственный security source. Body/query НЕ
являются security source. Forged sellerId/partnerId/status/version/temporal →
422 (assertNoForbiddenKeys); чужой id → neutral 404; stale version → 409.

## Permissions / object scope

- `reverse.capability.read_own`, `reverse.capability.write_own` — только PARTNER
  (least-privilege; BUYER и staff-роли не получают; ADMIN по convention
  ALL_PERMISSIONS, но partner-own контракт гейтится ролью в сервисе → 403);
- pending PARTNER (partnerId=null) → 403; BUYER → 403; anonymous → 401;
- один employee может иметь несколько capabilities (small-organization compat,
  никаких `if role === SALES_MANAGER`-проверок).

## Lifecycle

`DRAFT → ACTIVE → INACTIVE` (+ re-activate INACTIVE → ACTIVE). No-op при том же
состоянии (без мутации/версии). DRAFT → deactivate — invalid transition (422).
Deactivate не удаляет; timestamps — реальные переходы (UTC).

## Concurrency

CAS через `version`: stale `expectedVersion` → 409; concurrent conflicting
updates — один победитель (e2e #12); DB unique `(sellerId, categoryId)` —
детерминированный duplicate rule → controlled 409.

## Duplicate semantics

Один capability на (Seller, категорию). Повторный create того же (seller,
category) → 409 (не ambiguous). Другой Seller с той же категорией — легально.

## Audit

Каждое meaningful mutation пишет SellerCapabilityHistory (created /
destinations_updated / accepts_requests_updated / activated / deactivated —
actor, before/after, timestamps) + security.AuditLog (capability.created/
updated/accepts_requests_updated/activated/deactivated). Без PII.

## Events

События НЕ эмитятся: нет consumer/business meaning в 2.2A (факты читаются
matching-слоем 2.2C напрямую). No event is preferable to speculative events.

## Indexes / query paths

- `@@unique([sellerId, categoryId])` — duplicate rule + query по Seller;
- `[sellerId, status]` — own-scope list;
- `[status, categoryId]` — future matching по категории;
- `[status, acceptsBuyerRequests]` — future eligibility (ACTIVE + accepts).

## Migration

`20260810194155_add_reverse_seller_capabilities` — новая schema `reverse`,
additive, без cross-schema FK, без backfill; `migrate status` up to date;
drift 0 (`migrate diff --exit-code` = 0); fresh replay доказан e2e globalSetup
(`migrate deploy` на пересозданной test-БД).

## IDs

`CAP-` зарегистрирован в `docs/contracts/ids.md` (IdsService — атомарный
счётчик, generic). `BRQ-*` НЕ регистрируется (рабочий, Step 2.2B); Proposal
prefix НЕ изобретён.

## JSONB destination assessment (strict review)

destinations хранится как JSONB. Оценка — conscious, accepted deferred detail:

- **Валидация полностью server-authoritative** (`normalizeDestinations` +
  reserved `WW`); форма не дрейфует через API — только через сервис;
- **2.2C matching:** capability-факты на Seller — небольшой объём; matching
  прочитает ACTIVE capabilities (индексы `[status, categoryId]`,
  `[status, acceptsBuyerRequests]`, `[sellerId, status]`) и оценит coverage
  in-app детерминированно; JSONB containment (`@>`) доступен для exact-match
  по countryCode при необходимости;
- текущие индексы НЕ претендуют на производительность destination-matching
  (это сознательно отложено); нормализованные destination-rows — будущее,
  вместе с DD-028 иерархией, НЕ создаются сейчас;
- иерархия Country→Region→City не заморожена JSONB-представлением.

## Deferred

- Entitlement product rules (matching-gate) — Step 2.2C;
- BuyerRequest/matching/Proposal — Steps 2.2B–2.2F;
- destination hierarchy Country→Region→City — DD-028;
- city справочник вне статического CITY_REF — future location service.

## Compatibility with 2.2B/2.2C

Matching-слой 2.2C сможет детерминированно запрашивать ACTIVE capabilities по
Seller, категории, acceptsBuyerRequests и destination representation — без
изменения 2.2A-модели.
