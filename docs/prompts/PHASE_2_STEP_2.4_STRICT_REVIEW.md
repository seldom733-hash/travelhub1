# PHASE 2 — STEP 2.4 — SALE COMPLETION → ORDERREQUESTED + AVAILABILITY RESERVATION GATE — STRICT REVIEW PROMPT

## Роль
Проведи независимый STRICT REVIEW фактической реализации PHASE 2 STEP 2.4. Implementation report не является доказательством.

Не начинай Step 2.5. Локальные однозначные дефекты исправляй как REVIEW FIX с targeted regression. Фундаментальные вопросы ownership, reservation model, Sale lifecycle, event contract или reliability → `ARCHITECTURE DECISION REQUIRED`.

## 1. Scope
Сверь Roadmap. Step 2.4 должен покрывать Sale completion, atomic availability reservation/locking, immutable commercial snapshot, `OrderRequested`, outbox reliability и concurrency/idempotency. Step 2.5 Order consumer не должен быть начат.

## 2. Baseline
Зафиксируй branch, HEAD, git status, diff, migrations, unrelated files. Проверь Step 2.3B baseline.

## 3. Sale lifecycle
Проверь `OPEN → CLOSED`: является ли CLOSED именно успешным commercial completion, а не ambiguous terminal state. Если semantics не подтверждена Roadmap/architecture — architecture decision.

## 4. Completion API
Проверь dedicated `POST /api/v1/sales/sales/:code/complete`, permission `sales.sale.complete`, expectedVersion, отсутствие generic PATCH/status bypass.

## 5. Preconditions
Проверить Sale→Checkout relation, Checkout not cancelled, terms selected, serviceDate, Quote items, totals/currency, acquisition source, Product/Tariff refs, availability reservable.

## 6. Checkout/Sale cardinality
Проверь, может ли один Checkout быть связан с несколькими Sales и привести к duplicate commercial conversion. Если возможно — HIGH/BLOCKER.

## 7. Quote expiry
Определи completion policy для expired source Quote. Никакого Catalog reprice.

## 8. Payment Terms
Payment terms должны быть обязательны, если это canonical prerequisite. Никакого default scheme.

## 9. Commercial snapshot
Инвентаризируй snapshot fields: refs, items, serviceDate, travelers semantics, subtotal/discount/total/currency, payment terms, acquisitionSource, reservation refs. Для каждого укажи source и immutability.

## 10. Snapshot authority
Цепочка должна быть `Catalog → frozen Quote → frozen Checkout → frozen Sale snapshot`. Current Catalog price не влияет на completion economics.

## 11. Snapshot immutability
После completion измени Catalog Product/Tariff и допустимые upstream данные. Sale snapshot и OrderRequested payload должны остаться прежними.

## 12. Legacy/null
Новые snapshot/completion fields не backfill'ятся guessed values. Старые Sale rows должны иметь honest NULL semantics.

## 13. Availability ownership
Проверь, что Catalog действительно owner reservation/Availability; Sales вызывает owner service/command, а не произвольный direct write.

## 14. Reservation model
Инвентаризируй `AvailabilityReservation`: RSR-*, owner schema, product/tariff/date, quantity, sale/checkout refs, status, timestamps, unique/indexes.

## 15. RSR ID
Проверь IDs contract, BusinessSequence, concurrency-safe generation.

## 16. Capacity semantics
Проверь фактическую формулу capacity/available/booked/reserved и отсутствие double-counting.

## 17. Atomic conditional update
Обязательно доказать DB-level condition `available >= requested` + update в одной transaction. Pre-read+update недостаточно.

## 18. Multi-item reservation
Все items должны резервироваться в одной transaction. Если item N падает — N-1 rollback. Проверь duplicate items, указывающие на одну Availability row.

## 19. Last-slot concurrency
Реальный race двух different Sale completions за последнюю capacity unit:
- one success;
- one controlled failure;
- one completed Sale;
- one reservation set;
- one OrderRequested;
- no negative capacity/orphans.

## 20. Same Checkout / two Sales
Отдельный test. Duplicate conversion одного Checkout должен быть невозможен либо явно canonical.

## 21. Same Sale double completion
Concurrent requests: one winner; one snapshot/history/audit/event/reservation set.

## 22. Failure rollback matrix
Validation/terms/unavailable/stale/reservation fail/Sale update fail/outbox insert fail → no completion, no reservation, no OrderRequested.

## 23. Delivery failure after commit
Consumer delivery failure после commit не должен rollback Sale/reservation. Durable event должен остаться retryable.

## 24. DD-022
Проверь реальный текст DD-022 после DECIDED: owner, atomic gate, lifecycle/release/downstream semantics. Если incomplete — finding.

## 25. Service date/time
Reservation использует честную date-only модель, без fake timezone/time-slot.

## 26. Quantity
Reservation quantity server-derived from canonical item/availability semantics. Никакого client-supplied arbitrary quantity.

