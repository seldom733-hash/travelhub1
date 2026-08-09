# TRAVELHUB — START IMPLEMENTATION PROMPT — BASELINE 1.4 FINAL

Источник истины: `TravelHub_Architecture_Master_Baseline_1.6_Marketplace_Payments_Final.docx`.
Перед работой прочитай Master и весь комплект `TravelHub_Prompts_Baseline_1.4_FINAL`.

## Режим старта

Сначала только PHASE 0 AUDIT. Не изменяй код, БД, migrations, dependencies или UI до отдельного approval.

Проведи repository/backend/database/frontend/RBAC/events gap-analysis и закончи:
`PHASE 0 AUDIT COMPLETED — WAITING FOR IMPLEMENTATION APPROVAL`.

## Замороженные invariants

Не менять без ADR: domain ownership, lifecycle, ID policy, event contracts, RBAC, Sales/Order/Booking boundaries, Finance/Settings ownership, OrderTraveler/Passenger, Marketplace flow.

Canonical flow:
`Lead → Opportunity → Quote → Sale → OrderRequested → Order → OrderReadyForBooking → BookingRequested → Booking → Fulfillment → Order Closed`.

`OrderApproved != Create Booking`. Booking создается штатно только через `BookingRequested`.

## Legacy mapping

Существующие `Payout`, `Review`, `ChatRoom`, `ChatMember`, `Message`, `TourMedia`, `StripeEvent` и любые иные current entities без прямого target mapping НЕ создают автоматически новый домен.

Для каждой выбери: `KEEP`, `RENAME`, `SPLIT`, `MERGE`, `MAP_TO_EXISTING_DOMAIN`, `TECHNICAL_RECORD`, `READ_MODEL`, `DEPRECATE` или `ARCHITECTURE_DECISION_REQUIRED`.

При неоднозначном ownership — только `ARCHITECTURE DECISION REQUIRED`.
Legacy ID нельзя переинтерпретировать как ID другой canonical entity. При конфликте: сохранить `legacyId`, создать `canonicalId`, спроектировать migration mapping и перенос references.

## Order number

`ORD-*` — immutable canonical business ID.
`TH-YYYY-######` — human-readable unique number.
`YYYY` = `Order.createdAt` year в UTC.
`######` = atomic sequence within year.
Обязателен `UNIQUE(Order.number)`.
Idempotency/deduplication `OrderRequested` проверяется до создания Order и выделения номера.

## Bootstrap

`POST /orders/bootstrap` допустим только как Phase 1 scaffolding.
После успешного Phase 2 и ввода `OrderRequested` flow endpoint ОБЯЗАТЕЛЬНО удалить.
Не оставлять его как ADMIN/import/integration exception.
Будущий import/admin-create — только отдельная утвержденная command/API с отдельным permission, reason/source/correlationId, idempotency и audit.


## Marketplace/Catalog invariants

- `/` — Public Marketplace для anonymous user; `/app/*` — internal work centers.
- Один `Catalog.Product` используется для всех типов туристических услуг.
- Category schema управляет специфическими атрибутами, фильтрами, availability, Tariff/Option, media requirements и секциями Product Detail Page.
- Product media принадлежит Catalog; отдельный новый media domain не создавать.
- PARTNER управляет только собственными draft Product/media.
- MODERATOR review/approve/reject/request changes, но не редактирует Product content за PARTNER.
- Draft/unpublished media никогда не появляется в public read.
- Существенные изменения опубликованного Product/media проходят повторный разрешенный moderation/publish transition.
- Product Detail Page и media gallery являются обязательным публичным контуром.



## Finance marketplace invariants

- `Payment != Payout`.
- Preferred settlement mode: `SPLIT_AT_PAYMENT` when PSP capability permits.
- Supported fallback modes: `PLATFORM_COLLECT`, `PARTNER_COLLECT`.
- PaymentTerms: FULL_PREPAYMENT, PARTIAL_PREPAYMENT, DEPOSIT, PAY_LATER, PAY_AT_SERVICE.
- ProviderFee != TravelHub Commission.
- Settlement and immutable LedgerTransaction are Finance-owned.
- PARTNER_COLLECT creates CommissionAccrual/receivable.
- Buyer card PSP and Partner bank payout provider may be different adapters.
- Never hardcode Stripe/Adyen as Finance domain entities.

## Backend

HTTP/backend framework: **NestJS**. Сохраняй существующий HTTP adapter; если используется Express, не переходи на Fastify без ADR.

Tests:
- Jest — unit/integration;
- Jest + Supertest — HTTP e2e;
- e2e обязателен для каждого применимого Definition of Done;
- e2e через реальный Nest application;
- отдельная PostgreSQL test DB/schema + реальные migrations;
- Redis/outbox/inbox/event infrastructure реально используется там, где тестируется event flow;
- внешние providers можно стабить на boundary;
- собственную доменную цепочку нельзя мокать в e2e, который должен ее доказать.

## Phase 0 output

Обязательно выдай:
1. Executive Summary
2. Current Architecture
3. Target Architecture
4. Repository Structure
5. Existing Domain Mapping
6. Database Analysis
7. Backend Analysis
8. Frontend Analysis
9. Auth/RBAC Analysis
10. Event Architecture Analysis
11. GAP Matrix
12. Architecture Violations
13. Database Migration Map
14. API Migration Map
15. Frontend Migration Map
16. Existing Features To Preserve
17. Risks
18. Technical Debt
19. Phase 1 Implementation Plan
20. Decisions Required
21. Recommended First Implementation Task

Для каждого факта указывай конкретные files/classes/entities/tables/controllers/methods/routes/DTO/status columns. Не выдумывай отсутствующий код: используй `NOT FOUND`.

Финальная строка строго:
`PHASE 0 AUDIT COMPLETED — WAITING FOR IMPLEMENTATION APPROVAL`


## Marketplace/Catalog mandatory implementation contract

- `/` = Public Marketplace for anonymous users.
- Implement Marketplace Home, Search/Category Results, Product Detail Page and Checkout entry.
- Product is universal; category schema drives category-specific fields/filters/PDP.
- Implement canonical service category seed/config from Master.
- Partner Product editor must support photo multi-upload, primary image, ordering, caption/alt, replace/delete, validation, optimization/thumbnails and moderation/publish boundary.
- Public product cards show photo, short description and price; PDP shows full published content.
- Do not create Order or Booking directly from Marketplace/Catalog.
