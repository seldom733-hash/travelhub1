# UI-C1.2F.1A — REMEDIATION R1 — REPORT

## A. Executive Summary

Ремедиация закрывает 3 нахождения: P0-1 (HTTP validation), P0-2 (clean working tree), H1 (deterministic reconciliation). Добавлен shared `validateDateParam()` helper, применяющийся к both list и KPI endpoints. Добавлен zero-fill для 12/12 canonical Request statuses. Доказана deterministic list/KPI parity на реальных числах.

## B. Baseline

```text
Branch: master
Architecture baseline: 9697878658c80e19c899ab736e6d916350003863
Original implementation: a64a072add56523a0b119dbad562ee9e6ce20d71
```

## C. Root Cause

Invalid date strings were not guaranteed to produce HTTP 422/400 because:
- Requests controller used raw `@Query()` without DTO validation
- Service passed raw strings to `new Date()` without validation
- Prisma received Invalid Date objects, producing undefined behavior

Additionally, the KPI endpoint only outputted statuses with non-zero counts, missing zero-count statuses.

## D. Validation Implementation

Added shared `validateDateParam()` helper in `request.service.ts`:

```typescript
function validateDateParam(value: string | undefined, paramName: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${paramName} must be a valid date`);
  }
  return d;
}
```

Applied to both `listRequests()` and `getRequestKpi()` — same validation path, same error response.

## E. HTTP Validation Matrix

| Request | Expected | Actual |
|---|---:|---:|
| valid dateFrom=2026-09-01 | 200 | 200 |
| valid dateTo=2026-10-01 | 200 | 200 |
| valid range | 200 | 200 |
| invalid dateFrom=garbage | 400 | 400 |
| invalid dateTo=garbage | 400 | 400 |
| invalid dateFrom + valid dateTo | 400 | 400 |
| invalid both | 400 | 400 |

LIST/KPI VALIDATION PARITY: Both return same HTTP status for same input ✅

## F. Boundary Proof

```text
createdAt >= dateFrom (gte) → record at lower boundary INCLUDED
createdAt <  dateTo   (lt)  → record at upper boundary EXCLUDED
Boundary: [from, to) — half-open range
```

Identical to existing Requests list semantics.

## G. Deterministic List/KPI Reconciliation

| Scope | List total | KPI total | KPI status sum | Match |
|---|---:|---:|---:|---|
| all-time | 646 | 646 | 646 | PASS |
| dateFrom=2026-09-01 dateTo=2026-10-01 | 82 | 82 | 82 | PASS |
| dateFrom=2026-01-01 dateTo=2026-06-01 | 191 | 191 | 191 | PASS |

## H. Table-Only Status Independence

```text
Period: 2026-09-01 to 2026-10-01
period total (all statuses) = 82
CHECKING table total        = 1
KPI status sum              = 82

TABLE-ONLY INDEPENDENCE = PASS
(KPI sum represents ALL statuses, not narrowed by CHECKING filter)
```

## I. 12/12 Status Coverage

```text
new: 26
checking: 22
supplier_timeout: 38
price_changed: 29
customer_accepted: 0
confirmed: 1
converted: 391
rejected: 62
unavailable: 49
expired: 0
customer_payment_timeout: 28
cancelled_by_customer: 0

Coverage: 12/12 ✅
```

## J. Response Compatibility

Response shape unchanged — same JSON keys, same structure. Date support is additive.

## K. Security

- `@RequirePermissions("order.read")` preserved
- Server-side authority maintained
- Date filters cannot widen visibility
- No PII/PCI expansion

## L. Tests

```
request-kpi-date-scope.spec.ts — 10/10 PASS
Backend TSC — PASS
Backend build — PASS
```

## M. Files Changed

```
backend/src/modules/order/request.service.ts | 26 +++- — validation + zero-fill
```

## N. Git Hard Closure

```bash
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
4f71acc60631e0a90825185a01d4574853412d83

$ git rev-parse origin/master
4f71acc60631e0a90825185a01d4574853412d83

HEAD == origin/master: YES

$ git merge-base --is-ancestor a64a072add56523a0b119dbad562ee9e6ce20d71 HEAD
ANCESTOR: YES (exit 0)
```

## O. Final Verdict

```
VERDICT A — UI-C1.2F.1A
REQUESTS KPI DATE SCOPE — ACCEPTED AFTER REMEDIATION R1

ARCHITECTURE BASELINE SHA:
9697878658c80e19c899ab736e6d916350003863

ORIGINAL IMPLEMENTATION SHA:
a64a072add56523a0b119dbad562ee9e6ce20d71

FINAL SHA:
4f71acc60631e0a90825185a01d4574853412d83

REQUESTS KPI dateFrom/dateTo       — PASS
HTTP invalid dateFrom → 400        — PASS
HTTP invalid dateTo → 400          — PASS
LIST/KPI VALIDATION PARITY         — PASS
CANONICAL DATE FIELD createdAt     — PASS
[from,to) BOUNDARIES               — PASS
DETERMINISTIC LIST/KPI PARITY      — PASS
TABLE-ONLY STATUS INDEPENDENCE     — PASS
12/12 STATUS COVERAGE              — PASS
RESPONSE COMPATIBILITY             — PASS
SERVER AUTHORITY                   — PASS
SECURITY / TENANT SCOPE            — PASS
REGRESSION                         — PASS
WORKING TREE CLEAN                 — PASS
HEAD == origin/master              — PASS
IMPLEMENTATION SHA ANCESTRY        — PASS
GIT HARD CLOSURE                   — PASS

UI-C1.2F.1A — ACCEPTED

UI-C1.2F.1B — NOT STARTED
UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F.1B — Shared Operations Center Header Period
```
