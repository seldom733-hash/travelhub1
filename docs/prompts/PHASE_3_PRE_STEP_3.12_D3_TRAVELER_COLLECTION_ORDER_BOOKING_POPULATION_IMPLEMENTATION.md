# PHASE 3 — PRE-STEP 3.12 — D3 — TRAVELER COLLECTION + ORDER/BOOKING POPULATION — IMPLEMENTATION

## ROLE — MANDATORY

Ты работаешь как **Senior/Staff Software Engineer + Software Architect + Backend Engineer + Frontend Engineer + Database Engineer + Security Engineer + QA Engineer** проекта TravelHub.

Это implementation stage **D3**. Existing code — evidence, но не canonical business truth. Перед изменениями: **CANONICAL ARCHITECTURE CHECK → ROADMAP POSITION CHECK → CURRENT IMPLEMENTATION AUDIT → ROOT CAUSE/GAP ANALYSIS → IMPLEMENTATION → DB/API/UI/RUNTIME EVIDENCE**.

Не ставь VERDICT A только по source/tests. Не начинай D4.

## LANGUAGE REQUIREMENT — MANDATORY

Все reports, findings, root-cause, architecture/security decisions, runtime evidence и conclusions — преимущественно **на русском**. English допустим для identifiers, paths, endpoints, enums, commands, code и standardized VERDICT strings. Преимущественно английский report = TASK INCOMPLETE. Secrets/passwords не публиковать.

## 1. ACCEPTED BASELINE

Не переоткрывать без contradictory evidence:

```text
D0  ACCEPTED
D1  ACCEPTED
D1A ACCEPTED
D2  ACCEPTED
Final D2 SHA: a9a37102050547e0466a0aa8419d4b17f4b1169c
```

D2 froze:
- states `NOT_REQUESTED / OPTIONAL / REQUIRED`;
- `Product.travelerRequirements = NULL` → ProductType defaults;
- effective = defaults + explicit override;
- `firstName` + `lastName` REQUIRED для каждого Traveler V1;
- ProductType immutable after creation.

## 2. CANONICAL LIFECYCLE

Non-authoritative:

```text
Product → Request → Supplier response/current terms
→ Customer acceptance → termsAcceptedAt
→ PIN traveler requirements
→ Traveler collection → travelerDataCompletedAt
→ Final confirmation → finalConfirmedAt
→ Order → Booking
```

Authoritative:

```text
Product/current authoritative terms
→ termsAcceptedAt
→ PIN requirements
→ Traveler collection
→ final confirmation
→ Order → Booking
```

Request optional. Не делай Request обязательным.

Два события нельзя объединять:

```text
termsAcceptedAt = acceptance of current price/terms
finalConfirmedAt = confirmation after required traveler data
```

`convertedAt` = successful Order creation/linking.

## 3. PRIMARY D3 INVARIANT — PINNING

At `termsAcceptedAt`:

```text
effectiveRequirements =
getEffectiveTravelerRequirements(Product.type, Product.travelerRequirements)

PIN effectiveRequirements
```

После этого изменение Product НЕ должно менять требования уже принятого checkout/case.

```text
checkout validation MUST use pinned snapshot
NOT mutable current Product policy
```

Это hard gate.

## 4. AUDIT BEFORE IMPLEMENTATION

Проинспектируй actual models/services/endpoints:
`Product`, `Request`, `Order`, `Booking`, `Passenger`, `Customer`, current checkout/conversion, acceptance flow, `BookingRequested`, transactions/idempotency.

Определи:
1. где `termsAcceptedAt`;
2. существуют ли `travelerDataCompletedAt`, `finalConfirmedAt`;
3. какая pre-Order entity владеет accepted checkout state;
4. существует ли `OrderTraveler`;
5. current Passenger model/ownership;
6. Order→Booking mechanism;
7. transaction/idempotency boundaries;
8. canonical traveler count source.

Не создавай duplicate concepts.

## 5. CUSTOMER ≠ PAYER ≠ TRAVELER

Hard:

```text
Customer ≠ Payer ≠ Traveler
```

Роли могут принадлежать одному человеку, но domain objects различны. Не создавай Traveler автоматически из Customer и не считай payer Traveler.

Optional UX `"Я являюсь одним из туристов"` допустим только как explicit prefill/copy; Traveler остаётся отдельным.

## 6. TRAVELER COUNT

```text
Order / Booking → 1..N Travelers
```

