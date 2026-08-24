# PHASE 3 — POST-SEED STAGE D VALIDATION
## 2026 DEMO DATASET ACCEPTANCE + DETERMINISTIC WHY RUNTIME GATE

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, audit findings, evidence, таблицы, объяснения, результаты тестов,
runtime/browser evidence, итоговый отчёт и VERDICT должны быть **НА РУССКОМ ЯЗЫКЕ**.

Технические identifiers, paths, models, enums, endpoints, fields, SHA, commands и code
сохранять в оригинальном виде.

# 1. PURPOSE

Stage D уже завершён:

```text
VERDICT A — STAGE D COMPLETE
```

2026 demo seed сообщил:

```text
VERDICT A — 2026 DEMO DATASET COMPLETE
```

Перед Stage E выполнить короткий combined acceptance gate:

```text
A. подтвердить фактическое соответствие 2026 dataset seed-контракту;
B. проверить Stage D на богатом realistic dataset;
C. доказать цепочку:
   DATA → DETECTOR → SIGNAL → EVIDENCE → WHAT → WHY;
D. проверить claim safety и отсутствие fabricated causality;
E. определить readiness Stage E.
```

Это НЕ новый implementation stage.

Не реализовывать Stage E/F/G/H/I/J.

Разрешены только минимальные seed/Stage-D remediation changes, если найден реальный defect.

# 2. REPORTED DATASET BASELINE

Reported:

```text
Partners:       25
Customers:      248
Products:       140
Orders:         1,000
Payments:       826
Bookings:       703
Refunds:        39
Commissions:    732
Subscriptions:  6
GMV:            ~136,625 AZN
Period:         Jan–Dec 2026
Seed runtime:   ~6.5 sec
Decision Queue: 5/6 detectors
```

Added:

```text
39 refunds
8 failed payments
5 pending bookings
6 storefront subscriptions
48 storefront customers
2 subscription plans
```

Не принимать reported totals без DB/runtime verification.

# 3. CHECK A — MARKETPLACE / STOREFRONT ENTITY COUNTS

Seed contract:

```text
Marketplace partners: 20–30
Marketplace customers: 120–150

Storefront partners: 10
Storefront customers: <=70
```

Reported summary `Partners=25`, `Customers=248` недостаточна для доказательства scopes.

Вернуть authoritative breakdown:

| Context | Partners | Customers | How classified |
|---|---:|---:|---|
| Marketplace | | | |
| Storefront | | | |
| Dual-capability, if supported | | | |
| Other/internal/test excluded | | | |

Ответить:

```text
Marketplace partner target PASS/FAIL
Marketplace customer target PASS/FAIL
Storefront partner target PASS/FAIL
Storefront customer target PASS/FAIL
```

Не считать internal users/customer records другого scope частью target.

# 4. STOREFRONT — 10 PARTNERS VS 8 ACTIVE STOREFRONTS

Reported:

```text
48 storefront customers
distributed across 8 active storefronts
```

Установить:

```text
Storefront partners total:
Storefront workspaces total:
Active storefronts:
Inactive/trial/unconfigured storefronts:
Partners with customers:
Partners without customers:
```

Если Storefront partners реально 10, но active storefronts 8 — это может быть корректно.

Если создано только 8 Storefront partners — seed contract FAIL, выполнить минимальную remediation до 10.

Не заставлять все 10 иметь продажи/клиентов.

# 5. STOREFRONT SUBSCRIPTIONS

Reported:

```text
6 subscriptions
2 FREE_TRIAL
4 PREMIUM @199 AZN
```

Определить, почему subscriptions 6 при 10 Storefront partners.

Вернуть:

| Storefront partner state | Count |
|---|---:|
| PREMIUM | |
| FREE_TRIAL | |
| No subscription | |
| Other canonical state | |

Отсутствие subscription у части partners не является автоматически defect, если это valid business state.

Но seed должен содержать 10 Storefront partners.

Сохранять:

```text
reference plan = 199 AZN
list/effective subscription price ≠ automatically collected revenue
```

# 6. CHECK B — SERVICE TYPES / PUBLICATIONS

Seed contract:

```text
10–50 publications per supported service type
```

Reported:

```text
Products = 140
110 published + 30 new listings
```

Это не доказывает per-type coverage.

Сначала определить actual supported service types/categories из schema/domain.

