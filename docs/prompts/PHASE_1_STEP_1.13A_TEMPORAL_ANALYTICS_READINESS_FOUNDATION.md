# PHASE 1 — STEP 1.13A: TEMPORAL & ANALYTICS READINESS FOUNDATION

## 0. Контекст

Step 1.13 APPROVED.

Этот Step выполняется ДО:
- Step 1.13B Marketplace Behavioral Events;
- Step 1.14 Canonical Order Events;
- Step 1.15 Correlation / Request ID Infrastructure;
- Phase 2 commercial flow.

Уже реализованы и должны остаться authoritative:
- Product lifecycle/moderation;
- Public Catalog;
- Partner/Buyer identity;
- Partner onboarding;
- PublicSellerProfile;
- Storefront lifecycle + entitlement;
- Product publication channels;
- Storefront behavioral events;
- Buyer Cabinet;
- существующие audit/history/outbox/event contracts.

Цель Step 1.13A — **не создать новые бизнес-процессы**, а сделать существующую платформу пригодной для дальнейшей аналитики и восстановления фактической хронологии.

---

# 1. Главная цель

Провести полный temporal audit существующих business entities и lifecycle.

Для каждого существенного объекта ответить:

1. Когда объект создан?
2. Когда изменён?
3. Какие lifecycle transitions уже существуют?
4. Для каких transitions есть отдельный timestamp?
5. Для каких transitions история восстанавливается только из AuditLog/History/Event?
6. Где `updatedAt` ошибочно используется или потенциально может использоваться как business timestamp?
7. Где хронология сейчас невосстановима?
8. Какие минимальные timestamps/history нужны ДО Phase 2, чтобы не потерять аналитику?

Не добавлять timestamps «на всякий случай». Только поля с доказанной бизнес-семантикой.

---

# 2. Обязательный аудит сущностей

Минимально пройти:

## Catalog / Product
- Product
- ProductDraft
- ProductHistory
- ProductMedia
- Category / CategorySchema
- ModerationDecision / ChangeProposal
- PublicSellerProfile / Proposal
- PartnerStorefront
- StorefrontMedia
- ProductPublicationChannel
- StorefrontBehavioralEvent

## Security / Identity
- User
- Buyer registration/account
- PartnerApplication / PartnerApplicationHistory
- role/status changes
- account/profile changes

## CRM
- Customer
- Partner
- Buyer ↔ Customer mapping-related audit
- Partner approval create/link events

## Existing commercial legacy entities
- Order
- Booking
- Payment
- Passenger/Traveler, если существует
- Review, если существует и уже участвует в runtime
- Documents/Chat fragments — только audit, без canonicalization

Не объявлять legacy-модель canonical только ради temporal audit.

---

# 3. Temporal taxonomy

Разделить типы времени.

## Entity time
- `createdAt`
- `updatedAt`

## Lifecycle time
Например:
- `submittedAt`
- `reviewStartedAt`
- `approvedAt`
- `rejectedAt`
- `publishedAt`
- `archivedAt`
- `activatedAt`
- `deactivatedAt`
- `cancelledAt`
- `completedAt`

Только там, где transition реально существует сейчас.

## Event time
- `occurredAt`

## Processing time
При необходимости:
- `receivedAt`
- `processedAt`

Не смешивать эти категории.

---

# 4. Ключевое правило updatedAt

`updatedAt` НИКОГДА не является заменой:
- publishedAt;
- approvedAt;
- rejectedAt;
- submittedAt;
- cancelledAt;
- completedAt;
- paidAt;
- confirmedAt;
- service time;
- behavioral occurredAt.

Если текущий UI/API использует updatedAt с подобной label/семантикой — это REVIEW/FIX issue.

---

# 5. Product temporal contract

Проверить текущую модель Product.

Минимально должны быть восстановимы:
- created;
- submitted to moderation;
- review started;
- approved/rejected/request changes;
- published;
- archived/unpublished, если существует;
- material change proposal lifecycle.

Если `publishedAt` уже существует — проверить:
- ставится только при реальной публикации;
- не перезаписывается обычным PATCH;
- повторная публикация имеет понятную историю;
- archive не стирает published history.

Если transition history уже надёжно хранится в ProductHistory/ModerationDecision, не дублировать все timestamps колонками без необходимости.

---

# 6. Moderation temporal contract

