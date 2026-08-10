# Reverse Marketplace — Buyer Request Foundation (Step 2.2B)

**Status:** Implementation completed — waiting for Strict Review (Phase 2)
**Owner:** Reverse Marketplace (`reverse.*`, ADR-0012)
**Prerequisite:** Step 2.2A Strict Review APPROVED WITH REVIEW FIXES

## Purpose

Demand-led entry point: Buyer описывает, что хочет купить, без выбора
опубликованного Marketplace-предложения.

> Buyer хочет отель в Турции на конкретные даты/состав гостей. Buyer создаёт
> request. Request принадлежит `reverse.*`. НЕ распределяется/matched в 2.2B.
> НЕ создаёт Lead/Opportunity/Quote/Sale/Order/Booking автоматически.

## Ownership

`BuyerRequest → reverse.*` (ADR-0012). НЕ Sales/CRM/Catalog/Communication/
Order/Booking. Cross-context reads — только trusted refs по ID (ADR-0001):
crm.Customer (buyerId), catalog.Category (categoryId). Никаких cross-context
writes.

## Schema / model (`reverse.*`)

- `reverse.BuyerRequest`:
  - `code` BRQ-00000001 (IdsService, атомарный счётчик; финальная регистрация
    2.2B в ids.md);
  - `buyerId` — crm.Customer ref (без FK), ВСЕГДА из `actor.customerId`;
  - `categoryId`/`categorySlug` — ref на catalog.Category (Catalog владелец
    taxonomy; редактируется в DRAFT — черновик Buyer-а);
  - `destinations` JSONB — та же структурная representation, что у capability
    (НЕ выводится из home/legal location Buyer);
  - `serviceDateFrom`/`serviceDateTo` — date-only (YYYY-MM-DD → UTC midnight),
    не в прошлом, from <= to; оба nullable = открытые даты; НЕ timezone/
    time-slot (2.8A);
  - `adults/children/infants` — PAX-минимум, без PII (adults >= 1);
  - `budget` JSONB — НЕ-binding demand hint `{currency, min?, max?}`;
  - `preferences` JSONB — free-form demand hints (размер/contact-ключи
    ограничены — PII-minimal);
  - `acquisitionSource` — серверный, всегда `BUYER_REQUEST`;
  - `status` DRAFT/SUBMITTED/CANCELLED (MATCHED/DISTRIBUTED — 2.2C;
    Proposal — 2.2D; conversion — 2.2F);
  - `version` CAS; `createdBy`; `createdAt/updatedAt/submittedAt/cancelledAt`;
  - индексы: `[buyerId]`, `[buyerId, status]`, `[status, categoryId]`,
    `[status, createdAt]`.
- `reverse.BuyerRequestHistory` — audit by default (created/updated/submitted/
  cancelled — actor, from/to, fields), каскад, без контактного PII.

## Lifecycle

`DRAFT → SUBMITTED → CANCELLED` (+ DRAFT → CANCELLED). Update только в DRAFT
(SUBMITTED/CANCELLED — frozen, 422). No-op при том же состоянии (без
мутации/версии). Submit на CANCELLED → 422. submittedAt/cancelledAt — реальные
переходы (UTC), НЕ updatedAt.

## Buyer own-scope

Все операции — серверный `actor.customerId` (JWT). Buyer не может прочитать/
мутировать чужой request (neutral 404, анти-энумерация); forged
buyerId/customerId/ownerId/status/version/source/temporal → 422; BRQ-code/
UUID-guessing не даёт доступа.

## RBAC / permissions

- `reverse.request.read_own` / `reverse.request.write_own` — только BUYER
  (strict role-gate, как Buyer Cabinet: даже ADMIN/PARTNER → 403);
- PARTNER/Seller НЕ получает доступа к Buyer Requests (только после
  server-authoritative distribution 2.2C);
- anonymous → 401; BUYER без customerId (unmapped) → 403.

## API (buyer-own, `/api/v1/buyer/requests`)

| Метод | Путь | Право |
|---|---|---|
| GET | `/` (limit/offset) | `reverse.request.read_own` |
| POST | `/` | `reverse.request.write_own` |
| GET | `/:id` | `reverse.request.read_own` |
| GET | `/:id/history` | `reverse.request.read_own` |
| PATCH | `/:id` (DRAFT only) | `reverse.request.write_own` |
| POST | `/:id/submit` | `reverse.request.write_own` |
| POST | `/:id/cancel` | `reverse.request.write_own` |

Нет seller inbox, matching, distribution, proposal, chat, conversion endpoints.

## Mass assignment

`REQUEST_CREATE/UPDATE_FORBIDDEN_KEYS`: id/code/buyerId/customerId/ownerId/
status/version/acquisitionSource/source/createdBy/timestamps/categorySlug/
matchedSellerIds/distributionState/sellerIds/correlationId/causationId/
entitlementStatus → 422. CategoryId в PATCH разрешён (draft-редактирование).