Количество форм берётся из actual selected party/traveler count contract. Не хардкодить одного Traveler и не выводить count задним числом из Passenger.

Если canonical count отсутствует — минимально реализуй необходимое representation и задокументируй.

## 7. PINNED SNAPSHOT STORAGE

Snapshot должен принадлежать accepted commercial case/checkout, существующему **до Order**. Он должен быть server-owned и связан с `termsAcceptedAt`.

Client не может произвольно заменить snapshot JSON.

При необходимости копируй immutable historical snapshot в Order domain, но объясни решение.

## 8. ORDERTRAVELER

D3 должен установить `OrderTraveler` либо существующий canonical equivalent:

```text
Order
 └─ OrderTraveler[1..N]
```

Properties: FK→Order, stable ordinal, identity fields, requirement-dependent optional fields, historical snapshot semantics. UUID/FK only; связи не выводить из human-readable references.

`OrderTraveler` ≠ CRM Customer ≠ Payer ≠ Product config.

## 9. FIELD COLLECTION / MINIMIZATION

Catalog:
`firstName, lastName, birthDate, citizenship, gender, passportNumber, passportExpiry`.

По pinned snapshot:

```text
REQUIRED      → visible + required + server validated
OPTIONAL      → visible + validate if supplied
NOT_REQUESTED → ordinary UI does not request/store unnecessarily
```

Не собирать чувствительные поля “на всякий случай”. Для unexpected sensitive fields предпочесть safe rejection согласно canonical validation policy.

## 10. COMPLETION + FINAL CONFIRMATION

`travelerDataCompletedAt` ставится только когда все required Travelers присутствуют и все их REQUIRED fields валидны.

Order creation requires:

```text
termsAcceptedAt != null
pinned requirements exist
traveler count satisfied
all REQUIRED fields valid
travelerDataCompletedAt != null
explicit final confirmation
```

Тогда `finalConfirmedAt` = actual confirmation event.

`termsAcceptedAt` alone MUST NOT create Order для flow, требующего travelers.

Не использовать `updatedAt` как business timestamp.

## 11. ORDER / BOOKING POPULATION

Order conversion должна быть idempotent и transaction-safe. Не допускай `Order created but OrderTraveler missing`.

Conceptually:

```text
validate accepted case
→ validate pinned requirements/travelers
→ finalConfirmedAt
→ Order
→ OrderTraveler[]
→ Request.convertedAt if Request exists
→ existing Booking creation mechanism
→ Booking
→ Passenger / canonical Booking traveler snapshot
```

V1: `1 Order = 1 Booking`.

Passenger должен получать данные из confirmed `OrderTraveler`, не из Customer и не из mutable Product requirements. Не фабриковать поля, которых нет.

## 12. REQUEST + NO-REQUEST FLOWS

Request flow:

```text
supplier confirmation
→ customer acceptance
→ termsAcceptedAt
→ pin
→ travelers
→ final confirm
→ Order
→ convertedAt
```

Не ставить `convertedAt` до Order.

Также preserve authoritative no-Request architecture. Если current code физически не поддерживает его — зафиксируй gap; не создавай fake Request.

## 13. FRONTEND

В actual checkout/request continuation UI:
- Traveler 1..N;
- поля генерируются из **pinned requirements**, не hardcoded ProductType;
- REQUIRED visible/required;
- OPTIONAL visible/optional;
- NOT_REQUESTED hidden;
- localized RU/AZ/EN;
- clear validation.

Business-critical state не хранить только в React local state.

Required:

```text
save/progress → refresh → resume
```

Pinned requirements и entered traveler data сохраняются.

## 14. HARD IMMUTABILITY TEST

Обязательно:

```text
1 Product effective birthDate=OPTIONAL
2 accept terms
3 snapshot pinned
4 Product policy changes birthDate=REQUIRED
5 resume old accepted checkout → still OPTIONAL
6 new accepted checkout → REQUIRED
```

Safe deterministic fixture; restore state if appropriate.

## 15. HARD MULTI-TRAVELER TEST

Минимум 2 Travelers:

```text
Traveler1 valid
Traveler2 missing REQUIRED lastName
→ final confirmation denied

complete Traveler2
→ travelerDataCompletedAt
→ final confirmation succeeds
→ one Order
→ exactly 2 OrderTraveler
→ one Booking
→ exactly 2 Passenger/canonical Booking travelers
```

## 16. SECURITY / PII