Должны быть восстановимы:
- submission time;
- review start;
- decision time;
- decision type;
- actor;
- version/snapshot;
- repeated moderation cycles.

Нельзя иметь только «текущий moderationStatus + updatedAt».

Проверить chronology N → N+1 ProductDraft.

---

# 7. Media temporal semantics

Проверить:
- upload/create time;
- publish/approval time, если media имеет lifecycle;
- replace/delete/staged transitions;
- primary/reorder history, если бизнес-аналитика этого требует.

Не создавать лишние columns, если ProductHistory/AuditLog уже даёт точную immutable chronology.

---

# 8. Seller / Partner temporal contract

Проверить:
- Partner registration;
- application created;
- submitted;
- review started;
- approved/rejected/request changes;
- CRM Partner created/linked;
- User.partnerId linked;
- seller profile created;
- seller proposal submitted/reviewed/approved/hidden;
- Storefront created/activated/deactivated;
- entitlement transitions.

Хронология должна быть восстановима по timestamps/history/audit/events.

---

# 9. Buyer temporal contract

Проверить:
- User registeredAt/createdAt;
- Customer create/link;
- account/profile updates;
- activation/deactivation.

Не создавать purchase timestamps здесь — это future Order/Booking/Payment domain.

---

# 10. Storefront temporal contract

Уже должны существовать:
- createdAt;
- updatedAt;
- activatedAt;
- deactivatedAt;
- entitlement transition audit;
- Product channel history.

Проверить:
- activate/deactivate timestamps не перезаписываются обычным PATCH;
- repeated lifecycle transitions восстанавливаются из history/audit;
- current column + history вместе не противоречат;
- SUSPENDED/EXPIRED entitlement chronology не теряется.

---

# 11. Behavioral event temporal contract

Проверить Step 1.12.3:
- `occurredAt`;
- `receivedAt`;
- UTC;
- skew validation;
- dedup eventId;
- event order не зависит от auto-increment;
- session/source/locale preserved.

Не менять behavioral semantics без подтверждённого бага.

---

# 12. Legacy Order temporal audit

ВАЖНО: не начинать Step 1.14/Phase 2.

Проверить только то, что уже существует.

Определить:
- какие timestamps есть;
- что они реально означают;
- какие lifecycle transitions существуют;
- где current status не имеет отдельной истории;
- где `createdAt` единственный честный timestamp;
- где `serviceDate` — service data, а не order lifecycle time.

Не добавлять будущие:
- submittedAt;
- confirmedAt;
- fulfilledAt;
- closedAt

если соответствующие canonical transitions ещё не реализованы.

Вместо этого задокументировать GAP для Step 2.x / Step 1.14.

---

# 13. Legacy Booking temporal audit

Проверить:
- createdAt;
- serviceDate;
- существующие status transitions;
- наличие/отсутствие request/confirm/cancel timestamps;
- отсутствие IANA timezone/serviceStartsAt/serviceEndsAt.

Не внедрять future Booking temporal model сейчас.

Зафиксировать GAP для Step 2.8A / 2.9A.

---

# 14. Legacy Payment temporal audit

Проверить:
- createdAt;
- status;
- provider timestamps, если есть;
- paid/completed/failure time, если реально моделируется;
- что нельзя восстановить.

Не создавать Finance canonical timestamps раньше Step 2.10C / 2.12.

Не объявлять legacy Payment authoritative Finance.

---

# 15. Timestamp vs History decision rule

Для каждого transition выбрать один из допустимых вариантов:

### A. Column timestamp
Если current-state entity реально нуждается в быстром/authoritative timestamp текущего milestone.

### B. Immutable History/Event
Если transition может повторяться и нужна полная chronology.

### C. Both
Если нужен current milestone timestamp + полная история.

Не дублировать хаотично.

Пример:
- Storefront `activatedAt` + audit history повторных activate/deactivate;
- Product `publishedAt` + ProductHistory/Moderation history.

---

# 16. Actor / source / context

Для каждого существенного lifecycle fact по возможности должны быть восстановимы:
- who/actor;
- entity;
- transition;
- occurredAt;
- source/channel, если это уже известно;
- correlation/request context — только если infrastructure уже есть.

Не реализовывать Step 1.15 correlation infrastructure сейчас.

---

# 17. AuditLog vs Domain History vs Event

Разделить:

## AuditLog
Security/operational audit: кто что изменил.

## Domain History
Business lifecycle chronology конкретного aggregate.

