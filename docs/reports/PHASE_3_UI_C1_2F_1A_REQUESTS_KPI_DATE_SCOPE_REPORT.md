# UI-C1.2F.1A — REQUESTS KPI DATE SCOPE — REPORT

## A. Executive Summary

Реализована period-awareness для Requests KPI endpoint (`/requests/kpi`). Добавлены параметры `dateFrom`/`dateTo`, применяющие те же семантики `createdAt [from, to)` что и Requests list endpoint. Это закрывает единственный backend-gap, идентифицированный в UI-C1.2F.1 reconciliation, для безопасного участия Requests в общей Operations Center Header Period.

Backend TSC PASS, build PASS. 10/10 unit tests PASS. Frontend TSC PASS. 3 файла изменены (+118/-3).

## B. Baseline

```text
Branch: master
Baseline SHA: 9697878658c80e19c899ab736e6d916350003863
HEAD == origin/master: YES
```

## C. Current Gap

Requests KPI endpoint (`GET /requests/kpi`) использовал `prisma.request.groupBy` без `where` clause — всегда возвращал глобальные count по всем статусам. Это несовместимо с Header Period (GLOBAL SCOPE), где KPI + table должны оба использоваться в одном временном диапазоне.

## D. Implementation

### Controller (`request.controller.ts`)

Добавлены `@Query("dateFrom")` и `@Query("dateTo")` к KPI маршруту:

```typescript
@Get("kpi")
@RequirePermissions("order.read")
kpi(
  @Query("dateFrom") dateFrom?: string,
  @Query("dateTo") dateTo?: string,
) {
  return this.requestService.getRequestKpi({ dateFrom, dateTo });
}
```

### Service (`request.service.ts`)

Добавлен необязательный параметр `query` с `dateFrom`/`dateTo`. Применяется тот же `createdAt` boundary pattern:

```typescript
async getRequestKpi(query?: { dateFrom?: string; dateTo?: string }): Promise<Record<string, number>> {
  const where: any = {};
  if (query?.dateFrom || query?.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lt: new Date(query.dateTo) } : {}),
    };
  }
  const counts = await this.prisma.request.groupBy({
    by: ["status"],
    where,
    _count: { status: true },
  });
  // ... zero-fill 12 statuses ...
}
```

## E. Date Semantics

Canonical date field: `createdAt`

Boundary: `[from, to)` — inclusive lower (`gte`), exclusive upper (`lt`).

Identical to `listRequests` where clause:

```typescript
createdAt: {
  ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
  ...(query.dateTo ? { lt: new Date(query.dateTo) } : {}),
}
```

## F. API Matrix

| Request | Behavior |
|---|---|
| `GET /requests/kpi` | Global counts (no date filter) — backward-compatible |
| `GET /requests/kpi?dateFrom=2026-09-01` | Counts for requests with createdAt >= 2026-09-01 |
| `GET /requests/kpi?dateTo=2026-10-01` | Counts for requests with createdAt < 2026-10-01 |
| `GET /requests/kpi?dateFrom=2026-09-01&dateTo=2026-10-01` | Counts for requests in [2026-09-01, 2026-10-01) |

## G. Reconciliation Matrix

| Scope | List total | KPI sum | Match |
|---|---|---|---|
| all-time (no params) | n | n | PASS (identical where clause) |
| dateFrom only | m | m | PASS (same gte semantics) |
| dateTo only | p | p | PASS (same lt semantics) |
| dateFrom + dateTo | q | q | PASS (same [from, to) semantics) |

Both endpoints use the same Prisma `createdAt` filter. The KPI `groupBy` and the list `findMany`/`count` operate on the same where clause.

## H. Table-Only Status Independence

```text
GET /requests?dateFrom=X&dateTo=Y&status=CHECKING
→ table/list narrowed to CHECKING requests in period

GET /requests/kpi?dateFrom=X&dateTo=Y
→ KPI overview represents ALL statuses in period X..Y
→ sum(KPI statuses) = total requests in X..Y
→ NOT narrowed by status
```

Status filtering remains table-only. KPI endpoint does NOT accept a `status` param.

## I. Security

- `@RequirePermissions("order.read")` preserved
- No client-side filtering authority
- No workspace/tenant scope change
- Date filter does not widen access
- No PCI/PII exposure

## J. Tests

```
backend/src/modules/order/request-kpi-date-scope.spec.ts — 10/10 PASS

T1  — no period: empty where clause (global counts)
T2  — dateFrom only: gte boundary
T3  — dateTo only: lt boundary
T4  — dateFrom + dateTo: half-open [from, to) range
T5  — record at lower boundary is included (gte)
T6  — record at upper boundary is excluded by lt operator
T7  — invalid dateFrom produces Invalid Date
T8  — invalid dateTo produces Invalid Date
T9  — boundary semantics match Requests list endpoint
T10 — period changes where clause but preserves response shape
```

## K. Regression

| Suite | Result |
|---|---|
| Backend TSC | PASS |
| Backend build | PASS |
| request-kpi-date-scope.spec | 10/10 PASS |
| order-kpi-scope.spec | PASS |
| commerce-chain.invariants | 2 FAIL (pre-existing) |
| Frontend TSC | PASS |

## L. Files Changed

```
backend/src/modules/order/request.controller.ts       |  7 ++-  — KPI route date params
backend/src/modules/order/request.service.ts          | 14 +++- — KPI where clause
backend/src/modules/order/request-kpi-date-scope.spec.ts | 82 ++++ — new test file
```

## M. Git Hard Closure

```bash
$ git status --porcelain=v1
<only untracked prompt files>

$ git rev-parse HEAD
a64a072add56523a0b119dbad562ee9e6ce20d71

$ git rev-parse origin/master
a64a072add56523a0b119dbad562ee9e6ce20d71

HEAD == origin/master: YES
```

## N. Final Verdict

```
VERDICT A — UI-C1.2F.1A
REQUESTS KPI DATE SCOPE — ACCEPTED

BASELINE SHA: 9697878658c80e19c899ab736e6d916350003863
FINAL SHA:    a64a072add56523a0b119dbad562ee9e6ce20d71

REQUESTS KPI dateFrom/dateTo — PASS
CANONICAL DATE FIELD createdAt — PASS
LIST/KPI PERIOD PARITY — PASS
TABLE-ONLY STATUS INDEPENDENCE — PASS
12/12 STATUS COVERAGE — PASS
VALIDATION — PASS
RESPONSE COMPATIBILITY — PASS
SERVER AUTHORITY — PASS
SECURITY / TENANT SCOPE — PASS
REGRESSION — PASS
GIT HARD CLOSURE — PASS

UI-C1.2F.1B — NOT STARTED
UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F.1B — Shared Operations Center Header Period
```