Minimum D3 server-side checks:
- Partner A cannot access Partner B traveler data;
- actor cannot mutate another checkout/case;
- Platform access follows appropriate permission contract;
- Product read permission ≠ Traveler PII permission.

Не логировать full traveler payload/passport numbers. Validation errors не должны echo sensitive values.

D4 остаётся deeper privacy/security stage, но D3 не может вводить obvious PII leakage.

## 17. IDEMPOTENCY

Проверь double-click/retry final confirmation:

```text
one conversion
one Order
one OrderTraveler set
one Booking request/Booking per existing architecture
no duplicate commerce root
```

## 18. MIGRATION / DATA SAFETY

Forward migration only. **NO full DB reset**. Representative dataset сохранить. Backfill только deterministic/non-destructive.

D3 может добавить только targeted deterministic fixtures для traveler evidence.

```text
D3 minimal traveler evidence
≠ D4 representative end-to-end chain matrix
```

Preserve D4 rule:

```text
REPRESENTATIVE CHAIN COVERAGE ≠ STATUS COVERAGE
```

## 19. API / STATE PROTECTION

Reuse existing endpoint style where possible. Required capabilities conceptually:
- read pinned requirements;
- read/save traveler collection;
- completion validation;
- final confirm/conversion.

Server enforces actor + scope + lifecycle state + pinned snapshot + validation + idempotency.

Reject:
- traveler submission before acceptance;
- final confirmation before completion;
- duplicate final confirm creating duplicate Order;
- forbidden mutation after conversion;
- client mutation of pinned snapshot.

## 20. TESTS

Backend integration/e2e must cover:
- pin at termsAcceptedAt;
- snapshot immutability after Product mutation;
- REQUIRED/OPTIONAL/NOT_REQUESTED;
- multi-traveler cardinality;
- completion timestamp;
- final confirmation gate;
- Order + OrderTraveler;
- Booking + Passenger;
- Request convertedAt timing;
- no-Request flow if currently supported;
- cross-tenant denial;
- duplicate final confirm;
- legacy Product NULL defaults → pinned snapshot.

Frontend tests:
- render pinned requirements;
- required/optional/hidden behavior;
- multiple travelers;
- validation;
- save/resume;
- final confirm incomplete/success;
- RU/AZ/EN.

## 21. REAL BROWSER RUNTIME — MANDATORY

Source/API review не заменяет browser runtime.

Success path:

```text
accepted terms
→ traveler form
→ fill required fields
→ save
→ refresh
→ data persists
→ final confirm
→ Order
→ Booking/Passenger verified
```

Failure path:

```text
missing required field
→ final confirmation blocked
```

Если UI отсутствует — его implementation входит в D3.

## 22. DB → API → UI RECONCILIATION

Для deterministic success scenario доказать:

```text
DB pinned requirements
= API pinned requirements
= UI rendered requirements
```

и applicable traveler fields:

```text
submitted traveler
= OrderTraveler
= Passenger/canonical Booking traveler
```

Counts:

```text
expected traveler count
= OrderTraveler count
= Passenger count
```

## 23. REPRESENTATIVE DATA SAFETY

До/после сравнить relevant counts:
`Products, Requests, Orders, Bookings, Payments, Customers, Partners`.

No unexplained destructive loss. Targeted D3 fixtures могут детерминированно увеличить counts.

## 24. DO NOT TOUCH UNRELATED DEBTS

Не исправлять D3:
- Booking/Order KPI semantics;
- Analytics Active Customers 51 → CRM 92;
- Export Framework;
- Partner Performance attribution;
- Order/Booking full-page details;
- Payment/refund presentation;
- Voucher.

Они остаются D5–D13, особенно:

```text
D11 PROJECT-WIDE KPI / STATUS SEMANTICS + TOTAL RECONCILIATION
D12 CRM / KPI DRILL-DOWN ROUTING REQUALIFICATION
```

## 25. REQUIRED IMPLEMENTATION REPORT

Создай:

`docs/reports/PHASE_3_PRE_STEP_3.12_D3_TRAVELER_COLLECTION_ORDER_BOOKING_POPULATION_IMPLEMENTATION_REPORT.md`

Преимущественно русский.