Вернуть:

| Service type | Total publications | Published | Other states | Contract 10–50 |
|---|---:|---:|---:|---:|
| actual type | | | | PASS/FAIL |

Если type существует технически, но не является реально seedable/publication-capable service type — объяснить exclusion.

Если supported type имеет <10 или >50 demo publications — минимально исправить seed.

# 7. CHECK C — 2026 MONTHLY COVERAGE

Проверить DB facts:

| Month | Publications | Bookings | Orders | Payments | GMV AZN | Refunds |
|---|---:|---:|---:|---:|---:|---:|
| Jan | | | | | | |
| Feb | | | | | | |
| Mar | | | | | | |
| Apr | | | | | | |
| May | | | | | | |
| Jun | | | | | | |
| Jul | | | | | | |
| Aug | | | | | | |
| Sep | | | | | | |
| Oct | | | | | | |
| Nov | | | | | | |
| Dec | | | | | | |

Все 12 месяцев должны иметь meaningful transactional activity.

Подтвердить или опровергнуть reported Jul–Sep peak.

# 8. DATE BOUNDARY

Проверить:

```text
Earliest demo relevant record:
Latest demo relevant record:
Transactions before 2026-01-01:
Transactions after 2026-12-31:
```

Важно: time-relative detector records могут требовать особой квалификации.

Не считать legitimate technical/support record нарушением периода без объяснения.

# 9. CHECK D — FINANCIAL / PAYMENT DISTRIBUTION

Вернуть actual:

```text
Fully paid:
Partially paid:
Unpaid/waiting:
Failed:
Refunded:
Partially refunded:
Pending refunds:

Order amount total:
Collected/payment volume:
Outstanding:
Refunded:
Marketplace commissions:
```

Все PLATFORM aggregate monetary evidence → AZN.

Проверить partial-payment invariant согласно actual model.

# 10. MARKETPLACE VS STOREFRONT ECONOMICS

Вернуть отдельно:

```text
Marketplace GMV:
Storefront Commerce GMV:
TravelHub Marketplace commission/revenue:
Storefront subscription list/effective value:
Storefront collected subscription revenue: PROVABLE / NOT PROVABLE
```

Не смешивать:

```text
Marketplace GMV
Storefront Commerce GMV
Marketplace Commission
Storefront SaaS Revenue
```

Не возвращать `$`.

# 11. DATA INTEGRITY

Проверить минимум:

```text
duplicate demo entities
orphan bookings
orphan orders
orphan payments
orphan refunds
invalid dates
invalid payment relationships
invalid refund relationships
Marketplace/Storefront contamination
```

Вернуть counts.

Любой non-zero result объяснить.

# 12. CHECK E — WHY 5/6 DETECTORS?

Reported:

```text
Decision Queue: 5/6 detectors
```

Установить точно, какой detector не trigger.

Проверить все:

1. `PendingBookingsDetector`
2. `FailedPaymentsDetector`
3. `RecentCancellationsDetector`
4. `PendingRefundsDetector`
5. `UpcomingBookingsDetector`
6. `ServicesWithoutSalesDetector`

Вернуть:

| Detector | Executed | Condition | Trigger rows | Signal status | WHY status | Reason |
|---|---:|---:|---:|---|---|---|

# 13. TIME-RELATIVE DETECTORS

Особенно проверить detectors, зависящие от runtime `now()`.

Dataset period:

```text
2026-01-01 → 2026-12-31
```

Current runtime date может влиять на:

```text
recent cancellations
upcoming bookings
pending SLA windows
```

Не изменять historical dataset бессмысленными future dates только ради 6/6.

Если 5/6 — корректный результат из-за temporal semantics, это PASS при доказанном explanation.

Если detector не trigger из-за seed omission, хотя contract требовал representative trigger data и это можно корректно сделать — минимально исправить.

# 14. STAGE D POST-SEED VALIDATION

На фактических signals проверить:

```text
DecisionSignal
→ structured evidence
→ WHY attribution
→ API
→ Decision Queue
```

Для каждого triggered detector вернуть representative trace:

```text
Signal code:
Status:
Affected entities:
Evidence:
WHY status:
Primary driver:
Contributing factors:
Rule ID:
Rule version:
Claim justification:
```

# 15. WHY CLAIM SAFETY

Проверить, что rich dataset не усилил claims сверх evidence.

