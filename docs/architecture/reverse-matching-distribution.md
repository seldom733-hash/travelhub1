# Reverse Marketplace — Matching & Distribution (Step 2.2C)

**Status:** Implementation completed — waiting for Strict Review (Phase 2)
**Owner:** Reverse Marketplace (`reverse.*`, ADR-0012)
**Prerequisite:** Step 2.2B Strict Review APPROVED WITH REVIEW FIXES

## Purpose

Server-authoritative evaluation of SUBMITTED BuyerRequests against Seller
Commercial Capabilities, producing durable per-Seller distribution facts that
become the Seller's inbox (read-only). Step 2.2D (Proposal) reads these
distributions.

Canonical flow:

`BuyerRequest SUBMITTED → eligibility evaluation → durable per-Seller
distribution (reverse.BuyerRequestDistribution) → Seller reads own inbox →
Step 2.2D Proposal`

## Ownership

`Matching / Distribution → reverse.*` (ADR-0012). Никаких writes в Catalog/
Sales/CRM/Communication/Order/Booking. Cross-context reads — read-by-ID
(ADR-0001): crm.Partner (sellerId/status), catalog.Category (categoryId).

## Matching trigger

**Explicit server command** (не event, не polling): `POST
/api/v1/system/reverse/matching/run { buyerRequestId }` — permission
`reverse.match.run` (ADMIN/system). Синхронный, транзакционный, идемпотентный.

Почему не event: consumer отсутствует (2.2D будет читать distributions
напрямую — это его источник); explicit command даёт наблюдаемый, retry-safe
run с детерминированным summary. No event is preferable to speculative
events (консистентно с 2.2B). Если будущий trigger потребует автоматизации —
это решение 2.2D/2.2E, не 2.2C.

## Eligibility model

Все входы — server-owned state. Gate order:

1. request.status == SUBMITTED (DRAFT/CANCELLED → 422, без распределения);
2. category ACTIVE;
3. capability.status == ACTIVE;
4. capability.acceptsBuyerRequests == true;
5. capability.categoryId == request.categoryId (canonical catalog.Category);
6. destination coverage (strict containment, pure helper);
7. Seller (crm.Partner) status == ACTIVE.