Sections:
1. Executive Summary
2. Starting Git State
3. Canonical Architecture Check
4. Current-State Audit
5. Gap Analysis
6. Schema/Migration Design
7. Pinned Requirements Design
8. Traveler Domain Model
9. Customer/Payer/Traveler
10. Cardinality
11. Validation
12. Completion Semantics
13. Final Confirmation
14. Order Creation
15. OrderTraveler
16. Booking/Passenger
17. Request Flow
18. Authoritative Flow
19. API
20. Frontend
21. Security
22. Idempotency
23. DB Evidence
24. API Runtime
25. Browser Runtime
26. Multi-Traveler Evidence
27. Snapshot Immutability Evidence
28. Regression
29. Representative Data Safety
30. Findings/Remediation
31. Files Changed
32. Roadmap Status
33. Git State
34. Residual Risks
35. Final Verdict
36. TRUE NEXT

## 26. ACCEPTANCE MATRIX — REQUIRED

| Gate | Result | Evidence |
|---|---|---|
| Current domain audited | | |
| Requirements pinned at termsAcceptedAt | | |
| Snapshot immutable after Product change | | |
| Traveler count canonical | | |
| Customer ≠ Traveler preserved | | |
| REQUIRED validation server-side | | |
| OPTIONAL semantics correct | | |
| NOT_REQUESTED minimization | | |
| Multi-traveler supported | | |
| travelerDataCompletedAt correct | | |
| finalConfirmedAt distinct from termsAcceptedAt | | |
| Final confirmation gate enforced | | |
| Order creation idempotent | | |
| OrderTraveler populated | | |
| Booking populated | | |
| Passenger/canonical travelers populated | | |
| Request convertedAt timing correct | | |
| No-Request architecture preserved | | |
| Cross-tenant traveler access denied | | |
| Sensitive data not exposed in logs | | |
| Legacy NULL Product supported | | |
| DB/API/UI snapshot reconciliation | | |
| Traveler count reconciliation | | |
| Save→refresh/resume | | |
| Browser required-field failure | | |
| Browser successful lifecycle | | |
| Backend tests | | |
| Frontend tests | | |
| Representative DB preserved | | |
| Russian report | | |
| Git evidence | | |

Every PASS requires concrete evidence.

## 27. ROADMAP / REVIEW RULE

Это implementation, поэтому успешный статус:

```text
D3 — IMPLEMENTED
PENDING STRICT REVIEW
```

Не ставить `D3 ACCEPTED`.

Следующее действие — **D3 STRICT REVIEW**, не D4.

## 28. GIT REQUIREMENTS

Start:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
```

After implementation/tests/runtime:

```bash
git diff --check
git status
git diff
git add ...
git commit -m "..."
git push origin master
git rev-parse HEAD
git rev-parse origin/master
git status
```

Report exact:
`Starting SHA, Final SHA, origin/master, HEAD==origin/master, Working tree`.

Successful implementation requires push SUCCESS, HEAD==origin/master, clean tree.

## 29. VERDICT

Success:

```text
VERDICT A — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
IMPLEMENTATION COMPLETED — PENDING STRICT REVIEW
```

Failure:

```text
VERDICT B — D3 TRAVELER COLLECTION + ORDER/BOOKING POPULATION
IMPLEMENTATION INCOMPLETE
```

VERDICT A forbidden if requirements not pinned, mutable Product policy drives accepted checkout, Customer auto-equals Traveler, multi-traveler impossible, validation frontend-only, premature Order creation, OrderTraveler/Booking traveler population missing, PII cross-tenant leak, duplicate conversion, browser lifecycle missing, or DB/API/UI reconciliation fails.

## 30. PRESERVE MASTER DEBT SEQUENCE

```text
D3  Traveler Collection + Order/Booking Population
D4  Traveler Security + Representative Data
    + Representative End-to-End Commerce Chain Coverage
D5  Orders Full-Page Detail
D6  Bookings Full-Page Detail
D7  Payment/Refund Semantics + Financial Presentation
D8  Global Temporal Visibility
D9  Export Framework Requalification
D10 Partner Performance Attribution
D11 PROJECT-WIDE KPI / STATUS SEMANTICS
    + TOTAL RECONCILIATION AUDIT & REMEDIATION
D12 CRM / KPI Drill-down Routing Requalification
D13 Voucher
D14 PRE-STEP 3.12 Final Requalification
STEP 3.12
```

## 31. STOP RULE

После implementation report:

```text
STOP.
```

Не начинай Strict Review автоматически и не начинай D4.

Final successful lines:

```text
D3 IMPLEMENTATION COMPLETE
PENDING STRICT REVIEW

NEXT ACTION:
D3 STRICT REVIEW

NOT STARTED.
```