## Domain Event
Cross-domain integration fact.

## Behavioral Event
Visitor/user interaction.

Не использовать один механизм как универсальную замену остальных.

---

# 18. Analytics readiness matrix

Создать документ/таблицу минимум:

| Entity | Business Fact | Source of Truth | Timestamp | Actor | History | Analytics-ready | Gap |
|---|---|---|---|---|---|---|---|

Минимальные entities:
- Product
- Moderation
- ProductMedia
- PartnerApplication
- CRM Partner link
- PublicSellerProfile
- Storefront
- Entitlement
- ProductPublicationChannel
- StorefrontBehavioralEvent
- Buyer/User
- CRM Customer
- legacy Order
- legacy Booking
- legacy Payment

Не создавать BI/dashboard.

---

# 19. Temporal consistency checks

Проверить invariants, где применимо:

- createdAt <= submittedAt
- submittedAt <= reviewStartedAt
- reviewStartedAt <= decisionAt
- approvedAt <= publishedAt
- createdAt <= activatedAt
- activatedAt <= deactivatedAt для конкретного lifecycle cycle, если current columns это означают
- occurredAt <= receivedAt + допустимый skew
- timestamps not in impossible future

Не применять invariant к полям, которых semantics не гарантируют.

---

# 20. UTC / timezone discipline

Проверить:
- DB column types;
- Prisma mappings;
- backend serialization;
- frontend formatting.

System/business event timestamps должны быть однозначными UTC instants.

Отдельно не смешивать с future service-local time.

Не реализовывать IANA service timezone model сейчас, но зафиксировать, где legacy `serviceDate` недостаточен.

---

# 21. API contract review

Проверить public/internal/account APIs:
- не отдают misleading timestamp names;
- не называют updatedAt «published», «paid», «confirmed»;
- public DTO не раскрывает unnecessary audit internals;
- timestamps ISO/consistent.

Если rename breaking — не ломать contract без migration strategy; можно добавить correct explicit field и deprecate misleading one только при необходимости.

---

# 22. Frontend review

Проверить:
- Product dates;
- Seller/Storefront dates;
- Buyer Order/Booking dates;
- moderation dates;
- any dashboard/table labels.

Исправить только реально misleading labels.

Не добавлять новые timelines/charts.

---

# 23. Data migration strategy

Если добавляются timestamp columns:

- migration должна быть additive/safe;
- backfill только если значение можно доказать;
- **не угадывать historical time из updatedAt**;
- если прошлое значение неизвестно → NULL;
- никакого `NOW()` backfill для исторического milestone без основания;
- deterministic migration;
- clean replay;
- no db push.

Если timestamp можно восстановить из immutable history/event — backfill разрешён только с доказуемым mapping и тестом.

---

# 24. Null semantics

Для milestone timestamps `NULL` означает:
- milestone ещё не происходил;
ИЛИ
- historical value unknown для legacy data.

Если эти два значения критически различаются, не притворяться, что NULL одинаков по смыслу — задокументировать migration limitation или использовать history/source marker.

Не придумывать fake timestamps.

---

# 25. Repair/backfill commands

Если legacy data требует temporal reconstruction:
- не делать startup backfill;
- explicit one-time repair/migration command;
- dry-run/report;
- idempotent;
- audit;
- no guessing;
- test/dev first.

Не создавать repair, если он не нужен.

---

# 26. Performance / indexes

Если добавляются часто используемые timestamp fields:
- оценить indexes для publishedAt/status+time/occurredAt;
- не индексировать всё подряд;
- behavioral indexes уже не дублировать без причины.

Проверить query plans только для реально критичных list/filter paths.

---

# 27. Security/privacy

Temporal metadata тоже может быть sensitive.

Не публиковать:
- internal review actor IDs;
- internal admin activity;
- security status history;
- hidden operational timestamps

через public API без product need.

Public timestamps только whitelisted:
- например publishedAt/memberSince/activatedAt, если уже part of contract.

---

# 28. No new business lifecycle

Строго запрещено в этом Step:
- создавать новый Order lifecycle;
- BookingRequested;
- Payment lifecycle;
- Refund;
- Settlement;
- Payout;
- Support lifecycle;
- Documents lifecycle;
- Partner CRM lifecycle.

Temporal audit не является разрешением реализовать future domain process.

---

# 29. Deferred Decisions

Не реализовывать DD-001…DD-020.

