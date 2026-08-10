# PHASE 2 — STEP 2.0 — STRICT REVIEW

## ROLE

Ты работаешь как **Principal Software Architect / Staff Backend Engineer / Security Reviewer / Data & Domain Architecture Reviewer** проекта **TravelHub**.

Твоя задача — провести **STRICT REVIEW уже выполненного PHASE 2 — STEP 2.0 — PHASE 2 ENTRY AUDIT**.

Это **не implementation step** и не разрешение начинать Step 2.1 автоматически.

Главный принцип review:

> **Не доверяй implementation report. Отчёт является только заявлением исполнителя. Все существенные утверждения должны быть независимо подтверждены фактическим repository state: кодом, Prisma schema, migrations, tests, runtime behavior, ADR/contracts и canonical Roadmap.**

Если отчёт расходится с repository state — приоритет имеет фактический код и canonical documentation.

---

# 1. REVIEW OBJECTIVE

Нужно независимо доказать или опровергнуть итоговый verdict Step 2.0:

> `PASS WITH STEP-LOCAL PREREQUISITES — 0 BLOCKERS`

Проверить, действительно ли Phase 1 foundation позволяет безопасно начать первый implementation step Phase 2 без скрытого архитектурного, security, data-integrity или domain blocker.

Особое внимание уделить:

1. корректности утверждения **0 BLOCKERS**;
2. полноте и правильной классификации **9 step-local prerequisites**;
3. соответствию prerequisites реальному **TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md**;
4. отсутствию скрытых prerequisites, ошибочно пропущенных Step 2.0;
5. отсутствию premature implementation Phase 2;
6. честности классификации Order / Booking / Payment / Supplier;
7. commercial transaction boundary;
8. monetary semantics;
9. concurrency / capacity / idempotency;
10. Outbox reliability;
11. RBAC / IDOR;
12. event / temporal / correlation foundation;
13. migration/replay/drift;
14. Deferred Decisions boundary.

---

# 2. SOURCE-OF-TRUTH ORDER

Используй следующий приоритет источников:

1. фактический production code;
2. `backend/prisma/schema.prisma`;
3. применённые migrations;
4. automated tests;
5. runtime verification;
6. ADR / contracts;
7. `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
8. Deferred Decisions Map;
9. Step 2.0 artifact (`docs/architecture/phase2-entry-audit.md`);
10. implementation report.

Implementation report **не является доказательством**.

---

# 3. BASELINE / REPOSITORY HYGIENE

Перед review:

- зафиксировать branch + commit;
- проверить `git status`;
- перечислить pre-existing dirty/untracked files;
- не изменять unrelated files;
- не редактировать applied migrations;
- не использовать `prisma db push` как способ исправления schema;
- любые review-fixes должны быть минимальными и step-local.

В отчёте указать baseline до review и изменённые файлы после review.

---

# 4. VERIFY STEP 2.0 ITSELF DID NOT IMPLEMENT PHASE 2

Проверить diff Step 2.0.

Ожидается, что implementation report правдив в части:

- schema не менялась;
- production behavior не менялся;
- добавлен только audit artifact;
- добавлен только proof/e2e spec;
- Sale / Quote / Checkout / Payment / Finance и прочие Phase 2 domains не были скрыто реализованы.

Если обнаружена production implementation beyond audit/proof — классифицировать как scope violation.

---

# 5. RECONSTRUCT THE REAL PHASE 2 DEPENDENCY GRAPH

Не копировать граф из отчёта механически.

По Roadmap + коду независимо восстановить dependency graph минимум для:

`Identity → Catalog → Commercial Intent → Order → Booking → Payment/Finance → Fulfillment → Settlement`

Для каждого узла определить:

- canonical owner;
- текущий status: CANONICAL / FOUNDATION / TRANSITIONAL / PLACEHOLDER / ABSENT;
- что уже можно безопасно использовать;
- что запрещено считать завершённым;
- какой Roadmap step закрывает gap.

Проверить, что Step 2.0 не перепутал "foundation exists" и "domain ready".

---

# 6. BLOCKER REASSESSMENT — ZERO BLOCKERS MUST BE PROVEN

Независимо составить список потенциальных blockers.

Для каждого candidate blocker вывести одно из:

- `BLOCKER`;
- `STEP-LOCAL PREREQUISITE`;
- `ACCEPTED DEBT`;
- `NOT AN ISSUE`.

Минимально проверить:

- ambiguous Buyer identity;
- ambiguous Partner identity;
- Partner vs Supplier collision;
- missing transaction snapshot boundary;
- missing money/currency semantics;
- missing availability reservation locking;
- missing idempotency contract;
- unreliable Outbox delivery;
- incomplete Order lifecycle;
- incomplete Booking lifecycle;
- absent Payment domain;
- missing Finance ownership;
- cross-context FK/write violations;
- RBAC grants without endpoints;
- public behavioral event accidentally creating commercial state;
- entitlement accidentally acting as subscription;
- inability to reconstruct lifecycle time;
- migration drift;
- legacy unknown values treated as facts.

Если хотя бы один blocker реально мешает **первому Roadmap implementation step**, verdict `0 BLOCKERS` должен быть отклонён.

---

# 7. STRICT REVIEW OF THE 9 REPORTED PREREQUISITES

Implementation report заявляет следующие prerequisites:

1. Outbox retry;
2. Booking currency/amount policy;
3. Monetary contract;
4. Tariff/Availability reservation & capacity locking;
5. Product → Order commercial snapshot policy;
6. removal of `/orders/bootstrap`;
7. Payment/PSP/ledger;
8. Supplier lifecycle/validation;
9. Payment/checkout idempotency keys.

Для **каждого** обязательно проверить:

- gap действительно существует в коде;
- он корректно назван;
- owner step существует в canonical Roadmap;
- deadline указан правильно;
- prerequisite не должен быть выполнен раньше;
- prerequisite не является blocker уже сейчас;
- нет дублирования с другим prerequisite;
- нет скрытого architectural decision.

Сделать итоговую таблицу:

| # | Prerequisite | Exists? | Correct owner | Must be solved before | Classification | Review verdict |
|---|---|---|---|---|---|---|

Если список должен быть 8, 10 или больше — исправить его, а не сохранять искусственно число 9.

---

# 8. OUTBOX RELIABILITY — HIGH-RISK REVIEW

Это один из ключевых review points.

Фактически проверить `EventBus` / Outbox / Inbox implementation:

- PENDING/PUBLISHED/FAILED semantics;
- `attempts` behavior;
- `error` persistence;
- retry behavior;
- manual recovery;
- consumer dedup;
- transaction boundary;
- correlation/causation preservation;
- behavior after process crash;
- behavior after consumer failure;
- whether FAILED events can become permanently stranded.

Затем ответить на главный вопрос:

> Может ли Phase 2 безопасно начинать первые steps при текущем Outbox, и **точно перед каким Roadmap step automated retry становится обязательным prerequisite?**

Не принимать автоматически формулировку отчёта "до 2.4–2.8".

Сверить это с реальным dependency graph.

Если Roadmap ставит Step 2.17 слишком поздно относительно первого production flow, явно отметить sequencing contradiction.

Не переносить Step 2.17 самостоятельно без доказательства необходимости; при реальном конфликте вывести `ARCHITECTURE / ROADMAP DECISION REQUIRED`.

---

# 9. MONEY CONTRACT — HIGH-RISK REVIEW

Проверить все monetary fields в Prisma и production code.

Минимум:

- Tariff price;
- Order amount;
- Order paidAmount;
- OrderItem unit/total price;
- Booking amount;
- любые другие money-поля.

Проверить:

- Decimal vs Float;
- precision/scale;
- currency companion;
- currency source-of-truth;
- rounding;
- negative values;
- zero values;
- serialization;
- arithmetic in JS/TS;
- snapshot semantics;
- cross-currency assumptions.

Особенно проверить утверждение:

> `Booking.amount` не имеет currency.

Определить, является ли inheritance currency from Order допустимым временным contract или скрытым blocker для соответствующего Booking step.

Не вводить monetary contract в рамках review, если он не нужен для исправления подтверждённого локального defect.

---

# 10. PRODUCT / TARIFF / AVAILABILITY → COMMERCIAL SNAPSHOT

Проверить фактическую mutable catalog model.

Убедиться, что Phase 2 не сможет безопасно использовать live Product/Tariff как историческую transaction truth.

Проверить существующий `OrderItem` snapshot:

- какие поля реально snapshot'ятся;
- достаточно ли паттерна как foundation;
- какие значения всё ещё могут быть потеряны;
- Product title / product code / tariff / price / currency / partner/supplier/service parameters.

Review должен ответить:

> Достаточно ли существующего паттерна для начала Phase 2, если полный commercial snapshot contract будет определён в owner step?

Если нет — классифицировать appropriately.

---

# 11. AVAILABILITY / CAPACITY / CONCURRENCY

Проверить фактическую модель Availability:

- `slotsTotal`;
- `slotsBooked`;
- `slotsReserved`;
- unique constraints;
- transaction/CAS/locking primitives;
- race behavior.

Не считать наличие `slotsReserved` доказательством reservation system.

Проверить отсутствие:

- reservation entity/hold;
- expiration;
- atomic decrement/increment contract;
- overbooking protection;
- retry/idempotency semantics.

Определить точный Roadmap deadline для capacity locking.

Если checkout/order может быть создан до capacity reservation — отметить риск.

---

# 12. ORDER FOUNDATION REVIEW

Проверить:

- текущие Order creation paths;
- `/orders/bootstrap`;
- кто имеет право создавать Order;
- canonical events;
- status transitions;
- OrderHistory;
- timestamps;
- payment placeholder fields;
- customer linkage;
- commercial snapshot;
- lifecycle gaps.

Подтвердить или опровергнуть classification:

> `Order = TRANSITIONAL`

Отдельно проверить, что `/orders/bootstrap` действительно временный ADMIN/import path и не может случайно стать canonical Phase 2 order creation API.

---

# 13. BOOKING FOUNDATION REVIEW

Проверить:

- Booking creation trigger;
- BookingRequested semantics;
- consumer dedup;
- order linkage;
- supplier linkage;
- BookingConfirmed/Rejected;
- reconciliation to Order;
- amount/currency;
- timestamps;
- timezone/serviceDate;
- passenger/traveler boundary;
- supplier confirmation.

Подтвердить или опровергнуть:

> `Booking = TRANSITIONAL`

Проверить, достаточно ли foundation для будущего Booking implementation без rewrite existing contracts.

---

# 14. PAYMENT / FINANCE REALITY CHECK

Repo-wide проверить, действительно ли отсутствуют canonical:

- Payment;
- PaymentIntent;
- Charge;
- Refund;
- Ledger;
- Commission;
- Settlement;
- Payout;
- Invoice.

Проверить, что:

- `Order.paymentStatus` и `paidAmount` не используются как ledger;
- Buyer Payments возвращает controlled empty;
- frontend не показывает fake payment history;
- dormant finance permissions не создают endpoint authority;
- Storefront entitlement не является Subscription/Billing.

Classification должна остаться `ABSENT`, если реального Finance domain нет.

---

# 15. SUPPLIER BOUNDARY

Проверить `crm.Supplier` и его отличие от `crm.Partner`.

Проверить:

- identity/reference semantics;
- supplierId in Booking;
- validation;
- lifecycle;
- permissions;
- cross-schema behavior.

Ответить:

> Можно ли использовать Supplier как reference foundation до реализации полноценного supplier lifecycle?

Если да — подтвердить owner prerequisite. Если нет — blocker соответствующего Booking step.

---

# 16. BUYER / PARTNER IDENTITY

Независимо подтвердить canonical linkage:

### Buyer
`security.User.customerId → crm.Customer.id`

### Partner
`security.User.partnerId → crm.Partner.id`

Проверить:

- uniqueness/nullable semantics;
- creation/approval flow;
- own-scope derivation;
- forged IDs;
- deleted/missing references;
- cross-context FK policy;
- whether future commercial records have unambiguous identity owner.

Если identity неоднозначна — Phase 2 entry PASS невозможен.

---

# 17. RBAC / IDOR REVIEW

Проверить фактическую permission matrix и controllers.

Минимум:

- BUYER only own-scope;
- PARTNER own-scope;
- MODERATOR cannot mutate partner-owned commercial state without permission;
- FINANCE dormant permissions do not expose nonexistent finance endpoints;
- ADMIN behavior explicitly understood;
- no query/body `customerId`, `partnerId`, `supplierId` becomes authority where actor scope is required.

Проверить negative tests, а не только permission definitions.

---

# 18. PUBLIC / BEHAVIORAL / COMMERCIAL ISOLATION

Проверить Marketplace + Storefront behavioral ingestion.

Доказать:

- ProductView ≠ Sale;
- ContactClick ≠ Lead;
- Search ≠ commercial intent record;
- behavioral event cannot create Order/Booking/Payment;
- `AcquisitionSource` не является transaction attribution;
- `ProductPublicationChannel` не является acquisition source;
- Storefront entitlement не является billing/subscription state.

Если эти semantics смешаны хотя бы в одном production path — blocker.

---

# 19. EVENT FOUNDATION

Проверить реальные Outbox/Inbox contracts:

- event type;
- aggregate ID;
- payload;
- actor;
- occurredAt/createdAt/processedAt semantics;
- correlationId;
- causationId;
- immutable identity;
- consumer dedup;
- event payload privacy.

Убедиться, что Phase 2 commercial events могут быть добавлены без breaking redesign event infrastructure.

---

# 20. CORRELATION / REQUEST CONTEXT

Проверить Step 1.15/1.15A invariants не по отчёту, а по коду/tests:

- requestId diagnostic contract;
- correlationId server-authoritative;
- client `X-Correlation-Id` ignored;
- independent HTTP requests create independent chains;
- child causation = parent event ID;
- legacy NULL preserved;
- ALS isolation;
- no behavioral pollution.

Это foundation для Phase 2 distributed commercial flows.

---

# 21. TEMPORAL READINESS

Проверить, что Phase 2 не наследует ложные timestamps.

Особенно:

- `updatedAt` не milestone;
- Order missing milestones честно deferred;
- Booking missing request/confirm/cancel milestones честно deferred;
- Payment timestamps отсутствуют вместе с Payment domain;
- serviceDate timezone ambiguity признана;
- legacy NULL не backfill'ится guessed values.

Сверить с `temporal-readiness.md`.

---

# 22. ANALYTICS READINESS RECONCILIATION

Проверить, что `analytics-ready` нигде не интерпретируется как `commercial domain complete`.

Сверить Step 2.0 artifact с:

- `analytics-readiness.md`;
- `temporal-readiness.md`;
- Phase 1 exit audit.

Любое противоречие зафиксировать.

---

# 23. DEFERRED DECISIONS

Проверить Deferred Decisions Map.

Убедиться, что Step 2.0 или его artifact не решили скрыто:

- multilingual UGC;
- AI translation;
- Trial;
- Plans/Pricing;
- recurring billing;
- grace period;
- Subscription domain;
- custom domains;
- commission rates;
- transaction economics;
- cancellation policy;
- capability matrix;
- retention/privacy policies.

Если Phase 2 prerequisite фактически зависит от unresolved Deferred Decision — это должно быть явно отмечено.

---

# 24. MIGRATIONS / REPLAY / DRIFT

Обязательно выполнить:

1. `prisma migrate status`;
2. clean migration replay на isolated empty DB;
3. schema drift check;
4. подтвердить отсутствие `db push` strategy;
5. проверить, что applied migrations не редактировались.

Если clean replay/drift fails — это blocker Phase 2 entry.

Не использовать production/dev data destructively.

---

# 25. STEP 2.0 PROOF SPEC REVIEW

Проверить новый:

`backend/test/phase2-entry-audit.e2e-spec.ts`

Не считать его существование достаточным.

Проверить качество каждого proof:

- Decimal/no drift;
- Payment absence;
- Order→Booking linkage;
- Buyer cross-scope;
- correlation;
- Inbox dedup;
- behavioral≠commercial;
- entitlement≠subscription;
- forged fields;
- public/private isolation.

Искать false-positive tests, которые доказывают не то, что заявлено.

Если proof слабый — усилить тест, но не менять production behavior без подтверждённого defect.

---

# 26. REQUIRED AUTOMATED REGRESSION

После review/fixes выполнить минимум:

### Backend

- `npx tsc --noEmit`
- full unit suite
- Step 2.0 entry audit e2e отдельно
- full serial e2e

### Frontend

- `npx tsc --noEmit`
- full vitest
- production `next build`

### Database

- migrate status
- clean replay
- drift

В отчёте привести **точные** suite/test counts.

Skipped/timeouts должны быть явно указаны.

---

# 27. RUNTIME VERIFICATION

На isolated/temp environment проверить минимум:

- backend clean boot;
- public endpoint;
- anonymous protected endpoint → 401;
- neutral 404 semantics;
- requestId header/body on error;
- отсутствие synthetic commercial rows after boot;
- отсутствие automatic Order/Booking/Payment creation from behavioral request.

Не загрязнять shared dev DB smoke-данными.

Temp DB/processes после проверки удалить/остановить.

---

# 28. REVIEW FIX POLICY

Если найден локальный подтверждённый defect:

1. описать проблему;
2. показать evidence;
3. определить root cause;
4. классифицировать severity;
5. исправить минимально;
6. добавить regression test;
7. повторить full regression.

Не расширять scope.

Если исправление требует изменения ownership, canonical lifecycle, cross-domain write authority, major money semantics или Roadmap sequencing — **не импровизировать**.

Вывести:

`ARCHITECTURE DECISION REQUIRED`

и остановить соответствующее изменение.

---

# 29. REQUIRED FINAL VERDICT

Разрешены только следующие итоговые verdict:

### A. Полный PASS

`PHASE 2 STEP 2.0 STRICT REVIEW PASSED — PHASE 2 ENTRY APPROVED`

Только если:

- 0 blockers подтверждено;
- prerequisites корректны;
- Roadmap sequencing непротиворечив;
- regression green;
- migrations/replay/drift green;
- architecture decision не требуется.

### B. PASS AFTER REVIEW FIXES

`PHASE 2 STEP 2.0 REVIEW FIXES COMPLETED — PHASE 2 ENTRY APPROVED`

Если были только локальные исправимые дефекты.

### C. BLOCKED

`PHASE 2 STEP 2.0 STRICT REVIEW FAILED — PHASE 2 ENTRY BLOCKED`

Если найден настоящий blocker.

### D. Architecture/Roadmap decision

`ARCHITECTURE DECISION REQUIRED — PHASE 2 ENTRY NOT APPROVED`

Если продолжение требует решения владельца архитектуры/roadmap.

---

# 30. REQUIRED REVIEW REPORT FORMAT

Финальный отчёт должен содержать минимум:

1. Verdict
2. Repository baseline
3. Files/modules inspected
4. Step 2.0 scope verification
5. Phase 2 dependency graph
6. Canonical/transitional/legacy classification
7. Blocker reassessment
8. Review of all reported prerequisites
9. Missing prerequisites, if any
10. Outbox reliability review
11. Monetary contract review
12. Product/Tariff/Availability commercial boundary
13. Capacity/concurrency review
14. Order foundation review
15. Booking foundation review
16. Payment/Finance reality check
17. Supplier boundary
18. Buyer/Partner identity
19. RBAC/IDOR
20. Public/behavioral/commercial isolation
21. Event foundation
22. Correlation/causation
23. Temporal readiness
24. Analytics reconciliation
25. Deferred Decisions compliance
26. Migration/replay/drift
27. Step 2.0 proof-spec review
28. Security negative matrix
29. Runtime verification
30. Unit results
31. E2E results
32. Frontend tests/build
33. Issues found
34. Review fixes implemented
35. Remaining prerequisites/debt
36. Roadmap sequencing verdict
37. Architecture decision status
38. Out-of-scope confirmation
39. Files changed
40. Final approval line

Для каждого найденного issue использовать:

- **Problem**
- **Evidence**
- **Risk**
- **Root cause**
- **Fix**
- **Tests**
- **Regression result**

---

# 31. IMPORTANT REVIEW QUESTIONS THAT MUST BE ANSWERED EXPLICITLY

В финальном отчёте отдельно и однозначно ответить:

1. **Действительно ли blockers = 0?**
2. **Действительно ли prerequisites = 9?** Если нет — сколько и почему?
3. **Какой prerequisite должен быть выполнен первым по фактическому dependency graph?**
4. **Не конфликтует ли Step 2.17 Outbox retry с тем моментом, когда reliable delivery уже понадобится?**
5. **Можно ли начинать Step 2.1 без monetary contract?**
6. **Можно ли начинать Step 2.1 без capacity reservation?**
7. **На каком точном step capacity locking становится mandatory?**
8. **Когда commercial snapshot contract становится mandatory?**
9. **Является ли Booking currency gap blocker и для какого exact step?**
10. **Достаточен ли Supplier как reference foundation?**
11. **Не используется ли Order paymentStatus/paidAmount как скрытый Payment domain?**
12. **Нет ли скрытой Subscription semantics в Storefront entitlement?**
13. **Нет ли Phase 2 functionality, случайно реализованной в Step 2.0?**
14. **Какой exact следующий implementation step разрешён после approval согласно canonical Roadmap?**

---

# 32. DO NOT AUTO-START NEXT STEP

Даже при PASS:

- не начинать следующий implementation step;
- не создавать Sale/Quote/Checkout/Payment;
- не менять Roadmap;
- не реализовывать prerequisites заранее;
- не выполнять Step 2.1 автоматически.

Сначала вернуть STRICT REVIEW report и строку approval.

Следующий implementation prompt формируется **только после отдельного подтверждения пользователя**.

---

# FINAL EXECUTION INSTRUCTION

Проведи review фактического repository state, а не текста отчёта.

Если implementation report утверждает `PASS`, но proof недостаточен — считать это **не доказанным**, пока не будет подтверждено кодом/tests/runtime.

Главная цель — не получить зелёный отчёт, а гарантировать, что Phase 2 начинается на архитектурно честном фундаменте и что prerequisites будут закрыты **до**, а не после момента, когда от них начнёт зависеть коммерческий lifecycle.
