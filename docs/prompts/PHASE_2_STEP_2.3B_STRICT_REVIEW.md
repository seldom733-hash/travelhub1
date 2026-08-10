# PHASE 2 — STEP 2.3B — PAYMENT TERMS / PAYMENT SCHEME FOUNDATION — STRICT REVIEW PROMPT

## 0. Роль и режим

Проведи независимый **STRICT REVIEW PHASE 2 — STEP 2.3B — Payment Terms / Payment Scheme Foundation**.

Implementation report — НЕ доказательство. Проверяй фактический код, Prisma schema, migration SQL, production paths, Decimal calculations, API, permissions, history/audit, tests, runtime и документацию.

Предыдущий утверждённый baseline:
- Step 2.3 — Quote flow;
- Step 2.3A — Checkout / Commercial Intent Foundation — APPROVED.

Текущий implementation report заявляет:
`PHASE 2 STEP 2.3B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

**НЕ начинать Step 2.4.**

Если найден локальный дефект — исправить как `REVIEW FIX`, добавить targeted regression и выполнить full regression.

Если проблема фундаментальная (scheme semantics, ownership, deposit meaning, monetary authority, reservation/order boundary) — остановиться с:

`ARCHITECTURE DECISION REQUIRED`

---

# 1. Review objectives

Нужно независимо доказать или опровергнуть:

1. canonical payment schemes действительно соответствуют Roadmap;
2. scheme semantics однозначны;
3. Checkout остаётся authoritative commercial intent;
4. Quote/Checkout binding price не переоценивается;
5. derived amounts вычисляются только server-side;
6. Decimal/rounding reconciliation корректен;
7. DEPOSIT и PARTIAL не семантически спутаны;
8. PAY_LATER и PAY_AT_SERVICE различимы;
9. NULL означает terms not selected;
10. migration не фабрикует legacy terms;
11. capability/RBAC корректны;
12. Payment/Finance не внедрены преждевременно;
13. Sale/Order/Booking изолированы;
14. availability reservation не подменена payment scheme;
15. Step 2.4 может безопасно snapshot terms без reinterpretation.

---

# 2. Repository baseline

Зафиксировать:

- branch;
- HEAD;
- git status;
- tracked/untracked diff;
- migration count;
- какие изменения относятся к 2.3A review-fix, а какие к 2.3B.

Отдельно проверить заявленный baseline `HEAD 085364d`.

Не менять unrelated user files.

---

# 3. Sources to inspect

Обязательно открыть фактические:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Baseline/architecture docs, где определён PaymentTerms / PMT;
- Deferred Decisions Map;
- ADR-0001 и связанные ADR;
- `backend/prisma/schema.prisma`;
- migration `20260810092034_add_payment_terms_foundation`;
- `sales.payment-terms.ts`;
- `sales.payment-terms.spec.ts`;
- `sales.service.ts`;
- `checkout.controller.ts`;
- `sales.contracts.ts`;
- `sales.validation.ts`;
- Checkout/Quote money helpers;
- permissions constants / security reconciliation;
- `payment-terms.e2e-spec.ts`;
- `checkout-commercial-intent.e2e-spec.ts`;
- `docs/architecture/payment-terms-foundation.md`.

Implementation report не использовать как source of truth.

---

# 4. Roadmap scope

Проверить, что Step 2.3B действительно требует именно foundation payment terms/payment schemes.

Подтвердить отсутствие premature:

- Step 2.4 Sale completion;
- `OrderRequested`;
- Order;
- Booking;
- Payment entity;
- PSP;
- ledger;
- refund;
- settlement;
- payout;
- finance posting;
- public/BUYER checkout;
- payment collection UI.

---

# 5. Ownership

Проверить утверждение:

Payment Terms selection принадлежит `sales.CheckoutIntent`, а будущий Finance владеет execution/payment/ledger.

Убедиться, что Sales не пишет в Finance/Catalog/Order/Booking.

Если canonical PMT-* в Baseline означает самостоятельную Finance entity уже на этом шаге и текущая модель противоречит этому — не замалчивать.

Классифицировать:
- correct bounded-context split;
- acceptable precursor;
- roadmap conflict;
- architecture decision.

---

# 6. Canonical scheme vocabulary

Сверить непосредственно с Roadmap.

Заявлены:

- `FULL_PREPAYMENT`
- `PARTIAL_PREPAYMENT`
- `DEPOSIT`
- `PAY_LATER`
- `PAY_AT_SERVICE`

Проверить:
- названия;
- количество;
- отсутствие лишних схем;
- отсутствие пропущенных canonical schemes.

---

# 7. Scheme semantics matrix — CRITICAL

Независимо восстановить semantics из кода и docs.

Для каждой scheme определить:

| Scheme | initial | remaining | config | due semantics |
|---|---:|---:|---|---|

Не принимать implementation matrix на веру.

Особенно проверить:
- initial + remaining reconciliation;
- допустимые значения;
- semantic due trigger;
- запрещённые параметры.

---

# 8. FULL_PREPAYMENT

Проверить:

- initial = total;
- remaining = 0;
- config запрещён;
- zero-total semantics;
- client не может подменить amounts.

---

# 9. PARTIAL_PREPAYMENT

Проверить discriminated config:

- PERCENTAGE;
- FIXED.

Если оба поддерживаются:
- discriminator обязателен;
- значение обязательно;
- `0 < initial < total`;
- 100% не принимается как PARTIAL;
- fixed==total не принимается;
- rounding не превращает partial в 0 или total.

---

# 10. DEPOSIT — CRITICAL

Проверить фактическое основание утверждения:

**DEPOSIT является частью Checkout.total.**

Найти это в Roadmap/Baseline, а не только в новом документе.

Если подтверждено:
`remaining = total - deposit`

Если не подтверждено — `ARCHITECTURE DECISION REQUIRED`.

Также определить фактическое отличие DEPOSIT от PARTIAL_PREPAYMENT.

Если отличие только `due semantics`, убедиться, что это действительно canonical business distinction, а не два технически одинаковых enum без бизнес-смысла.

---

# 11. PAY_LATER

Проверить:

- initial = 0;
- remaining = total;
- config запрещён;
- BEFORE_SERVICE — semantic trigger, а не fake timestamp;
- нет invented dueAt.

---

# 12. PAY_AT_SERVICE

Проверить:

- initial = 0;
- remaining = total;
- AT_SERVICE semantic trigger;
- не создаётся fake service instant;
- date-only Step 2.3A boundary не нарушена.

---

# 13. Payment due semantics

Проверить, где живёт `IMMEDIATE / BEFORE_SERVICE / AT_SERVICE`.

Если due trigger только вычисляется из scheme и не persisted — убедиться, что Step 2.4 сможет детерминированно snapshot semantics.

Если persisted — проверить canonical enum/source.

Не создавать fake due date/time.

---

# 14. Monetary authority

Доказать кодом:

`Issued Quote → frozen Checkout total → Payment Terms calculator`

Запрещено:
- current Product price;
- current Tariff price;
- frontend initialAmount;
- frontend remainingAmount;
- frontend currency.

Проверить, что изменение Catalog после Checkout не влияет на terms.

---

# 15. Decimal implementation

Проверить фактическое использование Prisma.Decimal/decimal.js.

Никаких:
- `Number(total)`;
- `parseFloat`;
- JS floating arithmetic;
- `Math.round` для money.

Проверить precision/scale against schema.

---

# 16. Rounding

Проверить canonical half-up 2dp.

Targeted values:
- 99.99 × 33.33%;
- 0.05 × 50%;
- 123.45 × 17.5%;
- values around x.xx5;
- near-zero;
- near-total.

Доказать:
`initial + remaining == total`

после rounding.

---

# 17. Overflow

Проверить DECIMAL(12,2) boundaries.

Malformed/overflow input должен дать controlled 4xx, не Prisma 500.

---

# 18. Currency

Проверить отсутствие независимой currency в terms.

Если currency возвращается projection — source должен быть Checkout.

Нельзя создать currency divergence.

---

# 19. Data model

Проверить заявленные nullable fields:

- paymentScheme;
- prepaymentType;
- prepaymentValue;
- initialAmount;
- remainingAmount.

Проверить types/defaults/indexes.

Особенно:
- нет default scheme;
- нет fake zero amounts для legacy;
- nullable semantics согласованы.

---

# 20. Migration — CRITICAL

Inspect raw SQL `20260810092034_add_payment_terms_foundation`.

Проверить:

- additive;
- nullable;
- no DEFAULT scheme;
- no `NOW()`;
- no guessed backfill;
- no copy from unrelated columns;
- enum creation safe;
- no destructive alteration;
- prior migrations untouched.

---

# 21. Legacy NULL proof

Implementation report утверждает `NULL = terms not selected`.

Но тест нового Checkout с NULL сам по себе НЕ доказывает migration behavior для pre-existing row.

Обязательно проверить automated legacy-like proof:

1. создать Checkout row в состоянии, эквивалентном pre-migration/no terms;
2. reconciliation/startup не должен заполнить scheme/amounts;
3. все payment-term columns остаются NULL.

Если такой тест отсутствует — добавить REVIEW FIX test.

---

# 22. Projection

Проверить:

`paymentTerms: null`

при отсутствии terms.

При наличии — stable shape, например:
- scheme;
- prepaymentType/value when applicable;
- initialAmount;
- remainingAmount;
- due semantics.

Не отдавать internal DB representation случайно.

---

# 23. API

Проверить фактический endpoint:

`PUT /api/v1/sales/checkouts/:code/payment-terms`

Проверить:
- auth;
- permission;
- DTO;
- expectedVersion;
- status code convention;
- response projection;
- canonical error envelope.

---

# 24. Generic PATCH absence

Убедиться, что payment terms нельзя менять через generic Checkout PATCH/service path.

Должна быть dedicated command.

---

# 25. Mass assignment

Repo/code review + e2e для forged:

- initialAmount;
- remainingAmount;
- total;
- subtotal;
- currency;
- price;
- paidAmount;
- paymentStatus;
- dueAt;
- dueDate;
- dueTrigger;
- paymentId;
- orderId;
- PSP/provider/reference;
- availability;
- acquisitionSource;
- status;
- version;
- timestamps;
- actor;
- request/correlation.

Forbidden → 422 according to repo contract.

---

# 26. Input combination validation

Проверить strict per-scheme whitelist.

Например:
- FULL + prepaymentValue → reject;
- PAY_LATER + FIXED → reject;
- PAY_AT_SERVICE + percentage → reject;
- PARTIAL without type/value → reject;
- DEPOSIT without type/value → reject;
- unknown fields → reject.

---

# 27. Mutability

Проверить:

- ACTIVE Checkout: replace terms allowed;
- CANCELLED: forbidden;
- no other hidden lifecycle.

Terms replacement must be explicit and history-backed.

---

# 28. Quote expiry

Implementation выбрал:

source Quote expiry после создания Checkout НЕ запрещает изменение terms, frozen Checkout остаётся authoritative.

Проверить consistency с 2.3A binding-price semantics и Roadmap.

Критический вопрос:
может ли истёкший Quote-backed Checkout бесконечно оставаться коммерчески действительным?

Если это уже определено 2.3A — подтвердить.
Если нет и влияет на Sale completion — зафиксировать mandatory Step 2.4 validation, либо architecture decision.

---

# 29. CAS

Проверить `expectedVersion`.

- stale → 409;
- exactly one winner;
- one history record;
- no partial audit/history.

---

# 30. Concurrency

Проверить races:

1. terms A vs terms B;
2. terms vs cancel;
3. terms vs traveler mutation;
4. terms vs service-date mutation;
5. terms vs revalidate availability.

Все используют одну Checkout version?

Если разные mutation paths не bump/version-check согласованно — HIGH defect.

---

# 31. Traveler / price consistency

Step 2.3A traveler changes не должны silently invalidate terms.

Проверить:
- traveler mutation после terms;
- если total frozen и traveler count не влияет на price — documented;
- если traveler count должен влиять на commercial total — blocker/pre-existing gap.

Не придумывать repricing.

---

# 32. Service date interaction

PAY_AT_SERVICE/BEFORE_SERVICE semantics должны оставаться корректными при serviceDate change.

Если terms trigger semantic, смена date не требует amount recalculation.

Проверить history/version race.

---

# 33. Availability isolation

Выбор FULL/DEPOSIT не должен:
- reserve;
- decrement;
- lock;
- guarantee availability.

Проверить DB delta.

---

# 34. DD-022 gate

Строго подтвердить, что после 2.3B всё ещё остаётся:

**atomic availability revalidate/reserve prerequisite before OrderRequested in Step 2.4.**

Payment scheme не закрывает этот prerequisite.

---

# 35. Acquisition isolation

Terms mutation не меняет `acquisitionSource`.

Проверить DIRECT остается прежним.

Не смешивать payment scheme и channel/source.

---

# 36. RBAC / capability model — CRITICAL

Implementation report утверждает:

ADMIN + SALES_MANAGER write;
DIRECTOR read-only;
FINANCE no write;
OPERATOR no access;
BUYER/PARTNER/MODERATOR/ANALYST/MARKETER denied.

Проверить фактические permissions, а не role-name checks.

Repo-wide search:
- никаких `if role === SALES_MANAGER`;
- controller использует `sales.checkout.write`;
- permission reconciliation consistent.

---

# 37. Small-organization capability invariant

Это отдельный обязательный review point.

TravelHub должен поддерживать организацию, где один сотрудник выполняет несколько функций.

Проверить, что Step 2.3B:
- не усиливает hardcoded role architecture;
- использует capability permission;
- не делает SALES_MANAGER identity prerequisite;
- остаётся совместимым с будущим admin-configurable access to operational centers.

Если current global security architecture всё ещё только role presets, это может быть known future step, но новый код не должен ухудшать ситуацию.

---

# 38. History

Inspect actual history payload.

Проверить:
- immutable;
- actor;
- action;
- from/to scheme;
- semantic config;
- monetary summary;
- no raw request;
- no PII.

---

# 39. History truthfulness

При replace terms:
- old values действительно старые;
- new values authoritative normalized;
- failed CAS не пишет history;
- failed validation не пишет history.

---

# 40. AuditLog

Проверить:
`sales.checkout.payment_terms_changed`

или фактический action.

No PII.
Correlation inherited.
No spoof.
Failure atomicity.

---

# 41. Temporal

`updatedAt` не должен быть milestone.

Отдельный selectedAt не обязателен, если history отвечает на business question.

Проверить, что docs не называют updatedAt моментом выбора terms.

---

# 42. Payment absence

Repo/schema/runtime:

- отдельная Payment entity не появляется из 2.3B;
- no PSP intent;
- no provider ref;
- no authorization/capture;
- no paid status.

---

# 43. Sale isolation

Проверить Sale остаётся OPEN.

Terms selection не означает:
- Sale closed;
- Sale completed;
- sale paid.

---

# 44. Order/Booking isolation

Проверить exact before/after counts.

Никаких Order/Booking rows.

---

# 45. Outbox

Проверить:
- no PaymentTermsSelected event;
- no OrderRequested;
- no OrderCreated;
- no unrelated event.

Использовать before/after delta, не global zero, чтобы shared-DB tests были order-independent.

---

# 46. Failure atomicity

Для invalid input / stale CAS / cancelled:
- Checkout unchanged;
- no history;
- no audit;
- no outbox.

---

# 47. Test hygiene

Отдельно review изменения в `checkout-commercial-intent.e2e-spec.ts`, которые report относит к 2.3A review-fix.

Проверить:
- concurrency test legitimate;
- outbox delta fix does not hide bug;
- no cleanup of rows that belong to scenario under test;
- no suite-order dependence;
- no broad delete that masks production effects.

---

# 48. Unit test quality

Не считать количество тестов достаточным.

Inspect assertions for:
- all schemes;
- invalid combinations;
- rounding;
- boundary;
- overflow;
- reconciliation;
- no float.

---

# 49. E2E quality

Inspect all 16 tests and mapping to claimed 24 checks.

Не принимать multiple claims from one weak assertion.

Добавить missing targeted tests where needed.

---

# 50. Required targeted tests if absent

Обязательные candidates:

1. actual legacy-like no-backfill;
2. terms update vs cancel race;
3. terms update vs traveler mutation race;
4. terms update vs serviceDate mutation race;
5. quote expires after Checkout created;
6. Catalog price changes after Checkout;
7. acquisition unchanged;
8. availability unchanged;
9. failure creates no audit/history/outbox;
10. awkward half-up boundary;
11. Decimal overflow controlled;
12. capability without role-name dependency where test harness permits.

---

# 51. Runtime verification

На isolated test DB/backend:

- create issued Quote;
- create Checkout;
- observe paymentTerms null;
- set each canonical scheme;
- inspect exact DB values;
- replace terms;
- stale version;
- cancel;
- attempt mutation after cancel;
- inspect history/audit;
- verify no Order/Booking/Payment;
- verify Sale OPEN;
- verify no OrderRequested;
- verify availability unchanged;
- verify acquisition unchanged;
- verify requestId/error envelope.

Не загрязнять dev DB.

---

# 52. Migration status/replay/drift

Run:
- migrate status;
- clean replay on fresh isolated DB;
- migrate diff;
- no drift;
- migration count expected 26 unless repository has legitimately advanced.

No `db push`.

---

# 53. Full regression

Backend:
- `tsc --noEmit`;
- all unit;
- targeted payment terms;
- Step 2.1/2.2/2.3/2.3A regressions;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- `next build`.

Skipped=0 unless explicitly justified.
Timeouts are failures, not pass.

---

# 54. Documentation

Review `payment-terms-foundation.md`.

It must truthfully document:
- owner;
- scheme vocabulary;
- exact scheme semantics;
- DEPOSIT vs PARTIAL;
- Decimal;
- binding price;
- null semantics;
- due trigger vs due timestamp;
- mutability;
- history/audit;
- capability boundary;
- no Payment;
- no reservation;
- Step 2.4 prerequisites.

---

# 55. PMT-* baseline reconciliation — IMPORTANT

Implementation report mentions Baseline `PaymentTerms: PMT-*`, while implementation stores terms directly on CheckoutIntent and does not create PMT entity/code.

Strict Review MUST explicitly resolve this.

Determine what PMT-* means in canonical baseline:
- future Finance PaymentTerms entity?
- commercial scheme catalog?
- immutable terms snapshot?
- required entity already at 2.3B?

Do not ignore this discrepancy.

Classify:
A. current inline Checkout terms are correct precursor; PMT belongs later;
B. docs need clarification only;
C. roadmap violation;
D. architecture decision required.

---

# 56. Partner selection claim — IMPORTANT

Report says Baseline: “Partner выбирает только разрешённые схемы”, while current API is internal staff-only and PARTNER gets 403.

Resolve:
- Is Partner selection expected in 2.3B?
- Or 2.3B only defines foundation, with Partner configuration later?
- Where are “allowed schemes” configured?
- Is current implementation missing an allowlist/source-of-truth?

If Roadmap requires partner-specific allowed schemes NOW and implementation accepts all 5 globally, this may be a substantive gap.

Do not silently defer it.

---

# 57. Allowed schemes source-of-truth — CRITICAL

Find whether existing Partner/Tariff/Product/Storefront has a canonical allowed-payment-schemes field/model.

If yes:
- Checkout terms selection must enforce it.

If no:
- determine roadmap owner-step;
- current global 5-scheme selection may be too permissive;
- classify as acceptable foundation vs blocker.

No arbitrary JSON/config.

---

# 58. PARTIAL vs DEPOSIT business distinction

Report explicitly says difference is only due semantics.

Check whether this is sufficient for future:
- refunds;
- cancellation;
- accounting;
- partner payout;
- service fulfillment.

Do NOT implement future Finance behavior, but ensure semantic names won't require reinterpretation.

If DEPOSIT has legally/financially distinct meaning not captured beyond due trigger and Roadmap expects that distinction now → architecture issue.

---

# 59. Step 2.4 readiness

Strict Review must state whether Step 2.4 may begin after approval.

Before 2.4, explicitly list unresolved mandatory gates:

- DD-022 reservation/locking;
- Outbox retry reliability;
- Sale completion atomicity/idempotency;
- commercial snapshot;
- payment terms snapshot;
- acquisition propagation;
- any allowed-scheme enforcement gap found here.

If any is a **pre-step** prerequisite rather than something Step 2.4 itself owns, say so clearly.

---

# 60. Required explicit answers

Answer each:

1. Scope respected?
2. Owner correct?
3. Canonical five schemes confirmed?
4. Any missing scheme?
5. FULL semantics correct?
6. PARTIAL semantics correct?
7. DEPOSIT part-of-total proven by canonical source?
8. DEPOSIT vs PARTIAL distinction sufficient?
9. PAY_LATER semantics correct?
10. PAY_AT_SERVICE semantics correct?
11. Due trigger honest?
12. No fake due timestamp?
13. Frozen Checkout is price authority?
14. No Catalog reprice?
15. No frontend derived amounts?
16. Decimal only?
17. Half-up correct?
18. Reconciliation exact?
19. Overflow controlled?
20. Currency safe?
21. NULL semantics honest?
22. Migration no fake backfill?
23. Actual legacy-like proof exists?
24. Projection stable?
25. Dedicated command only?
26. Mass assignment blocked?
27. Per-scheme validation strict?
28. Cancelled immutable?
29. Quote-expiry policy safe?
30. CAS safe?
31. Terms/cancel race safe?
32. Terms/traveler race safe?
33. Terms/serviceDate race safe?
34. Availability unchanged?
35. Reservation still mandatory before OrderRequested?
36. Acquisition unchanged?
37. Capability-driven?
38. No hardcoded SALES_MANAGER?
39. Small-organization future capability model preserved?
40. History truthful?
41. Audit no PII?
42. Failure atomic?
43. No Payment?
44. Sale remains OPEN?
45. No Order?
46. No Booking?
47. No OrderRequested?
48. No unnecessary event?
49. Test hygiene safe?
50. Runtime verified?
51. Clean replay?
52. No drift?
53. Full regression green?
54. PMT-* discrepancy resolved?
55. Partner “allowed schemes” requirement resolved?
56. Source-of-truth for allowed schemes exists?
57. Any blocker?
58. Architecture decision required?
59. Approve Step 2.3B?
60. Is repository ready to receive Step 2.4 prompt, or is a prerequisite implementation step required first?

---

# 61. Findings severity

Classify every finding:

- BLOCKER
- HIGH
- MEDIUM
- LOW
- DOC
- TEST GAP
- NON-ISSUE

For every actual defect:
- problem;
- risk;
- root cause;
- files;
- fix;
- targeted tests;
- regression result.

---

# 62. Required final report format

Return:

# PHASE 2 — STEP 2.3B — PAYMENT TERMS / PAYMENT SCHEME FOUNDATION — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Files/modules inspected
4. Roadmap scope
5. Previous-step invariants
6. Ownership
7. PMT-* baseline reconciliation
8. Scheme vocabulary
9. Scheme semantics matrix
10. FULL_PREPAYMENT
11. PARTIAL_PREPAYMENT
12. DEPOSIT
13. PARTIAL vs DEPOSIT distinction
14. PAY_LATER
15. PAY_AT_SERVICE
16. Due semantics
17. Data model
18. Monetary authority
19. Binding-price preservation
20. Decimal implementation
21. Rounding
22. Reconciliation
23. Overflow
24. Currency
25. Null/not-selected semantics
26. Migration review
27. Legacy no-backfill proof
28. Projection
29. API surface
30. DTO/mass-assignment
31. Per-scheme validation
32. Mutability
33. Quote-expiry interaction
34. CAS
35. Concurrency races
36. Traveler interaction
37. Service-date interaction
38. Availability isolation
39. DD-022 reservation gate
40. Acquisition isolation
41. RBAC/capabilities
42. Small-organization capability compatibility
43. Partner allowed-schemes requirement
44. Allowed-schemes source of truth
45. History
46. Audit
47. Temporal semantics
48. Privacy
49. Payment/Finance absence
50. Sale isolation
51. Order/Booking isolation
52. Outbox/events
53. Failure atomicity
54. Test hygiene
55. Unit quality
56. E2E quality
57. Runtime verification
58. Replay/drift
59. Full regression
60. Documentation
61. Deferred decisions
62. Step 2.4 readiness
63. Remaining prerequisites
64. Findings
65. Review fixes
66. Remaining debt
67. Architecture decision status
68. Approval recommendation
69. Out-of-scope confirmation
70. Files changed during review

---

# 63. Allowed verdicts

Use exactly one:

`PHASE 2 STEP 2.3B STRICT REVIEW COMPLETED — APPROVED`

or

`PHASE 2 STEP 2.3B REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

or

`ARCHITECTURE DECISION REQUIRED`

or

`PHASE 2 STEP 2.3B STRICT REVIEW FAILED — BLOCKER FOUND`

---

# 64. Stop condition

После Strict Review:

**НЕ начинать Step 2.4.**

Вернуть полный review report.

Если verdict = APPROVED, отдельно указать:
- можно ли сразу переходить к Step 2.4;
- либо сначала нужен prerequisite implementation prompt (например reservation/locking/reliability gate).

Ждать explicit approval текущего review.
