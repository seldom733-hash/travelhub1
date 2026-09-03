# PHASE 3 — PRE-STEP 3.12 — D3 — TRAVELER COLLECTION + ORDER/BOOKING POPULATION — STRICT REVIEW

## ROLE — MANDATORY

Ты работаешь как **Independent Senior Software Architect + Principal Code Reviewer + QA/Security Reviewer** проекта TravelHub.

Это независимый Strict Review D3. Existing code, implementation report и tests — evidence, но не canonical business truth. Сначала восстанови canonical lifecycle и current runtime lifecycle, затем сравни их. Root cause before remediation. Не защищай существующую реализацию только потому, что тесты зелёные.

Проверяй по цепочке:

```text
CANONICAL CONTRACT
→ CODE
→ DB
→ API
→ UI
→ RUNTIME
→ EVENT FLOW
```

Не ставь VERDICT A при unresolved lifecycle contradiction, PII/security gap, dirty Git state или недоказанном Request flow. D4 не начинать.

## LANGUAGE REQUIREMENT — MANDATORY

Все reports/findings/root cause/architecture/security/runtime evidence/conclusions должны быть преимущественно **на русском**. English допустим только для identifiers, paths, endpoints, enums, permissions, commands, code snippets и standardized VERDICT strings. Преимущественно английский report = TASK INCOMPLETE. Secrets/passwords/tokens не публиковать.

## 1. ACCEPTED BASELINE

Не переоткрывать без contradictory evidence:

```text
D0 ACCEPTED
D1 ACCEPTED
D1A ACCEPTED
D2 ACCEPTED
```

D2: `NOT_REQUESTED / OPTIONAL / REQUIRED`; effective requirements = ProductType defaults + explicit Product override; `firstName/lastName` REQUIRED для каждого Traveler V1; ProductType immutable after creation.

D3 implementation report = `IMPLEMENTATION COMPLETED — PENDING STRICT REVIEW`, а не ACCEPTED.

## 2. PRIMARY LIFECYCLE QUESTION

D1 canonical lifecycle:

```text
termsAcceptedAt
→ PIN requirements
→ Traveler collection
→ travelerDataCompletedAt
→ final confirmation
→ finalConfirmedAt
→ Order
→ Booking
```

D3 report описывает фактически:

```text
OrderRequestedConsumer
→ Order creation
→ termsAcceptedAt = Order creation time
→ pinnedRequirements on Order
→ OrderTraveler[]
→ Traveler collection
→ finalConfirmedAt
→ Booking later
```

Проверь по коду/runtime:

```text
Does Order exist BEFORE finalConfirmedAt?
```

Если YES — это потенциальное нарушение D1 и должно быть архитектурно разрешено, а не проигнорировано.

## 3. ONLY TWO LEGITIMATE OUTCOMES

### Option A — D1 remains canonical

Тогда canonical Order создаётся только после final confirmation. Текущая implementation требует remediation.

### Option B — current Order intentionally exists pre-confirmation

Тогда formal architecture reconciliation mandatory. Определи:

```text
What is Order before final confirmation?
Is it provisional?
When does commercial conversion occur?
When is commerceSequence authoritative?
When may Booking start?
When does Request.convertedAt occur?
How is pre-confirmed Order excluded from KPIs/finance/operations?
What status distinguishes provisional vs committed?
```

Если Option B выбран, canonical architecture + roadmap должны быть явно обновлены до VERDICT A. Silent D1 drift запрещён.

## 4. TERMSACCEPTEDAT — HARD

D3 report утверждает `termsAcceptedAt = now` при Order creation.

Проверь:
1. реальное customer acceptance event;
2. upstream persisted timestamp в CheckoutIntent/Sale/Request;
3. не теряется ли original timestamp;
4. не используется ли consumer execution time как business event time.

Hard:

```text
business event timestamp ≠ processing timestamp
```

Если `termsAcceptedAt` synthetic `now()` без реального acceptance event → FAIL.

## 5. PIN TIMING / RACE — CRITICAL

D1 требует pin **в момент acceptance**.

Проверь:

```text
T1 customer accepts Product policy A
T2 Product changes to policy B
T3 async OrderRequested consumer runs
```

Expected:

```text
accepted checkout uses A
```

Если consumer читает mutable Product только на T3 и получает B — snapshot pinning реализован слишком поздно.

