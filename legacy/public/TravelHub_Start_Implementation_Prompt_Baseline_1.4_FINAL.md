# TRAVELHUB — START IMPLEMENTATION PROMPT — BASELINE 1.4 FINAL

Источник истины: `TravelHub_Architecture_Master_Baseline_1.4_Final_Corrected.docx`.
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
