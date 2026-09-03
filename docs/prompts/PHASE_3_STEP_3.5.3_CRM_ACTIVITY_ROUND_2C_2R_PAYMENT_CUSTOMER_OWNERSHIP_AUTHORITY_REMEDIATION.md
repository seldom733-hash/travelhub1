# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## ROUND 2C.2R --- PAYMENT CUSTOMER OWNERSHIP AUTHORITY REMEDIATION

### CUSTOMER PAYMENTS + CRM ACTIVITY / CANONICAL OWNERSHIP + HISTORICAL/LIVE PROJECTION + RUNTIME CLOSURE

**Все ответы, отчёт и roadmap updates --- строго на русском.**

------------------------------------------------------------------------

# 1. СТАТУС

Round 2C.2 был объявлен CLOSED на `a8627f0`, но post-closure
clean-runtime validation воспроизвёл structural backend inconsistency:

``` text
Customer 360 → Payments
≠
Customer 360 → Activity → Payment
```

Поэтому:

``` text
Round 2C.2 — REOPENED
Round 2D — BLOCKED
```

Этот prompt --- targeted remediation.

------------------------------------------------------------------------

# 2. ДОКАЗАННЫЙ ROOT CAUSE

Observed Customer:

``` text
CRM-00000089
0c534877-7dee-4d33-1078-68e39c8fe785
Tatiana Pedersen
```

Payments tab использует:

``` text
Customer → Orders (take:20) → Payments by orderId
```

Activity использует:

``` text
CrmActivity.customerId = routeCustomerId
```

При этом historical Payment projection учитывает direct
`Payment.customerId`, но не все связи:

``` text
Payment.orderId → Order.customerId
```

Observed:

``` text
PAY-00000557 — Payments ✓ / Activity ✗ / customer via Order
PAY-00000616 — Payments ✓ / Activity ✗ / customer via Order
PAY-00000856 — Payments ✗ / Activity ✗ / customer via Order outside first 20
PAY-00007001 — Payments ✗ / Activity ✓ / direct customerId + Order outside first 20
```

Это не cache/state defect.

------------------------------------------------------------------------

# 3. ЦЕЛЬ

Ввести единую canonical Payment → Customer ownership authority и
применить её в:

``` text
Customer 360 Payments
historical PAYMENT → CrmActivity projection
live PAYMENT → CrmActivity projection
tests/audits
```

Минимальная proven rule:

``` text
Payment.customerId == Customer.id

OR

Payment.orderId → Order.customerId == Customer.id
```

Перед реализацией проверить actual schema/business contract и
precedence.

------------------------------------------------------------------------

# 4. CONFLICT / PRECEDENCE AUDIT

Найти Payments, где:

``` text
Payment.customerId IS NOT NULL
Payment.orderId IS NOT NULL
Payment.customerId != Order.customerId
```

Зафиксировать:

``` text
dual-link payments:
conflicting ownership payments:
canonical precedence:
evidence:
```

Нельзя молча приписывать Payment двум Customers.

Если precedence невозможно доказать существующей архитектурой --- P1 /
VERDICT B.

------------------------------------------------------------------------