Тест «Product changed after Order already created» не закрывает этот race.

Hard gate: acceptance→pin race must be impossible.

## 6. PRE-ORDER ACCEPTED STATE OWNER

Audit actual:

```text
CheckoutIntent
Sale
Request
Quote
OrderRequested payload
other accepted state
```

Определи canonical owner состояния между `termsAcceptedAt` и committed Order.

Проверь, где должны жить:

```text
termsAcceptedAt
pinnedRequirements
travelerCount
traveler collection progress
```

Не принимай утверждение «до Order негде хранить» без schema/code evidence.

## 7. ORDERTRAVELER SEMANTICS

Implementation создаёт `OrderTraveler[]` вместе с Order, до completed collection.

Определи contract:

```text
A. OrderTraveler = confirmed immutable traveler snapshot
B. OrderTraveler = mutable pre-confirmation draft under Order
```

Нельзя одновременно считать его confirmed snapshot и изменять до final confirmation без явной state semantics.

Проверь `position`, `dataCompleteness`, mutation rules и lock after final confirm.

## 8. FINAL CONFIRMATION STATE MACHINE

Проверь `POST /orders/:id/final-confirm`.

Установи:
- что именно становится committed;
- меняется ли Order status;
- какой event emitted;
- когда Request converted;
- когда Booking становится eligible;
- виден ли Order в operational/financial registry до final confirmation.

Если final-confirm лишь ставит timestamp на уже полностью действующий Order — это architecture risk.

## 9. REQUEST FLOW — REAL E2E REQUIRED

No-Request test НЕ доказывает Request semantics.

Обязателен реальный:

```text
Request
→ supplier response/current terms
→ customer acceptance
→ termsAcceptedAt
→ pin
→ travelers
→ final confirmation
→ Order
→ Request.convertedAt
```

Verify:

```text
before Order:
convertedAt = NULL
convertedOrderId = NULL

after successful conversion:
convertedAt present
convertedOrderId = actual Order.id
```

Если current Request path не интегрирован с D3 → FAIL/NOT IMPLEMENTED, не PASS.

## 10. NO-REQUEST FLOW

Отдельно подтвердить authoritative flow без Request. Он должен сохраняться, но не заменять Request flow evidence.

## 11. TRAVELER COUNT FREEZE

Проверь `CheckoutIntentTraveler` как source.

Questions:
- party list mutable after acceptance?
- traveler rows можно add/remove during collection?
- `travelerCount` frozen at actual acceptance?
- count later read from mutable source?

Hard:

```text
accepted travelerCount is immutable accepted commerce state
```

## 12. MULTI-TRAVELER

Повтори минимум 2 Travelers:

```text
count=2
Traveler2 missing REQUIRED
→ final confirm denied
complete Traveler2
→ completion timestamp
→ final confirm
→ exactly 2 traveler snapshots
→ exactly 2 Passenger
```

Identity order stable via `position`. Проверь legacy `position=0` semantics.

## 13. REQUIRED / OPTIONAL / NOT_REQUESTED

Server runtime:
- REQUIRED missing → reject/block;
- OPTIONAL absent → allowed;
- OPTIONAL invalid supplied → reject;
- NOT_REQUESTED → canonical minimization policy.

Проверь stale sensitive values: если раньше field был collected, а accepted snapshot теперь NOT_REQUESTED, value не должен silently survive contrary to minimization contract.

## 14. COMPLETION TIMESTAMP MUST NOT GO STALE

Проверь `travelerDataCompletedAt`:

```text
Can it remain set after traveler data becomes incomplete?
Can a required field be cleared after completion but before final confirm?
```

Если mutation makes collection incomplete, completion state/timestamp must remain semantically correct.

Product mutation не должна влиять — validation uses pinned snapshot.

## 15. FINAL-CONFIRM IDEMPOTENCY

Проверь double click/concurrent/network retry end-to-end.

Expected:

```text
one final confirmation
one committed conversion
one history milestone
no duplicate commerce root
no duplicate BookingRequested
no duplicate Booking
```

`409` второго запроса недостаточно, если downstream event уже duplicated.

## 16. BOOKING ELIGIBILITY — HARD

Проверь current `process → confirm → send → BookingRequested`.

Hard:

```text
Booking MUST NOT start before finalConfirmedAt
```

Попробуй server-side trigger/send до final confirmation.

Если Booking можно создать раньше → blocking D3 defect.

## 17. PASSENGER POPULATION

Verify applicable fields:

```text
final confirmed OrderTraveler
→ Booking Passenger
```

No Customer fallback, no mutable Product lookup.

Проверь firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry where schemas support them.

## 18. CUSTOMER ≠ PAYER ≠ TRAVELER

Reverify:
- Customer not silently copied as Traveler;
- Payer not assumed Traveler;
- `customerId` not fallback for missing Traveler identity.

Explicit prefill can remain deferred.

## 19. AUTHORIZATION / TENANT ISOLATION — IMPORTANT

Implementation report говорит, что foreign PARTNER получает 403 потому что PARTNER вообще не имеет `order.*`.

Это не автоматически корректная tenant isolation.

Проверь intended Partner Workspace behavior:

```text
owning Partner → correct access?
foreign Partner → denied?
Platform authorized role → correct access?
Platform unauthorized role → denied?
buyer/customer actor → according to canonical checkout contract?
```

Hard:

```text
permission scope + object scope
```

Blanket deny всех Partner нельзя считать PASS, если legitimate owning Partner обязан работать с traveler data.

## 20. PII

Audit access/redaction/logging for:
`birthDate`, `passportNumber`, `passportExpiry`, `citizenship`, `gender`.

Product permission ≠ Traveler PII permission.

D4 делает deeper privacy hardening, но D3 не может иметь cross-tenant/broad-role PII leakage.

## 21. FRONTEND PLACEMENT

Traveler panel сейчас в `/app/orders/[id]`.

Проверь:

```text
Is Order Center canonical place for pre-final-confirm traveler collection?
```

Если D1 says Order does not exist yet, UI placement itself signals lifecycle drift.

## 22. REAL BROWSER RUNTIME — MANDATORY

Scenario A:
```text
accepted context
→ 2 travelers
→ missing REQUIRED
→ final confirm blocked
```

Scenario B:
```text
partial save
→ reload
→ same traveler identity/order
→ persisted values
```

Scenario C:
```text
complete all
→ final confirm
→ locked/immutable
→ Booking eligible/result
```

Scenario D — critical:
```text
before final confirm:
Does Order already exist?
What status?
Is it visible in Orders registry?
Can it be sent to Booking?
```

Browser source review is insufficient.

## 23. DB/API/UI/EVENT RECONCILIATION

For one case reconcile:
- real acceptance timestamp;
- pinned requirements;
- travelerCount;
- traveler rows;
- completion timestamp;
- final confirmation timestamp;
- Order lifecycle/state;
- Request conversion;
- Booking event/result.

No contradictory chronology.

## 24. GIT / WORKTREE CLOSURE

Implementation report had `HEAD == origin/master`, but working tree was dirty: untracked D3 evidence + tracked deletion from previous phase.

Strict Review must:
1. inspect `git status --short`;
2. identify tracked deletion;
3. restore/commit intentionally;
4. properly keep/remove/ignore tmp evidence;
5. finish:

```text
push SUCCESS
HEAD == origin/master
working tree clean
```

No VERDICT A with dirty tree.

## 25. REGRESSION REQUALIFICATION

Independently verify claimed pre-existing failures against clean baseline SHA vs current D3 SHA.

Report exact suites/errors. Do not repeat implementation author's assertion without evidence.

## 26. CANONICAL DOC / ROADMAP SYNC

If D3 changes D1 semantics, explicitly update canonical architecture and roadmap before acceptance.

Forbidden:

```text
code lifecycle changed
docs still old
VERDICT A
```

If implementation actually conforms to D1, prove why.

## 27. DO NOT TOUCH UNRELATED DEBTS

Do not remediate D4–D14 unrelated work:
D4 representative chains/security expansion, D5/D6 details, D7 finance semantics, D8 temporal visibility, D9 export, D10 attribution, D11 KPI/status reconciliation, D12 drill-down, D13 voucher, D14 final requalification.

Exception: Booking-before-final-confirm or other direct D3 lifecycle bypass must be fixed now.

## 28. REQUIRED STRICT REVIEW REPORT

