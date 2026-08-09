# PHASE 1 — STEP 1.13A — STRICT IMPLEMENTATION REVIEW

## 0. Роль и границы

Выполни строгий code / architecture / migration / temporal-semantics review уже реализованного:

**PHASE 1 — STEP 1.13A: TEMPORAL & ANALYTICS READINESS FOUNDATION**

Это review существующей реализации, а НЕ следующий implementation step.

Не переходить к:
- Step 1.13B;
- Step 1.14;
- Step 1.15;
- Phase 2.

Implementation report не считать доказательством. Проверять фактический код, Prisma schema, migration SQL, production create/update paths, seed/reconciliation paths, API DTO/projections, frontend labels, tests, docs и live behavior.

Если подтверждённая проблема локальна и не требует нового architecture decision — исправить её в рамках review fixes.

Если исправление требует изменения domain ownership, canonical lifecycle или roadmap boundaries — вернуть:

`ARCHITECTURE DECISION REQUIRED`

---

# 1. Главные review-риски

Особое внимание четырём изменениям/решениям:

1. `Category.createdAt / updatedAt`.
2. `CategorySchema.activatedAt / deprecatedAt`.
3. Legacy temporal values оставлены `NULL`, без fabricated backfill.
4. `isoUtc` получил production consumer в Buyer Account API.

Нужно доказать, что Step 1.13A действительно повысил temporal readiness и не создал ложную историю или новый скрытый temporal contract.

---

# 2. Prisma schema audit

Проверить фактическую Prisma schema.

## Category

Ожидается additive model:
- `createdAt DateTime?`
- `updatedAt DateTime?`

или эквивалентная nullable semantics для legacy.

Проверить:
- nullable действительно сохранена;
- нет default `now()` для legacy migration, если он фабрикует прошлое;
- нет `@updatedAt`, если это приводит к неявному заполнению legacy row при нерелевантном update без осознанного решения;
- новые production-created Category получают честные timestamps.

## CategorySchema

Проверить:
- `activatedAt DateTime?`
- `deprecatedAt DateTime?`

Проверить отсутствие fake defaults/backfills.

---

# 3. Migration SQL — критический блок

Проверить migration:

`20260809110000_add_temporal_readiness`

или фактическое имя.

Требования:

- additive;
- nullable;
- без destructive changes;
- без `NOW()` historical backfill;
- без копирования `updatedAt` → lifecycle milestone;
- без guessed timestamps;
- deterministic;
- clean replay;
- applied migration не редактировалась после применения;
- `migrate status` clean;
- `migrate diff` no drift.

Если migration присваивает legacy milestones без доказуемого источника — REVIEW FIX REQUIRED.

---

# 4. Legacy NULL semantics

Проверить реальное состояние legacy rows.

Требование:

legacy Category/CategorySchema без доказуемой истории должны оставаться `NULL`.

Не допускается:
- `createdAt = migration execution time`;
- `activatedAt = updatedAt`;
- `activatedAt = createdAt`;
- любое автоматическое guessed значение.

Проверить docs: `NULL` должен быть явно описан как historical unknown / milestone not reconstructable для legacy data.

Если API/UI должен различать "не происходило" и "unknown", проверить, что текущая семантика не делает ложный вывод.

---

# 5. Category create paths — критический блок

Найти ВСЕ production paths, которые создают Category:

- service create;
- seed;
- startup reconciliation, если есть;
- import/repair/admin tooling;
- tests не считать production path;
- direct Prisma production calls;
- scripts/CLI.

Каждый новый Category после Step 1.13A должен получать честные `createdAt` и `updatedAt`.

Не должно быть ситуации:
- основной controller/service ставит timestamps;
- другой production path создаёт Category с `NULL`.

Если есть такой путь — REVIEW FIX REQUIRED.

---

# 6. Category update semantics

Проверить все production update paths Category.

`updatedAt` должен изменяться при реальном Category mutation.

Проверить:
- title/name/metadata update;
- schema-independent update;
- no-op update semantics;
- seed/reconciliation не переписывает `updatedAt` без фактического изменения, если это искажает аналитику.

Определить и задокументировать:
`updatedAt` = время последней реальной entity mutation, а не lifecycle milestone.

---

# 7. CategorySchema activation atomicity

Проверить фактическую transaction boundary.

При DRAFT → ACTIVE:

- status и `activatedAt` одной schema меняются атомарно;
- предыдущая ACTIVE schema, если superseded, получает:
  - status DEPRECATED;
  - `deprecatedAt`;