# 5. REPOSITORY-FIRST

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -100
git diff
git diff --check
```

Зафиксировать Starting HEAD и reachable `a8627f0`.

Не reset/revert legitimate work.

------------------------------------------------------------------------

# 6. CUSTOMER 360 PAYMENTS --- FIX

Исправить фактический backend path (`CrmService.getCustomerDetail()` или
current equivalent).

Payments completeness не должна зависеть от:

``` text
Orders take:20
```

Запрещено исправлять:

``` text
take:20 → 100/1000
```

или загружать все Orders в память.

Customer Payments должны учитывать canonical union:

``` text
direct Payment.customerId
+
Payment.orderId → Order.customerId
```

с dedupe по `Payment.id`.

Если UI/API имеет собственный Payment limit/pagination --- применять его
**после** формирования canonical Payment set, с deterministic sorting.

------------------------------------------------------------------------

# 7. QUERY / PERFORMANCE

Учитывать ADR-0001 и отсутствие некоторых Prisma cross-schema relations.

Допустимый strategy:

``` text
direct payments query
+
customer order IDs query/batches
+
payments by orderId query/batches
+
merge/dedupe
```

Не создавать N+1.

Не использовать invalid `include.order`/несуществующие relations.

Report actual query strategy.

------------------------------------------------------------------------

# 8. HISTORICAL CRM ACTIVITY FIX

Payment source adapter/backfill должен вычислять Customer через ту же
canonical authority.

Для observed records определить expected event semantics.

Если CAPTURED действительно проецируется как `PAYMENT_CAPTURED`, то
после reconciliation ожидается корректная Activity для:

``` text
PAY-00000557
PAY-00000616
PAY-00000856
PAY-00007001
```

Не создавать события только ради равенства counts.

------------------------------------------------------------------------

# 9. LIVE PROJECTION FIX

Новые Payment lifecycle events должны корректно проектироваться и когда:

``` text
Payment.customerId = null
Payment.orderId → Order.customerId = Customer
```

Новый event должен появиться в `CrmActivity` автоматически, без full
rebuild.

Обязательный proof:

``` text
new Payment
customerId=null
orderId → Customer A
→ canonical Payment event
→ CrmActivity.customerId = Customer A
→ sourceId = exact Payment.id
```

------------------------------------------------------------------------

# 10. HISTORICAL RECONCILIATION

После fix привести historical Activity к canonical state через existing
controlled reconciliation/backfill.

Не reset/reseed DB.

Если используется `rebuildAll()`:

``` text
concurrency protection preserved
errors = 0
scanned/projected/duration reported
```

------------------------------------------------------------------------

# 11. DEDUPE / SUBJECT INTEGRITY

Acceptance:

``` text
duplicate Customer Payment rows = 0
duplicate PAYMENT activity events = 0
wrong-customer PAYMENT events = 0
orphan PAYMENT events = 0
sourceId/code mismatches = 0
```

Для каждой Activity:

``` text
CrmActivity.sourceId == exact Payment.id
CrmActivity.customerId == canonical Customer
visible PAY-code == same Payment
```

------------------------------------------------------------------------

# 12. TIMESTAMP / EVENT SEMANTICS

Документировать actual contract:

  Payment status   Expected Activity event   Canonical timestamp
  ---------------- ------------------------- ---------------------
                                             

Для `PAYMENT_CAPTURED` проверить canonical timestamp (`paidAt`, если это
current contract).

Не менять timestamp ради визуального порядка.

------------------------------------------------------------------------

# 13. OBSERVED CUSTOMER --- REQUIRED PROOF

Повторно проверить:

``` text
CRM-00000089
0c534877-7dee-4d33-1078-68e39c8fe785
```

Заполнить:

  --------------------------------------------------------------------------------------------------
  Payment        Direct       Order→Customer   Canonical     Payments   Expected     Actual Result
                 customerId                    Customer        API/UI   Activity   Activity 
  -------------- ------------ ---------------- ----------- ---------- ---------- ---------- --------
  PAY-00000557                                                                              

  PAY-00000616                                                                              

  PAY-00000856                                                                              

  PAY-00007001                                                                              
  --------------------------------------------------------------------------------------------------

Если dataset legitimately изменён --- объяснить и провести equivalent
deterministic proof.

------------------------------------------------------------------------

# 14. GLOBAL PAYMENT AUDIT

Проверить весь current dataset:

``` text
total payments:
direct-customer:
order-derived:
dual-link:
conflicting ownership:
unresolvable customer:
expected PAYMENT activities:
actual matching:
missing:
wrong customer:
orphan:
duplicate:
sourceId/code mismatch:
```

Для expected customer-owned Payment events:

``` text
missing = 0
wrong customer = 0
orphan = 0
duplicate = 0
sourceId/code mismatch = 0
```

Unresolvable Payments учитывать отдельно.

------------------------------------------------------------------------

# 15. CROSS-CUSTOMER ISOLATION

Повторить A → B → A.

Acceptance:

``` text
A events in B = 0
B events in A = 0
stale items = 0
wrong subject requests = 0
```

------------------------------------------------------------------------

# 16. API + BROWSER PROOF

Для CRM-00000089:

``` text
Customer Payments API
Activity API ?sourceType=PAYMENT
Customer 360 → Payments
Customer 360 → Activity → Payment
```

Доказать canonical semantics на реальных данных.

После production fix выполнить fresh runtime/hard reload.

Tests без runtime/browser proof недостаточны.

------------------------------------------------------------------------

# 17. REQUIRED REGRESSION TESTS

Минимум:

1.  direct `Payment.customerId`.
2.  `customerId=null` + Order→Customer.
3.  dual-link same Customer → dedupe.
4.  conflicting direct/order Customer → canonical precedence.
5.  Payment outside first 20 Orders всё равно корректно доступен.
6.  direct Payment не теряется из-за Order pagination.
7.  deterministic sorting.
8.  historical adapter derives Customer via Order.
9.  live projector derives Customer via Order.
10. exact sourceId/code.
11. wrong-customer prevention.
12. no duplicate Activity.
13. no invalid Prisma relation.
14. no obvious N+1.

E2E fixture должен включать Customer с \>20 Orders и Payment на Order за
пределами первых 20.

------------------------------------------------------------------------

# 18. OTHER REGRESSIONS

Не регрессировать:

``` text
ORDER Activity
BOOKING Activity
REFUND Activity
Operational Notes + live projection
History remains removed
Backfill concurrency lock
RU/AZ/EN localization
mixed locale = 0
raw enums = 0
raw i18n keys = 0
```

------------------------------------------------------------------------

# 19. BUILD / TEST GATES

Запустить actual repository commands:

``` text
Backend TSC
Backend build
CRM tests
CRM Activity unit
CRM Activity E2E
Payment ownership tests
commercial consistency regression
Frontend TSC
Frontend build
Frontend tests
Operational Notes tests
```

Historical baselines:

``` text
Frontend: 243/243
Operational Notes: 99/99
```

Report actual final counts.

------------------------------------------------------------------------

# 20. NO SCHEMA CHANGE BY DEFAULT

Ожидается authority/query/projection fix.

Если для решения неожиданно требуется schema/migration change ---
сначала обосновать необходимость. Не делать structural migration
автоматически.

------------------------------------------------------------------------

# 21. ROADMAP CORRECTION

Additive history:

``` text
Round 2C.2 — Commercial Cross-View Consistency
    ⚠ REOPENED after post-closure runtime defect