`MATCHED/DISTRIBUTED ≠ CONTACT DISCLOSED`. Matching НЕ создаёт
Lead/Opportunity/Quote/CheckoutIntent/Sale/OrderRequested/Order/Booking/
Payment (e2e #5/#18: dbCounts до/after равны). Никакого Lead-per-Seller.

## Legal location ≠ coverage

Legal/registration country Seller НЕ является coverage-критерием и НЕ
fallback. Пример (e2e #5): Seller зарегистрирован в AZ, capability
HOTEL→TR(Antalya) матчится на TR-request; Seller зарегистрирован в TR с
capability HOTEL→AZ НЕ матчится на TR-request.

## Capability ≠ entitlement

Канонический entitlement authority для reverse marketplace отсутствует:
`StorefrontEntitlementStatus` — отдельный commercial контекст (paid SaaS
витрина); reverse marketplace — commission path (ADR-0012/commercial model).
Поэтому participation gate = capability-level (ACTIVE + acceptsBuyerRequests).
Entitlement gate — будущая работа; никаких entitlement-таблиц не создано.

## Destination coverage semantics (strict containment)

Два явных документальных решения (STRICT REVIEW 2.2C, не произвольная
заморозка):

- **multi-destination request = OR (alternatives)**: Buyer перечисляет
  альтернативные направления («или там, или там»); eligible при покрытии
  ХОТЯ БЫ ОДНОГО. AND/itinerary-семантика не реализована (нет канонического
  требования; при появлении — отдельное решение).
- **request {worldwide} → только capability {worldwide}**: worldwide-запрос
  означает «Buyer гибок к любой дестинации», и консервативно обслуживается
  только Seller-ами, явно заявившими глобальное покрытие. Seller с
  конкретным покрытием НЕ получает всемирные запросы (негативная
  селекция — детерминированный безопасный default).

Чистый helper `isRequestEligible` (src/modules/reverse/matching.validation.ts):

- capability {worldwide} покрывает любой request destination;
- request {worldwide} покрывается ТОЛЬКО capability {worldwide};
- request {countryCode=X} — capability {worldwide} ИЛИ capability (countryCode=X);
- request {countryCode=X, cityCode=C} — capability {worldwide} ИЛИ
  (countryCode=X без city) ИЛИ (countryCode=X, cityCode=C);
- city capability НЕ покрывает country-level request (Buyer гибок по всей
  стране, Seller покрывает только город) — консервативный детерминизм;
- multi-destination request: eligible если ХОТЯ БЫ ОДИН destination покрыт.

DD-028 (Region hierarchy) остаётся deferred — Region не используется.

## Distribution persistence

`reverse.BuyerRequestDistribution`:

- id (UUID-only — internal fact, без business-префикса; Proposal prefix — 2.2D);
- buyerRequestId (FK intra-schema, CASCADE);
- sellerId (crm.Partner ref, без FK);
- distributedAt / createdAt / updatedAt;
- `@@unique([buyerRequestId, sellerId])` — DB-инвариант идемпотентности;
- индексы `[sellerId]`, `[sellerId, distributedAt]`.

Matched vs distributed: «eligible» — вычисляемое понятие (не персистится);
«distributed» — единственный durable fact. Отдельного MATCHED-состояния нет
(минимальная модель; Roadmap использует термины как синонимы в этом шаге).

## Seller inbox / read model

- `GET /api/v1/partner/reverse/distributions` (list, bounded limit/offset,
  deterministic order distributedAt desc, id desc, total);
- `GET /api/v1/partner/reverse/distributions/:id` (detail, neutral 404 чужой);
- permission `reverse.distribution.read_own` (PARTNER); own-scope через
  actor.partnerId; НЕТ global list; unmatched Seller видит пусто.

## Seller-safe projection

Только demand-факты: request code (BRQ-*), categoryId/categorySlug,
destinations, serviceDateFrom/To, adults/children/infants, budget
(не-binding hint), request.status (актуальный — CANCELLED честно виден),
distributedAt.

НЕ включены: preferences (Step 2.2B review: preferences — не DLP-safe store;
safety decision — omitted initially, документировано), buyerId/customerId,
email/phone/whatsapp/telegram/passport/address, raw Customer profile.

## Cross-Seller isolation

Seller A не может прочитать distribution B (list строго свой, detail чужого
→ 404), не видит count/identity других Sellers, не видит будущие Proposal
(2.2D) и conversation (2.2E). Buyer-facing distribution state: минимальный,
без Seller identities/counts (в 2.2C не раскрывается вовсе).

## Concurrency / idempotency / failure atomicity

- повторный run: deterministic `matched` (eligible set) + `created` (новые
  rows; повторный → 0); DB unique + `createMany skipDuplicates` — retry-safe;
- concurrent runs: те же rows (e2e #10);
- cancel-vs-matching: `SELECT ... FOR UPDATE` на request row внутри tx —
  после commit cancel'а новые distributions невозможны; если matching первый —
  durable rows сохраняются, Seller projection показывает CANCELLED (e2e #11);
- capability deactivate/accepts-off до commit — исключается fresh re-read
  внутри tx (READ COMMITTED, statement-level snapshot) (e2e #12). Fresh
  re-read перечитывает ТАКЖЕ destinations (они изменяемы через PATCH
  2.2A) и полностью пересчитывает eligibility (включая coverage) по
  свежему состоянию (e2e #12b — sequential regression: обновлённый
  coverage применяется; настоящий concurrent interleaving НЕ доказуем
  без hooks — контракт READ COMMITTED документирован, не переоценивается);
- остаточное окно READ COMMITTED: изменение (deactivate/accepts/destinations),
  закоммиченное ПОСЛЕ fresh re-read, но ДО commit matching-транзакции, может
  не попасть в этот run — задокументированный контракт (см. §Concurrency);
- Seller (crm.Partner) deactivation — кросс-контекстное чтение (ADR-0001),
  row lock на чужую схему не применяется. Честный контракт: Partner,
  деактивированный ПОСЛЕ чтения в run-транзакции, но ДО её commit, может
  получить distribution этого конкретного run; последующий доступ к inbox
  блокируется `assertSellerEligible` (partnerId + crm.Partner ACTIVE), т.е.
  деактивированный Seller не может читать новые distributions.
- batch = одна транзакция (все distributions одного request); partial failure
  невозможен; retry сходится; ноль Sales/Proposal/Communication side effects.

## Events / outbox / inbox

События НЕ эмитятся (2.2C). Outbox: 0 reverse-events (проверено). Inbox —
это read-model по distributions, не event-inbox.

## Query paths / indexes

- matching: `BuyerRequest [status, categoryId]` + `[status, createdAt]`
  (существующие) + `SellerCapability [status, categoryId]` (существующий;
  candidate-запрос дополнительно фильтрует `acceptsBuyerRequests = true`
  булевым предикатом на уже узком наборе — отдельный индекс
  `[status, acceptsBuyerRequests]` НЕ создавался и не требуется);
- inbox: `[sellerId]`, `[sellerId, distributedAt]`;
- уникальность: `(buyerRequestId, sellerId)`.
- JSONB destinations: evaluated чистой application-логикой после узкой
  кандидат-фильтрации по индексированным полям (не string matching).
  Масштабирование: на текущем объёме (SUBSCRIBED requests × ACTIVE
  capabilities) — достаточно; при росте — future (не спекулятивные ранки).

## Ranking / limits

Ranking/SLA/AI/rating/pay-to-boost — НЕ реализованы (Roadmap: будущая
работа). Детерминированный candidate set без лимитов/порядка (все eligible).

## Buyer-facing semantics

Buyer видит только свой request (2.2B API) — status DRAFT/SUBMITTED/
CANCELLED. Никаких Seller identities/counts/proposals в 2.2C.

## RBAC / mass assignment

- `reverse.match.run` — только ADMIN (системная команда); PARTNER/BUYER →
  403; anonymous → 401;
- `reverse.distribution.read_own` — PARTNER (own inbox); BUYER/staff не имеют;
- matching body: ТОЛЬКО buyerRequestId; forged sellerIds/sellers/sellerId/
  status/matchedAt/distributedAt/rank/score/contactDisclosed/proposalId/version/
  actor/timestamps → 422 (MATCH_RUN_FORBIDDEN_KEYS, loud);
- Seller НЕ может self-match (нет API для создания distribution).

## Audit

Каждый успешный matching run (включая идемпотентный повторный с `created=0`)
пишет `reverse.match.run` в AuditLog (actor, requestCode, categorySlug,
candidates, matched, created, sellerIds) — внутри той же транзакции. Это
НАМЕРЕННО: каждый run — отдельный операционный факт (кто/когда запустил),
а не только первая персистенция. failed run (404/422/stale) НЕ пишет
успешный audit. Durable exclusion rows НЕ хранятся (только положительные
distributions).

## Migration

`20260810223524_add_reverse_distribution` — additive, reverse-owned,
единственный intra-schema FK (distribution→request CASCADE), unique
(buyerRequestId, sellerId), без cross-schema FK, без backfill, без db push;
`migrate status` up to date; drift 0; clean replay — e2e globalSetup.

## Deferred

- Proposal — 2.2D (читает distributions напрямую; Proposal prefix — 2.2D);
- Communication context — 2.2E; conversion — 2.2F (DD-030 hard gate);
- entitlement gate, ranking/SLA, contact disclosure — будущее;
- destination hierarchy — DD-028; Service Templates/Pricing — 1.8A–1.8D;
- automatic trigger/event для matching — 2.2D/2.2E decision.

## Compatibility with Step 2.2D

2.2D получит: детерминированный per-Seller distribution set (unique per
request+seller), Seller-safe projection (без PII/preferences), request.status
для валидации CANCELLED, аудит-след каждого run. Ничего ломать не нужно.