## Acquisition source

`BUYER_REQUEST` — канонический source, server-owned (клиент не передаёт;
forged → 422). Будущая конвертация 2.2F обязана сохранить его через
canonical Sales → Order pipeline (ADR-0007; SalesAcquisitionSource enum).

## Privacy / PII

`BuyerRequest существует ≠ Seller видит контакты Buyer`. В 2.2B distribution
нет вообще. Request/history/audit содержат только коммерческие demand-факты;
preferences reject contact-ключи (email/phone/whatsapp/telegram/social/url/
passport + word-boundary contact/document/wa/tel/mail/mobile) **на любой
глубине вложенности** (включая ключи объектов внутри массивов; глубина ≤ 6).
Никаких passport/документов/birth dates.

**Честная граница (не DLP-движок):** сканируются структурные ключи, НЕ
значения. Свободный текст `{ note: "позвоните +994..." }` не детектируется —
это задокументированное ограничение (полноценный content-DLP — отдельное
продуктовое решение, не 2.2B). Двухуровневый скан без false positives:
`travelStyle`/`automobile`/`roomNumber`/`contactlessCheckin` проходят
(e2e #27). Раскрытие preferences Seller-ам — решение 2.2E/2.2F, не 2.2B.

## CAS / concurrency

CAS через `version`: stale → 409; concurrent update → один победитель;
submit-vs-update и cancel-vs-submit — детерминированные races (один 200/201,
другой 409); no-op не мутирует версию/history; duplicate lifecycle milestones
невозможны (CAS + статус-переходы).

## Duplicate / idempotency

Отдельные легитимные запросы НЕ дедуплицируются по равенству полей (скрытого
heuristic нет). HTTP create-идемпотентность не гарантируется (нет
idempotency-key; не требуется Roadmap'ом — документировано). Lifecycle-команды
— no-op/409 по конвенции.

## Failure atomicity

Создание/мутация — в одной транзакции (row + history + audit); failed
(validation/CAS/lifecycle/foreign) → полный rollback, без partial state
(e2e #29).

## Events

События НЕ эмитятся (нет consumer в 2.2B; matching-trigger — 2.2C, решение об
event при реализации 2.2C). No event is preferable to speculative events.

## No matching / No Seller access / No Proposal / No conversion

2.2C (matching/distribution), 2.2D (Proposal), 2.2E (Communication), 2.2F
(conversion, gate DD-030) — НЕ реализованы; DD-030 НЕ разрешён.

## Catalog / Product isolation

Создание request НЕ создаёт Product/Tariff/Availability и НЕ требует
существования Product (zero-Product request легален — e2e #4/5/6). Category
валидируется read-by-ID (существует + ACTIVE).

## Migration

`20260810210149_add_reverse_buyer_requests` — additive, в schema reverse,
единственный intra-schema FK (history→request), без cross-schema FK, без
backfill, без db push; `migrate status` 32 up to date; drift 0; fresh replay
доказан e2e globalSetup.

## IDs

`BRQ-*` зарегистрирован в `docs/contracts/ids.md` (финальная регистрация в
точке реализации 2.2B). Proposal prefix НЕ изобретён (2.2D).

## PAX category-neutrality (review assessment)

`adults >= 1` (default 1) — универсальный travel-минимум, доказанный от
repository truth: все 18 ACTIVE категорий каталога — travel-услуги с минимум
одним путешественником/драйвером/гостем (accommodation, transfers, car-rental,
flights, visa-services, tickets-events, ...). PAX опционален в запросе
(default 1) — легитимный car-rental/transfer request не блокируется.
Category-specific PAX-семантика (напр. для tickets-events) — вопрос Service
Templates (1.8A–1.8D, DD-028), вне 2.2B. PAX — demand-контекст, не цена.

## Destination source

Destinations описывают ТОЛЬКО желаемую локацию услуги; НЕ выводятся из
home/legal location Buyer. Buyer identity в системе не содержит country/city
(Step 1.9 registration без географии) — хранение/возврат destinations ровно
как передано+нормализовано (e2e #3: TR/ANTALYA возвращены как передано).

## Deferred

- Matching/distribution — 2.2C (включая event-trigger decision);
- Seller Proposal — 2.2D; Communication context — 2.2E;
- Proposal→Sales conversion — 2.2F (DD-030 hard gate);
- destination hierarchy / Service Templates / Pricing — DD-028, 1.8A–1.8D;
- HTTP create-идемпотентность — future (нет idempotency-key сегодня).

## Compatibility

2.2C сможет детерминированно выбирать candidate requests по
`status = SUBMITTED` + `[status, categoryId]` + `[status, createdAt]` —
без изменения 2.2B-модели; acquisitionSource уже персистится для 2.2F.