Round 2C.2R — Payment Customer Ownership Authority Remediation
    ✅ CLOSED (<SHA>)   // только после VERDICT A

Round 2C.2 — Commercial Cross-View Consistency
    ✅ RE-CLOSED (<SHA>)

Round 2D — Partner 360 Activity UI
    ⏭ NEXT
```

Не удалять историю предыдущего `a8627f0`.

------------------------------------------------------------------------

# 22. REPORT

Создать:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2C_2R_PAYMENT_CUSTOMER_OWNERSHIP_AUTHORITY_REMEDIATION_REPORT.md
```

Строго на русском.

------------------------------------------------------------------------

# 23. GIT DISCIPLINE

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only.

Запрещено:

``` bash
git add .
git add -A
```

После commit/push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

No force push.

------------------------------------------------------------------------

# 24. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  Round 2C.2 formally reopened.
2.  Canonical Payment ownership rule defined.
3.  Direct ownership supported.
4.  Order-derived ownership supported.
5.  Dual-link/conflict audit complete.
6.  Precedence proven or conflicts absent.
7.  Payments no longer depend on first 20 Orders.
8.  No arbitrary take increase workaround.
9.  Direct + order-derived Payments included.
10. Merge deduplicated and deterministically sorted.
11. PAY-00000557 reconciled.
12. PAY-00000616 reconciled.
13. PAY-00000856 reconciled.
14. PAY-00007001 reconciled.
15. Historical projection uses canonical ownership.
16. Live projection uses canonical ownership.
17. New order-derived Payment event appears without rebuild.
18. Exact sourceId/code preserved.
19. Missing expected PAYMENT events = 0.
20. Wrong-customer = 0.
21. Orphans = 0.
22. Duplicates = 0.
23. SourceId/code mismatch = 0.
24. Global dataset audit complete.
25. A→B→A isolation PASS.
26. First-20 regression test exists.
27. No invalid Prisma relation.
28. No obvious N+1.
29. Historical reconciliation errors = 0.
30. ORDER/BOOKING/REFUND regression PASS.
31. Operational Notes regression PASS.
32. RU/EN/AZ PASS.
33. History remains removed.
34. Backfill lock preserved.
35. Backend TSC/build PASS.
36. CRM/Activity/Payment ownership/E2E tests PASS.
37. Frontend TSC/build/tests PASS.
38. Browser proof CRM-00000089 PASS.
39. No unresolved P0/P1.
40. Report + additive roadmap sync complete.
41. Commit pushed.
42. HEAD == origin/master.
43. Round 2D not implemented.