- оба изменения находятся в одной transaction;
- нет промежуточного состояния с двумя ACTIVE schema;
- failure/rollback не оставляет timestamps без соответствующего status.

Это обязательный proof.

---

# 8. CategorySchema deprecation atomicity

При ACTIVE → DEPRECATED:

- status и `deprecatedAt` меняются в одной transaction/update;
- failed transition не оставляет `deprecatedAt`;
- repeated deprecate имеет deterministic semantics;
- DRAFT → DEPRECATED, если разрешено/запрещено, соответствует documented lifecycle;
- re-activate DEPRECATED → 409, как заявлено.

Проверить concurrency.

---

# 9. Supersede chronology

Проверить сценарий:

Schema v1 ACTIVE  
→ activate v2  
→ v1 DEPRECATED + v1.deprecatedAt  
→ v2 ACTIVE + v2.activatedAt.

Проверить temporal ordering:
- v1.activatedAt <= v1.deprecatedAt;
- v2.activatedAt соответствует transaction transition;
- timestamps не зависят от frontend/client time;
- server/DB time semantics consistent.

Если ordering нельзя строго гарантировать миллисекундно между двумя writes, документировать допустимую equality/ordering semantics.

---

# 10. Repeated lifecycle / history

CategorySchema lifecycle заявлен однонаправленным.

Проверить:
- DEPRECATED → ACTIVE запрещён;
- timestamps не перезаписываются повторными запросами;
- duplicate/retry transition deterministic;
- 409 не изменяет row;
- concurrent activate двух draft versions не создаёт chronology corruption.

Если CAS/transaction недостаточны для concurrency — REVIEW FIX.

---

# 11. Seed semantics

Отчёт говорит:

> seed v1 ACTIVE несёт activatedAt.

Проверить:

- новый seed-created ACTIVE CategorySchema действительно получает `activatedAt`;
- legacy existing ACTIVE schema при reconciliation не получает fake activatedAt, если historical момент неизвестен;
- повторный seed не переписывает activatedAt;
- seed не переписывает Category.createdAt;
- seed/reconciliation не меняет updatedAt без реального mutation.

Это важное различие:
**newly created by seed now** ≠ **legacy row that existed before temporal migration**.

---

# 12. Product temporal regression

Проверить claims:

- Product `publishedAt` только при реальной публикации;
- обычный PATCH не меняет publishedAt;
- PUBLISHED direct PATCH запрещён/идёт через change proposal;
- repeated publish/idempotent behavior не фабрикует новую дату;
- ProductHistory/ModerationSubmission восстанавливают chronology.

Не менять Product temporal model, если bug не найден.

---

# 13. Moderation chronology

Проверить:

- submittedAt;
- reviewStartedAt;
- decidedAt;
- actor;
- snapshot/version;
- previousSubmissionId;
- repeated cycles.

Проверить monotonic chronology там, где это contractually guaranteed.

---

# 14. Storefront temporal regression

Проверить:

- createdAt;
- activatedAt;
- deactivatedAt;
- entitlement transitions через AuditLog;
- ProductPublicationChannel history.

PATCH не должен менять lifecycle timestamps.

Repeated activate/deactivate должен оставлять reconstructable history.

---

# 15. Behavioral event temporal regression

Проверить:

- occurredAt = client event time;
- receivedAt = server processing time;
- UTC;
- skew validation;
- dedup eventId;
- no ordering by auto increment;
- no semantic changes from 1.13A.

---

# 16. Buyer Account `isoUtc` — критический блок

Найти точный production consumer `isoUtc` в account service.

Проверить, какие response fields изменились.

Нужно доказать:

- API contract не поменялся неожиданно;
- Date → ISO string transformation соответствует существующим frontend types;
- нет double serialization;
- `null` остаётся `null`;
- timezone всегда `Z`;
- значения не меняются по смыслу;
- Order.createdAt/Booking.createdAt/serviceDate не получают ложную timezone semantics;
- frontend `formatDate` продолжает работать;
- snapshots/contracts обновлены осознанно.

Если раньше API отдавал Date через Nest JSON serialization в тот же ISO format — зафиксировать, что change contract-neutral.

Если serviceDate является date-only/business-local concept, нельзя молча превращать его в UTC instant без проверки модели.

---

# 17. `isoUtc` utility necessity

Проверить, что helper не существует только ради теста.

Он должен:
- иметь реальный production purpose;
- не дублировать бессмысленно стандартную JSON Date serialization;
- не создавать разные timestamp conventions в разных APIs.

Если helper избыточен, но безвреден — документировать.
Если создаёт inconsistent serialization — REVIEW FIX.