Create:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D3_TRAVELER_COLLECTION_ORDER_BOOKING_POPULATION_STRICT_REVIEW_REPORT.md
```

Predominantly Russian.

Sections:
1. Executive Summary
2. Starting Git State
3. Canonical D1/D2 Contract
4. Current D3 Lifecycle Reconstruction
5. D1 vs D3 Lifecycle Diff
6. termsAcceptedAt Semantics
7. Pin Timing / Race Analysis
8. Pre-Order Accepted State Ownership
9. Order Creation Semantics
10. OrderTraveler Semantics
11. Traveler Count
12. Completion Semantics
13. Final Confirmation State Machine
14. Request Flow Verification
15. No-Request Flow Verification
16. Booking Eligibility
17. Passenger Population
18. Customer/Payer/Traveler Separation
19. Authorization/Tenant Isolation
20. PII Review
21. Browser Runtime
22. DB/API/UI/Event Reconciliation
23. Regression Requalification
24. Git/Worktree Closure
25. Findings Matrix
26. Remediation Performed
27. Canonical Architecture/Roadmap Sync
28. Acceptance Matrix
29. Residual Risks
30. Final Verdict
31. TRUE NEXT

## 29. FINDINGS MATRIX

| ID | Severity | Finding | Evidence | Root Cause | Required Action | Result |
|---|---|---|---|---|---|---|

Severity:
`P0 critical`, `P1 blocking lifecycle/security`, `P2 important correctness`, `P3 minor`.

Do not downgrade lifecycle contradictions because tests pass.

## 30. ACCEPTANCE MATRIX — HARD

| Gate | Result | Evidence |
|---|---|---|
| D1 lifecycle reconstructed | | |
| Current D3 lifecycle reconstructed | | |
| D1 vs D3 contradiction resolved | | |
| termsAcceptedAt = real acceptance event | | |
| Requirements pinned at actual acceptance | | |
| Acceptance→pin race impossible | | |
| Pre-Order accepted state canonical owner | | |
| Order creation timing canonical | | |
| OrderTraveler semantics canonical | | |
| Traveler count frozen correctly | | |
| Multi-traveler stable | | |
| REQUIRED/OPTIONAL/NOT_REQUESTED correct | | |
| travelerDataCompletedAt never stale | | |
| finalConfirmedAt transition canonical | | |
| Real Request flow E2E | | |
| Request convertedAt timing | | |
| No-Request flow E2E | | |
| Booking impossible before final confirmation | | |
| Passenger from final traveler snapshot | | |
| Customer ≠ Payer ≠ Traveler | | |
| Owning Partner access correct | | |
| Foreign Partner denied | | |
| Platform permissions correct | | |
| PII safe/redacted | | |
| Browser failure path | | |
| Browser save→reload→resume | | |
| Browser success path | | |
| DB/API/UI/Event reconciliation | | |
| Concurrent/retry idempotency | | |
| Regression baseline independently verified | | |
| Canonical docs synced if changed | | |
| Roadmap synced | | |
| HEAD == origin/master | | |
| Working tree clean | | |
| Russian report | | |

Every PASS requires concrete evidence.

## 31. VERDICT

VERDICT A only if all blocking lifecycle/security/data gates PASS, no unresolved P0/P1/blocking P2, canonical docs/roadmap synchronized, Git clean.

```text
VERDICT A — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
STRICT REVIEW PASSED — D3 ACCEPTED
```

Otherwise:

```text
VERDICT B — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
STRICT REVIEW FAILED — REMEDIATION REQUIRED
```

## 32. TRUE NEXT

Only after VERDICT A:

```text
D3 — ACCEPTED

TRUE NEXT:
D4 — TRAVELER SECURITY + REPRESENTATIVE DATA
     + REPRESENTATIVE END-TO-END COMMERCE CHAIN COVERAGE

NOT STARTED.
```

If VERDICT B:

```text
TRUE NEXT:
D3 REMEDIATION / EVIDENCE CLOSURE

D4 NOT STARTED.
```

## 33. PRESERVE D4 PRINCIPLE

```text
REPRESENTATIVE CHAIN COVERAGE ≠ STATUS COVERAGE
```

D4 later builds valid end-to-end chains where statuses arise naturally. Do not implement D4 now.

## 34. STOP RULE

After Strict Review report:

```text
STOP.
```

Do not start D4 automatically.
