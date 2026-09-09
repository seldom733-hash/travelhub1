# PHASE 3 — D8 Global Temporal Visibility: implementation qualification

## 1. Executive Summary

D8 establishes a single project-wide temporal visibility contract without schema, migration, RBAC, or lifecycle-authority changes. Registry date query parameters now fail closed with the canonical HTTP 400 `BadRequestException`; service and financial lifecycle semantics remain frozen.

## 2. Baseline / Final SHA

- Baseline: `203ea53294e4dfdfa8ce590cf52cd572a0b807a0`
- Final: recorded after the D8 commit.

## 3. Implemented Scope

- Added `shared/date-param.ts`, the sole registry query-param date parser.
- Hardened Requests, Orders, Bookings, Payments, CRM Activity, CRM customers, Catalog, and supported exports.
- Made the optional low-risk registry `fmtDate` extraction for Orders, Bookings, Requests, and Payments; RU/AZ/EN and null-display behavior are unchanged.
- Extended `docs/architecture/temporal-readiness.md` with vocabulary, authority, timezone, period, DST, cross-midnight, and boundary ownership documentation.

## 4. Validation Hardening

`dateFrom` and `dateTo` independently accept only real `YYYY-MM-DD` calendar dates and resolve to UTC midnight. Missing/empty parameters apply no bound. Malformed values are rejected before Prisma reads/where construction with `BadRequestException` / HTTP 400 and `<paramName> must be a valid date`, preserving ordinary exception-filter response shape and `X-Request-Id`. Payments registry query dates now use 400; submitted Finance payload validation remains its 422 domain-error contract.

## 5. Global Temporal Vocabulary

Canonical vocabulary is in `docs/architecture/temporal-readiness.md` §§16–17. It distinguishes entity, lifecycle, service occurrence, financial, event, processing, and presentation period time; identifies authority/type/storage/display/filter semantics; and documents intentional cross-domain differences.

## 6. Operations Period Contract

Operations date range is global to the active registry, URL-authoritative, server-resolved as UTC-midnight `[from,to)`, and shared by Requests KPI and table. Browser local timezone cannot move the business boundary.

## 7. Cross-domain and default registry semantics

- Requests, Orders, Bookings: `createdAt`; Booking upcoming: `serviceDate`.
- Payments: `createdAt` by default, explicit `paidAt` only.
- CRM Activity: `occurredAt`; CRM customers: related `Order.createdAt` activity.
- Catalog: `publishedAt`.

Catalog end-of-day and CRM Activity inclusive event-feed boundaries are documented intentional variances.

## 8. Analytics, timezone, DST, and cross-midnight

D8 covers Analytics temporal visibility (server period resolution, granularity, comparison parameter presence, default UTC), not KPI formulas. UTC storage, frozen Product IANA service timezone, browser/runtime display timezone, DST early-first/gap-after behavior, and cross-midnight end-date behavior are documented without changing `shared/service-time.ts`.

## 9. D9 / D11 / Finance boundaries

D9 retains export field-set standardisation including Orders `serviceDate`. D11 retains KPI definitions and reconciliation. Finance retains PSP milestones, capture, settlement, payout, and provider-state design. No frozen contract changed.

## 10. Test Matrix and API verification

Focused backend qualification passed: **5 suites, 114 tests**. It covers invalid `dateFrom`, invalid `dateTo`, both-invalid precedence, valid `YYYY-MM-DD`, no database read before rejection, Operations `[from,to)`, Requests KPI/table scope, Payments 422-to-400 query boundary, CRM Activity correction, CRM customer period, Catalog, and the preserved Finance payload boundary.

## 11. Browser/runtime, performance, and known non-blocking failure

Frontend production build compiled successfully. No frontend development server was listening during qualification, so authenticated browser smoke testing of Requests, Orders, Bookings, Payments, CRM Activity, Command Center, and Analytics was not executed. Full frontend tests have one pre-existing unrelated locale assertion discrepancy: this Node runtime emits a regular space before `₼` for `az-AZ`, while the test expects a non-breaking space. D8 date display behavior is not implicated. No performance-sensitive query or index changes were made.

## 12. Security / tenant / RBAC

Temporal predicates are additive to existing policy/scope predicates. D8 contains no role, permission, guard, scope, or tenant-model change. Focused tests prove malformed filters do not reach database reads; existing tenant/RBAC coverage remains unchanged.

## 13. Git Evidence and Final Verdict

Before commit, run `git status`, `git diff --check`, `git diff --stat`, and `git diff --name-only`; then record final SHA and origin parity.

**Final verdict: B — VALID SYSTEM FAIL.** The D8 implementation and focused validation evidence pass, but mandatory authenticated browser/runtime and full security/tenant qualification evidence was unavailable in this environment. This is a bounded non-security evidence gap and does not justify Verdict A.