---

# 18. Legacy Order audit

Не реализовывать Step 1.14.

Проверить только честность документации:

- createdAt;
- updatedAt;
- serviceDate;
- OrderHistory;
- existing events.

Не добавлять confirmedAt/cancelledAt/completedAt сейчас.

Проверить, что temporal-readiness doc не называет Order fully canonical, если lifecycle ещё legacy.

Термин `analytics-ready` должен быть осторожным: history-backed ≠ canonical future semantics.

---

# 19. Legacy Booking audit

Проверить:
- createdAt;
- updatedAt;
- serviceDate;
- BookingHistory/events;
- отсутствие request/confirm/cancel dedicated timestamps;
- отсутствие IANA timezone model.

Не внедрять их сейчас.

---

# 20. Legacy Payment audit

Отчёт утверждает отдельной Payment entity нет.

Проверить фактическую schema/codebase.

Если Payment entity/table всё же существует — отчёт требует исправления.

Если есть только `Order.paymentStatus/paidAmount`, убедиться, что:
- они не трактуются как Finance canonical history;
- paidAt не фабрикуется;
- Buyer Payments остаётся controlled empty.

---

# 21. Analytics readiness wording

Проверить `docs/architecture/temporal-readiness.md`.

Особенно формулировку:

> legacy Order/Booking/Payment analytics-ready

Если будущие canonical semantics ещё не существуют, документ должен различать:

- chronology reconstructable for current legacy model;
- canonical analytics-ready for future business model.

Не допустить ложного ощущения, что Finance/Booking temporal foundation уже завершена.

При необходимости исправить wording без изменения architecture.

---

# 22. Temporal source-of-truth matrix

Проверить каждую строку:

`Entity | Business Fact | Source of Truth | Timestamp | Actor | History | Analytics-ready | Gap`

Для каждого business fact source должен реально существовать.

Не принимать:
- AuditLog без нужного payload;
- updatedAt как lifecycle;
- event, который не производится;
- history, которая не содержит actor/time;
- planned future field как current source.

---

# 23. AuditLog vs Domain History vs Events

Проверить, что документ и код не смешивают:

- AuditLog;
- Product/Order/Booking History;
- domain events/outbox;
- behavioral events.

AuditLog не должен автоматически объявляться canonical business history.

Если entitlement chronology опирается на AuditLog, проверить, что payload содержит достаточные from/to + timestamp + actor и что это осознанный current contract.

---

# 24. Temporal invariants

Проверить только применимые invariants.

Например:
- created <= activated;
- activated <= deprecated;
- submitted <= reviewStarted <= decided;
- occurredAt vs receivedAt с допустимым skew.

Не навязывать invariant, если legacy semantics его не гарантируют.

Проверить, что `assertNonDecreasing` реально используется там, где нужен, либо является validation/test helper с понятным назначением.

---

# 25. UTC / DB types

Проверить:

- PostgreSQL column types;
- Prisma DateTime mapping;
- application timezone assumptions;
- ISO serialization;
- test environment timezone independence.

Особое внимание `timestamp without time zone` vs `timestamptz`.

Если текущая schema исторически использует один тип, не делать массовую миграцию без ADR; но задокументировать риск, если он есть.

---

# 26. serviceDate boundary

Проверить все `serviceDate`.

Это может быть:
- date-only;
- local date/time;
- UTC instant.

Не предполагать автоматически.

Если semantics неоднозначна — классифицировать FUTURE STEP/LEGACY UNKNOWN.

Не менять сейчас на IANA timezone model.

---

# 27. Public API privacy

Проверить whitelist timestamps.

Public API не должен начать отдавать:
- moderator actor;
- internal reviewedAt;
- entitlement operational history;
- security timestamps;
- internal audit metadata.

Допустимы только уже обоснованные public timestamps:
- publishedAt;
- memberSince;
- storefront activatedAt;
и другие явно существующие public contract fields.

---

# 28. Frontend labels

Проверить фактические labels:

- published_on;
- updated;
- created;
- service date;
- member since;
- activated.

Не должно быть:
- updatedAt → «опубликовано»;
- createdAt → «оплачено»;
- serviceDate → «дата бронирования», если это дата услуги.

Проверить RU/AZ/EN.

---

# 29. No fake backfill proof

Добавить/проверить test, который на pre-migration-like legacy row доказывает:

- Category.createdAt remains NULL;
- CategorySchema.activatedAt remains NULL;
- migration/reconciliation/startup не заполняют их.

Live manual check полезен, но automated proof предпочтителен.