Если audit обнаружит новый вопрос, который нельзя решать сейчас:
- candidate `DD-021+`;
- не редактировать Deferred Decisions Map без отдельного решения.

---

# 30. Required tests

## Unit
- timestamp transition helpers;
- temporal invariants;
- mapping/history helpers;
- UTC serialization;
- null semantics where applicable.

## E2E
Проверить минимум:
1. Product create timestamp;
2. submit timestamp/history;
3. moderation start/decision chronology;
4. publish timestamp;
5. Product PATCH не меняет publish timestamp;
6. repeat moderation chronology;
7. PartnerApplication chronology;
8. seller profile chronology;
9. Storefront lifecycle timestamps;
10. entitlement audit timestamp;
11. channel history timestamp;
12. behavioral occurredAt/receivedAt;
13. Buyer registration/customer link chronology;
14. legacy Order uses only honest timestamps;
15. legacy Booking uses only honest timestamps;
16. no fake Payment milestone timestamp;
17. public DTO leakage check;
18. migration/backfill correctness if schema changes.

---

# 31. Full regression

Backend:
- `tsc --noEmit`;
- unit;
- public catalog;
- moderation;
- change proposal;
- product media;
- partner onboarding;
- seller identity;
- storefront;
- storefront behavioral;
- buyer identity;
- buyer cabinet;
- auth/RBAC;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

Migration:
- clean test DB;
- migrate deploy;
- status;
- diff/no drift.

---

# 32. Documentation output

Создать/обновить temporal readiness document, например:

`docs/architecture/temporal-readiness.md`

Минимум:
- taxonomy;
- source-of-truth matrix;
- current gaps;
- fields added;
- fields intentionally NOT added;
- legacy limitations;
- future owner Step for each gap.

Не создавать новый ADR, если решение не меняет architecture ownership.

---

# 33. GAP classification

Каждый найденный gap классифицировать:

### FIX NOW
Потеря истории уже происходит в существующем lifecycle.

### FUTURE STEP
Timestamp относится к ещё не реализованному lifecycle.

### LEGACY UNKNOWN
Историческое значение невозможно восстановить честно.

### NO GAP
History/event already sufficient.

Это обязательная часть отчёта.

---

# 34. Architecture decision triggers

Вернуть `ARCHITECTURE DECISION REQUIRED`, если потребуется:

- перенос ownership temporal history между доменами;
- новый shared event store;
- переписывание AuditLog в domain history;
- изменение canonical lifecycle semantics;
- cross-domain write ради timestamp;
- создание Finance/Order/Booking lifecycle раньше roadmap.

---

# 35. Definition of Done

Step завершён, если:

- полный temporal audit выполнен;
- существующие lifecycle facts не теряют chronology;
- `updatedAt` не используется как business milestone;
- только необходимые timestamp/history fixes сделаны;
- fake historical backfill отсутствует;
- legacy unknowns честно обозначены;
- UTC semantics проверена;
- public/private temporal boundaries соблюдены;
- analytics readiness matrix создана;
- будущие Order/Booking/Finance gaps назначены future Steps;
- никаких новых business lifecycles;
- regression green;
- Step 1.13B/1.14/Phase 2 не начаты.

---

# 36. Формат отчёта

Вернуть:

# PHASE 1 — STEP 1.13A — ОТЧЁТ

1. Current → Target
2. Temporal taxonomy
3. Entities audited
4. Analytics readiness matrix
5. Product temporal findings
6. Moderation temporal findings
7. Media temporal findings
8. Partner/onboarding findings
9. Seller identity findings
10. Storefront findings
11. Behavioral event findings
12. Buyer/Customer findings
13. Legacy Order findings
14. Legacy Booking findings
15. Legacy Payment findings
16. FIX NOW changes
17. FUTURE STEP gaps
18. LEGACY UNKNOWN gaps
19. Timestamp/history decision matrix
20. UTC/timezone review
21. API/frontend timestamp review
22. Migration/backfill strategy
23. Security/privacy
24. Index/performance
25. Unit tests
26. E2E tests
27. Full regression
28. Migration status
29. Docs changes
30. Deferred Decision candidates
31. Issues found
32. ARCHITECTURE DECISION REQUIRED
33. Out-of-scope confirmation

Не переходить к Step 1.13B / 1.14 / Phase 2.

Финальная строка:

`PHASE 1 STEP 1.13A COMPLETED — WAITING FOR REVIEW`