## 27. Options
No arbitrary options JSON.

## 28. Acquisition propagation
Checkout acquisitionSource должен попасть в immutable snapshot/event без recompute. Future enum extensibility retained.

## 29. OrderRequested
Проверь canonical event name/contract, aggregateType/aggregateId, payload version, actor/correlation conventions.

## 30. Payload privacy
No email/phone/passport/CRM notes/raw Checkout/raw Quote/auth secrets. Traveler PII только если contract explicitly требует, иначе IDs/safe refs.

## 31. Correlation/causation
HTTP correlation server-authoritative; no business code as correlationId; no invented causation.

## 32. Outbox atomicity
Sale CAS + reservations + snapshot + history + OrderRequested must commit atomically if architecture claims so. Audit boundary describe honestly.

## 33. Retry state machine
Implementation claims `retryFailed()` with attempts/maxAttempts/backoff/nextAttemptAt while FAILED remains terminal. Resolve exact state machine precisely.

## 34. Retry eligibility
Check attempts<max, nextAttemptAt<=now or null, poison handling, event filters, locking/concurrent workers.

## 35. Automatic vs manual retry
Критический вопрос: `retryFailed()` вызывается автоматически worker/scheduler или только вручную/test? Определи, достаточна ли recovery для critical OrderRequested chain.

## 36. Backoff/attempts
Проверь max boundary/off-by-one, persisted UTC nextAttemptAt, bounded delay, no busy loop.

## 37. Concurrent retries
Two workers must not create duplicate side effect. Same event ID/correlation retained. Inbox dedup unchanged.

## 38. Step 2.5 boundary
Если consumer owner = 2.5, Order не должен создаваться в 2.4. Repo-wide search subscribers/handlers.

## 39. History/temporal/audit
Exactly one Sale milestone. Dedicated completion timestamp if needed; no updatedAt surrogate. Audit safe, no PII, no duplicates.

## 40. Payment Terms propagation
Snapshot/event contains exact scheme/prepayment/initial/remaining, no Payment status.

## 41. Money/currency
Decimal exact, no float, exact Checkout currency, no FX.

## 42. Checkout post-completion mutability
Проверь, можно ли после Sale completion менять Checkout terms/travelers/serviceDate. Если да, completed Sale snapshot должен оставаться immutable; оцени нужен ли guard сейчас.

## 43. RBAC/capabilities
No role hardcoding. `sales.sale.complete` capability-based. Сохраняется small-organization model: permissions authority, roles presets.

## 44. Mass assignment
Completion body rejects status/snapshot/totals/currency/payment terms/acquisition/reservation/event/order/actor/correlation/timestamps. Legitimate expectedVersion only.

## 45. Error model / ValidationPipe
Canonical 401/403/404/409/422/500 + requestId. No implicitConversion regression, no stack/Prisma/SQL leakage.

## 46. Migration review
Inspect `20260810141929_add_sale_completion_order_requested`: additive, no fake backfill, reservation/snapshot/retry schema honest, prior migrations untouched.

## 47. Index review
Availability lookup, reservation lookup, retry `status,nextAttemptAt`, Sale completion queries adequately indexed.

## 48. Legacy CLOSED
Определи, могли ли до 2.4 существовать CLOSED Sale rows. Не считать их автоматически canonical completed with reservation/event. Документировать segmentation/horizon.

## 49. Existing test modifications
Проверь sales-center complete 404→400 и sales-domain outbox global-zero→delta. Убедись, что old invariants не ослаблены шире необходимого.

## 50. Mandatory targeted tests if absent
Добавить:
1. two Sales same Checkout;
2. two items same Availability row;
3. first item reserve + second fail → full rollback;
4. old CLOSED not canonical completed;
5. completion vs payment-terms mutation race;
6. completion vs serviceDate mutation race;
7. concurrent retry workers;
8. maxAttempts boundary;
9. future nextAttemptAt not picked;
10. actual automatic/manual retry proof;
11. outbox insert failure rollback;
12. Catalog price mutation after completion;
13. quote-expiry completion policy;
14. checkout mutation after completion semantics.

## 51. Runtime verification
Использовать фактические configured/free ports. Не hardcode 3000/4000 как architectural contract. В отчёте указать actual URLs.

На isolated DB: Quote→Checkout→terms→finite availability→Sale→complete; inspect reservation/snapshot/OrderRequested; force retry; no Order if 2.5; no Booking/Payment; requestId/correlation.

## 52. Replay/regression
migrate status, clean replay, diff no drift.
Backend tsc, unit, Step1.14, Step1.15, Step1.18, Step2.1-2.4, full serial.
Frontend tsc, vitest, next build.
Skipped/timeouts != PASS.

## 53. Docs
Review `sale-completion-order-requested.md`, events contract, ids contract. Docs must describe ownership, CLOSED semantics, snapshot, reservation, last-slot, DD-022, OrderRequested, retry state machine, failure matrix, no Order/Booking/Payment, legacy limitations, Step2.5 boundary.