Если текущий e2e clean DB не моделирует legacy row до migration, добавить targeted migration/SQL test либо безопасный equivalent proof.

---

# 30. Clean migration replay

Проверить:

- fresh DB → all migrations;
- migration status;
- diff;
- no drift;
- no edited applied migration;
- test DB recreation;
- dev DB status.

Если production migration history ещё не существует — всё равно не применять bookkeeping hacks.

---

# 31. Performance/index review

Новые timestamps не требуют index автоматически.

Проверить, что:
- нет unnecessary indexes;
- если CategorySchema lifecycle queries используют status/category/version, существующих indexes достаточно;
- migration не ухудшила hot paths.

---

# 32. Tests — обязательный minimum

## Targeted E2E

1. New Category gets createdAt/updatedAt.
2. Category update advances updatedAt.
3. Legacy Category may remain NULL.
4. New ACTIVE seed schema gets activatedAt.
5. Legacy ACTIVE schema does NOT get fabricated activatedAt.
6. DRAFT schema activate → status + activatedAt.
7. Superseded ACTIVE → DEPRECATED + deprecatedAt atomically.
8. Explicit deprecate → deprecatedAt.
9. Re-activate deprecated → 409 and timestamps unchanged.
10. Concurrent activation does not corrupt lifecycle.
11. Product publishedAt regression.
12. Moderation chronology.
13. Storefront lifecycle regression.
14. Behavioral occurredAt/receivedAt regression.
15. Buyer Account isoUtc contract.
16. Legacy Order/Booking no fabricated milestones.
17. Buyer Payments remains controlled empty.
18. Public DTO temporal leakage check.

## Unit

Проверить temporal helpers, UTC, null semantics и applicable invariants.

---

# 33. Full regression

Backend:
- `tsc --noEmit`;
- unit;
- temporal-readiness e2e;
- category-schema;
- public-catalog;
- moderation;
- change-proposal;
- product-media;
- partner-onboarding;
- seller-identity;
- storefront;
- storefront-behavioral;
- buyer-identity;
- buyer-cabinet;
- auth/RBAC;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

Migration:
- clean replay;
- status;
- diff/no drift.

---

# 34. Browser/live verification

Минимум:

A. Category create/update через реальный admin flow/API.  
B. CategorySchema activate.  
C. Supersede ACTIVE schema.  
D. Verify timestamps DB/API.  
E. Product published date unchanged by unrelated operations.  
F. Buyer Order/Booking dates render correctly after isoUtc.  
G. RU/AZ/EN labels semantically correct.  
H. Public Product/Storefront DTO does not leak internal timestamps.  
I. Console errors = 0 for touched frontend flows.

Не создавать fake production data без cleanup.

---

# 35. Review outcome

Если всё корректно:

`PHASE 1 STEP 1.13A REVIEW PASSED — WAITING FOR APPROVAL`

Если найдены подтверждённые проблемы — исправить только их и вернуть:

`PHASE 1 STEP 1.13A REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Каждый fix оформить:

`FIX N — <название>`

с:
- problem;
- risk;
- root cause;
- files;
- fix;
- tests;
- regression result.

Если требуется изменение architecture:

`ARCHITECTURE DECISION REQUIRED`

и остановиться.

---

# 36. Финальный review report

Вернуть:

# PHASE 1 — STEP 1.13A — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Files/modules inspected
3. Prisma temporal schema
4. Migration SQL review
5. Legacy NULL semantics
6. Category create paths
7. Category update semantics
8. CategorySchema activation atomicity
9. Supersede/deprecation chronology
10. Concurrency/idempotency
11. Seed/reconciliation semantics
12. Product temporal regression
13. Moderation temporal regression
14. Storefront temporal regression
15. Behavioral temporal regression
16. Buyer isoUtc/API contract
17. Legacy Order assessment
18. Legacy Booking assessment
19. Legacy Payment assessment
20. Analytics-readiness wording
21. Source-of-truth matrix verification
22. UTC/DB types
23. serviceDate boundary
24. Public privacy
25. Frontend labels RU/AZ/EN
26. No-fake-backfill proof
27. Performance/indexes
28. Unit tests
29. E2E tests
30. Full regression
31. Migration status/drift
32. Browser/live verification
33. Issues/fixes
34. Remaining temporal debt
35. Architecture decision status
36. Out-of-scope confirmation

Не переходить к Step 1.13B / 1.14 / 1.15 / Phase 2.

Финальная строка:

`PHASE 1 STEP 1.13A STRICT REVIEW COMPLETED — WAITING FOR APPROVAL`