Особенно:

## Failed Payments

Если paymentMethod grouping есть:

```text
dominant payment method
```

может быть `OBSERVED_DRIVER`.

Но:

```text
CARD caused failures
bank caused failures
provider is broken
```

запрещено без causal evidence.

## Services Without Sales

Availability/publication age могут быть factual observed factors.

Но:

```text
low demand
bad price
bad marketing
```

запрещено без evidence.

## Recent Cancellations

Stage D reported:

```text
INSUFFICIENT_EVIDENCE
```

из-за отсутствия structured reason.

Seed не должен превращать free-text/random data в fake proven cause.

## Pending Refunds / Upcoming Bookings

Проверить, что остаются honest `INSUFFICIENT_EVIDENCE`, если causal data всё ещё отсутствует.

# 16. WHY COVERAGE MATRIX

Вернуть:

| Detector | Signal exists | WHY type | Primary driver | Evidence sufficient? | Correct |
|---|---:|---|---|---:|---:|

Если signal не существует из-за condition=false, отдельно проверить rule через integration/unit evidence, но не создавать fake runtime signal без необходимости.

# 17. WHAT / WHY SEPARATION

Для representative queue cards доказать:

```text
WHAT ≠ WHY
```

Плохой outcome:

```text
WHAT: 20 pending refunds
WHY: 20 refunds are pending
```

Если дополнительного explanation нет:

```text
INSUFFICIENT_EVIDENCE
```

# 18. NO IMPACT / ACTION LEAK

Post-seed Stage D validation не должен показывать новые:

```text
HIGH/MEDIUM/LOW
critical impact
potential = n × X AZN
recommended business action
```

Stage E/F ещё не реализуются.

Stage C lifecycle actions допустимы.

# 19. HISTORY / REOBSERVATION

На богатой БД проверить:

```text
OPEN
ACKNOWLEDGED
RESOLVED
DISMISSED
```

где available.

Убедиться, что derived WHY использует signal evidence/snapshot semantics и historical signal не получает новую fabricated cause из mutable DB state.

Если current implementation действительно вычисляет WHY только из stored signal evidence — доказать call/data path.

# 20. PERFORMANCE POST-SEED

Stage C baseline был примерно:

```text
Dashboard ~430ms
6 detectors
~12 DB queries/page
```

Stage D сообщил:

```text
WHY overhead <1ms
```

На новой БД измерить actual:

| Measurement | Result |
|---|---:|
| Dashboard endpoint | |
| DecisionSignal endpoint | |
| Detector runs/page | |
| DB queries/page | measured / NOT MEASURED |
| WHY computation | |
| Queue item count | |

Классифицировать:

```text
ACCEPTABLE
ACCEPTABLE WITH WATCHPOINT
REMEDIATION REQUIRED
```

Не overengineer scheduler/background execution в этом gate.

# 21. UI / BROWSER VALIDATION

В реальном PLATFORM Command Center проверить:

1. Queue renders.
2. Multiple real demo signals visible.
3. WHAT readable.
4. Evidence chips/data correct.
5. WHY block readable.
6. Claim-strength wording correct.
7. `INSUFFICIENT_EVIDENCE` rendered honestly.
8. Active/History work.
9. lifecycle actions work.
10. AZN/₼ preserved.
11. unexpected `$` absent.
12. raw i18n keys absent.

Проверить RU/AZ/EN хотя бы representative WHY strings.

# 22. DATASET UI SANITY

Проверить минимум:

```text
Command Center
Analytics
Booking/Orders
Decision Queue
Storefront workspace, if implemented
```

Никаких:

```text
NaN
undefined
broken relation
obvious empty page caused by seed defect
```

# 23. SEED IDEMPOTENCY

Запустить seed повторно безопасным способом согласно implementation.

Проверить:

```text
run #1 totals
run #2 totals
duplicates
```

Повторный запуск не должен удваивать demo data.

Если reset-demo strategy используется — доказать, что non-demo data не уничтожается.

# 24. REQUIRED DELIVERABLE A — DATASET ACCEPTANCE

Вернуть:

| Requirement | Expected | Actual | Result |
|---|---|---|---|
| Marketplace partners | 20–30 | | |
| Marketplace customers | 120–150 | | |
| Storefront partners | 10 | | |
| Storefront customers | <=70 | | |
| Publications per service type | 10–50 | | |
| Jan–Dec coverage | 12 months | | |
| Partial payments | present | | |
| Failed payments | present | | |
| Refunds | present | | |
| Detector trigger data | representative | | |
| AZN authority | yes | | |
| Idempotency | yes | | |

# 25. REQUIRED DELIVERABLE B — DETECTOR / WHY TRACE

Вернуть all-six matrix + representative detailed traces.

Однозначно объяснить:

```text
WHY Decision Queue = 5/6
```

и классифицировать это как:

```text
EXPECTED
SEED GAP
APPLICATION DEFECT
```

# 26. REQUIRED DELIVERABLE C — FINANCIAL SANITY

Вернуть:

```text
Marketplace GMV:
Payment Volume:
Outstanding:
Refunds:
Marketplace Commission:
Storefront Commerce GMV:
Storefront subscription economics:
```

с корректной semantic separation.

# 27. REQUIRED DELIVERABLE D — PERFORMANCE

Вернуть actual post-seed measurements и сравнить с pre-seed accepted baseline.

# 28. REQUIRED DELIVERABLE E — TESTS / RUNTIME

Вернуть actual counts/results:

```text
Seed validation:
Integrity checks:
DecisionSignal:
WHY Attribution:
Dashboard:
Backend full:
Frontend:
TSC/build:
Browser:
RBAC smoke:
AZN smoke:
i18n smoke:
```

Не придумывать counts.

# 29. REQUIRED DELIVERABLE F — FILES CHANGED

Если remediation не нужна:

```text
Product/seed code changed: NO
```

Если нужна:

```text
Total changed files:
Seed:
Backend:
Frontend:
Tests:
Docs:
```

Только minimal scope.

# 30. REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_SEED_STAGE_D_VALIDATION_DATASET_ACCEPTANCE_GATE_REPORT.md
```

Полностью на русском языке.

# 31. ROADMAP

Если gate PASS:

```text
2026 Demo Dataset
→ ACCEPTED

Stage D
→ VERDICT A remains valid
→ POST-SEED VALIDATED

Stage E
→ READY
```

Не создавать новый top-level implementation stage.

Добавить evidence reference в roadmap только если это соответствует текущему canonical roadmap pattern.

# 32. GIT EVIDENCE

Вернуть:

```text
Starting HEAD:
Final HEAD:
Product code changed: YES/NO
Seed code changed: YES/NO
Commit(s):
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

# 33. ACCEPTANCE CRITERIA

Gate PASS только если:

1. Marketplace partner/customer scope доказан.
2. Storefront имеет 10 partners либо gap исправлен.
3. Storefront customers <=70.
4. 10–50 publications per supported service type доказано.
5. Все 12 месяцев 2026 покрыты.
6. Financial/payment/refund data consistent.
7. Marketplace/Storefront economics не смешаны.
8. Data integrity acceptable.
9. Причина 5/6 detectors доказана.
10. Нет detector wiring/application loss.
11. Real signals проходят DATA→DETECTOR→SIGNAL→EVIDENCE→WHAT→WHY.
12. WHY claims не сильнее evidence.
13. `INSUFFICIENT_EVIDENCE` используется честно.
14. Нет fake IMPACT.
15. Нет business ACTION leakage.
16. History/reobservation semantics безопасны.
17. Performance acceptable.
18. UI/runtime работает на rich dataset.
19. AZN authority preserved.
20. Seed idempotent.
21. Финальный отчёт на русском языке.

# 34. VERDICT

Вернуть ровно один.

## VERDICT A — POST-SEED STAGE D VALIDATED / DATASET ACCEPTED / STAGE E READY

Если dataset соответствует contract (или минимальные gaps исправлены), Stage D корректно работает на rich data и acceptance criteria выполнены.

Stage E автоматически НЕ запускать.

## VERDICT B — REMEDIATION REQUIRED

Если найдены исправимые seed или Stage D defects.

Указать отдельно:

```text
Seed remediation:
Stage D remediation:
```

Не смешивать scopes.

## VERDICT C — BLOCKED

Только если validation невозможно выполнить из-за отсутствующей prerequisite capability/environment.

# 35. STOP

После gate **STOP**.

Не реализовывать Stage E/F/G/H/I/J или unrelated architecture.

Вернуть полный отчёт на русском языке и ждать review.