## 54. Reliability sequencing
Explicitly state whether Step 2.4 now closes enough of the early outbox reliability prerequisite that Step 2.5 may safely start; what remains for Step 2.17.

## 55. Step 2.5 readiness
Final classification:
- READY FOR STEP 2.5
- PREREQUISITE FIX REQUIRED BEFORE STEP 2.5
- ARCHITECTURE DECISION REQUIRED

Do not start Step 2.5.

## 56. Required explicit answers
Answer explicitly:
1 scope respected?
2 2.5 not started?
3 CLOSED canonical?
4 dedicated completion?
5 prerequisites complete?
6 terms mandatory?
7 snapshot sufficient?
8 immutable?
9 no reprice?
10 acquisition preserved?
11 availability owner correct?
12 RSR correct?
13 capacity formula correct?
14 conditional reserve atomic?
15 multi-item rollback safe?
16 same-row duplicate items safe?
17 last-slot race safe?
18 two Sales same Checkout safe?
19 double completion safe?
20 rollback safe?
21 delivery failure keeps committed reservation/Sale?
22 DD-022 closed?
23 service date honest?
24 quantity authoritative?
25 OrderRequested canonical?
26 payload no PII?
27 aggregate identity correct?
28 correlation correct?
29 causation correct?
30 outbox atomic?
31 retry state machine coherent?
32 retry automatic or manual?
33 recovery sufficient?
34 backoff correct?
35 maxAttempts correct?
36 concurrent retry safe?
37 event ID stable?
38 correlation stable?
39 no Order consumer?
40 history once?
41 milestone timestamp correct?
42 audit safe?
43 payment terms exact?
44 currency exact?
45 checkout post-completion semantics safe?
46 no Payment?
47 no Booking?
48 no bootstrap shortcut?
49 migration honest?
50 retry indexes adequate?
51 legacy CLOSED honest?
52 old tests updated safely?
53 runtime actual ports reported?
54 replay/drift clean?
55 full regression green?
56 reliability prerequisite sufficiently closed?
57 blockers?
58 architecture decision?
59 approve 2.4?
60 READY FOR STEP 2.5?

## 57. Final report format
Return:

# PHASE 2 — STEP 2.4 — SALE COMPLETION → ORDERREQUESTED + AVAILABILITY RESERVATION GATE — STRICT REVIEW — ОТЧЁТ

1 Verdict
2 Repository baseline
3 Files/modules inspected
4 Roadmap scope
5 Previous invariants
6 Sale lifecycle
7 Completion API
8 Preconditions
9 Checkout/Sale cardinality
10 Quote expiry
11 Payment Terms prerequisite
12 Commercial snapshot
13 Snapshot authority
14 Immutability
15 Legacy/null
16 Availability ownership
17 Reservation model
18 RSR identity
19 Capacity semantics
20 Conditional update
21 Multi-item reservation
22 Last-slot concurrency
23 Same Checkout multi-Sale
24 Double completion
25 Reservation rollback
26 Delivery failure
27 DD-022
28 Service date/time
29 Quantity
30 Options
31 Acquisition
32 OrderRequested contract
33 Payload/privacy
34 Aggregate/version
35 Correlation/causation
36 Outbox atomicity
37 Retry state machine
38 Retry eligibility
39 Auto/manual retry
40 Backoff
41 Attempts/max
42 Poison behavior
43 Concurrent retry
44 Event identity stability
45 Step2.5 boundary
46 History
47 Temporal
48 Audit
49 Payment Terms propagation
50 Money/currency
51 Checkout post-completion
52 RBAC/capabilities
53 Small-org compatibility
54 DTO/mass-assignment
55 ValidationPipe/error model
56 Migration
57 Indexes
58 Legacy CLOSED
59 Existing-test modifications
60 E2E quality
61 Targeted tests
62 Runtime
63 Port/runtime rule
64 Replay/drift
65 Full regression
66 Documentation
67 Events/IDs docs
68 Deferred Decisions
69 Reliability sequencing
70 Step2.5 readiness
71 Findings
72 Review fixes
73 Remaining debt
74 Architecture decision status
75 Approval recommendation
76 Out-of-scope
77 Files changed during review

## 58. Allowed verdicts
`PHASE 2 STEP 2.4 STRICT REVIEW COMPLETED — APPROVED`
or
`PHASE 2 STEP 2.4 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`
or
`ARCHITECTURE DECISION REQUIRED`
or
`PHASE 2 STEP 2.4 STRICT REVIEW FAILED — BLOCKER FOUND`

## 59. Stop condition
НЕ начинать Step 2.5. Вернуть report. Если APPROVED — обязательно добавить `READY FOR STEP 2.5` либо `PREREQUISITE FIX REQUIRED BEFORE STEP 2.5`.