------------------------------------------------------------------------

# 25. FINAL RESPONSE FORMAT

``` text
VERDICT:

РЕПОЗИТОРИЙ
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

ROUND 2C.2
Previous closure:
Runtime finding:
Reopened:
Re-closed:

ROOT CAUSE
Old Payments authority:
Old Activity authority:
First-20 defect:
Order-derived Activity defect:
Files/methods:

CANONICAL PAYMENT OWNERSHIP
Direct:
Order-derived:
Dual-link:
Conflict precedence:
Unresolvable:

OBSERVED CUSTOMER
Code:
ID:

PAYMENT MATRIX
...

GLOBAL PAYMENT AUDIT
Total:
Direct:
Order-derived:
Dual-link:
Conflicts:
Unresolvable:
Expected:
Actual:
Missing:
Wrong customer:
Orphans:
Duplicates:
Code mismatch:

CUSTOMER PAYMENTS FIX
Old query:
New query:
Limit/pagination:
Ordering:
Deduplication:

ACTIVITY FIX
Historical:
Live:
SourceId:
CustomerId:
Timestamp/event semantics:

LIVE PROJECTION PROOF
Payment:
customerId:
Order:
Order customer:
Activity:
Manual rebuild required:

A→B→A ISOLATION
...

API PROOF
...

BROWSER PROOF
...

REGRESSION
ORDER:
BOOKING:
REFUND:
Operational Notes:
History:
Backfill lock:
RU/AZ/EN:

TESTS / BUILDS
...

FILES CHANGED
...

Schema changed:
Migration changed:

ROADMAP
Round 2C.2:
Round 2C.2R:
Round 2D:

REPORT:
COMMIT:

ОСТАВШИЕСЯ FINDINGS
P0:
P1:
P2:

NEXT:
```

------------------------------------------------------------------------

# 26. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2C.2R — PAYMENT CUSTOMER OWNERSHIP AUTHORITY REMEDIATION /
CUSTOMER PAYMENTS + HISTORICAL/LIVE PAYMENT ACTIVITY /
CANONICAL OWNERSHIP + RUNTIME CONSISTENCY /
FULLY CLOSED
```

И:

``` text
Round 2C.2 — RE-CLOSED
Round 2D — NEXT
```

Если runtime mismatch остаётся, historical/live projection неполна,
first-N dependency сохраняется или ownership conflict unresolved:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
ROUND 2C.2R /
PAYMENT CUSTOMER OWNERSHIP REMEDIATION INCOMPLETE
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 27. STOP

После fix + historical/live reconciliation + global audit + tests +
API/browser proof + report + roadmap + commit/push:

**STOP.**

Не начинать Round 2D без отдельного задания.
