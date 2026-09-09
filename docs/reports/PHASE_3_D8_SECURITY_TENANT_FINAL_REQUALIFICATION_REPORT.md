# PHASE 3 — D8 Security / Tenant Final Re-qualification

## Executive Summary

This evidence-only pass addressed the remaining multi-role security gap after D8 temporal validation remediation. Baseline was `882adf494e554a0cf8ec20398759ada8a706dd65` on `master`, equal to `origin/master`. No production code changed.

## Environment

PostgreSQL, backend (`localhost:4000`), and frontend (`localhost:3000`) were running. Independent authenticated browser sessions were used for DIRECTOR, OPERATOR, BUYER, and PARTNER test accounts.

## Role Matrix

| Role | Route / query | Actual | Result |
|---|---|---|---|
| DIRECTOR | Orders, valid `2026-09-01..2026-10-01` | 200, total 66, request id | PASS |
| DIRECTOR | Orders, `dateFrom=bad` | 400 canonical validation, request id | PASS |
| OPERATOR | Orders, valid range | 200, total 66 | PASS |
| OPERATOR | Payments, valid or malformed date | 403 `finance.payment.read` missing | PASS; no validation bypass |
| BUYER | Orders, valid or malformed date | 403 `order.read` missing | PASS; no data/count leakage |
| BUYER | Analytics | 403 `analytics.read` missing | PASS |
| PARTNER | Orders, narrow, broad, or malformed range | 403 `order.read` missing | PASS; no temporal bypass |

## Tenant Isolation Matrix

T1 is evidenced for the privileged internal context: changing the date range narrowed the Orders dataset to 66 rows. T2–T4 cannot be completed as tenant-row assertions: the available PARTNER fixture has no permission to a D8 registry endpoint, so it proves denial but cannot prove a scoped registry subset. No cross-tenant row, count, KPI, or Analytics data was returned to BUYER/PARTNER unauthorized sessions.

## Direct API and Authentication Evidence

DIRECTOR valid Orders request returned 200 and request id `50d0968d-6140-4928-b677-1cd6733a9751`; malformed date returned canonical 400 and request id `57898680-2333-4283-a77c-976cb782542f`. OPERATOR, BUYER, and PARTNER direct API calls demonstrate permission guards execute before temporal validation for denied endpoints, with no response data. This pipeline behavior is security-safe and recorded rather than treated as validation PASS.

## Data Leakage Checks

No unauthorized response included registry rows, totals, aggregates, or Analytics data. Broad historical/future PARTNER Orders query remained 403, matching narrow and malformed variants. Temporal query parameters were additive and did not weaken existing guards.

## Known Limitation

The real fixture set lacks a PARTNER (or other non-privileged) user that is authorized to a D8 registry while bound to a distinct tenant/scope. Therefore a positive scoped-row T2–T4 tenant-isolation proof is unavailable. This must not be represented as PASS.

## Final Verdict

**VERDICT B — VALID SYSTEM FAIL.** Negative RBAC evidence is strong and no D8 security defect was found, but the mandatory positive multi-tenant scoped-dataset evidence cannot be obtained from the available fixture. D8 is not declared closed and no next stage is selected.
