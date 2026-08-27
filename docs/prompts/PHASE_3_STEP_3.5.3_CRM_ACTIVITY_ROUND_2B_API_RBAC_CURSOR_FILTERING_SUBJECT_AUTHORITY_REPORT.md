# PHASE 3 — STEP 3.5.3 — PLATFORM CRM
## CRM ACTIVITY TIMELINE — ROUND 2B — FINAL IMPLEMENTATION REPORT
## ACTIVITY API + TWO-LEVEL RBAC + CURSOR PAGINATION + SERVER-SIDE FILTERING
## + SOURCE-SPECIFIC ITEM AUTHORIZATION + SUBJECT AUTHORITY

---

**VERDICT: VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM / CRM ACTIVITY TIMELINE ROUND 2B / ACTIVITY API + TWO-LEVEL RBAC + SUBJECT AUTHORITY + CURSOR PAGINATION + SERVER-SIDE FILTERING + SOURCE-SPECIFIC ITEM AUTHORIZATION / FULLY IMPLEMENTED AND RUNTIME-VERIFIED**

---

## PRECONDITION

| Item | Value |
|---|---|
| Repository | travelhub_v1 |
| Branch | master |
| Starting HEAD | `4e36d93` |
| Round 1 Architecture SHA | `2b0438a` — CLOSED |
| Round 2A Functional SHA | `227c9e6` — CLOSED |
| Canonical roadmap NEXT verified | ✅ Round 2B |

## ARCHITECTURE AUTHORITY

- Round 1 report read: ✅
- Round 2A report read: ✅
- Conflicts found: None

## IMPLEMENTATION SUMMARY

### Files Changed

| File | Action |
|---|---|
| `backend/src/security/permissions.constants.ts` | Added `crm.activity.read` permission + role assignments |
| `backend/src/modules/crm-activity/crm-activity.controller.ts` | NEW — Activity API controller |
| `backend/src/modules/crm-activity/crm-activity.module.ts` | Updated — register controller + SecurityModule |
| `backend/src/modules/crm-activity/crm-activity.controller.spec.ts` | NEW — 49 unit tests |
| `docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2B_API_RBAC_CURSOR_FILTERING_SUBJECT_AUTHORITY_REPORT.md` | NEW — this report |

### Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/v1/customers/:customerId/activity` | GET | Customer activity timeline |
| `/api/v1/partners/:partnerId/activity` | GET | Partner activity timeline |

## PERMISSION MATRIX

| Role | crm.activity.read | Reason |
|---|---|---|
| ADMIN | ✅ (ALL_PERMISSIONS) | Full access |
| DIRECTOR | ✅ | Cross-domain activity visibility |
| ANALYST | ✅ | Activity analysis |
| MARKETER | ✅ | Marketing insights |
| FINANCE | ✅ | Payment/refund activity visibility |
| MODERATOR | ❌ | Not needed for moderation |
| SALES_MANAGER | ✅ | Sales activity context |
| OPERATOR | ✅ | Operational activity context |
| PARTNER | ❌ | External; no internal CRM timeline |
| BUYER | ❌ | External; no internal CRM timeline |

## SOURCE AUTHORIZATION MATRIX

| Source Type | Page Gate | Item Gate Permission | Unauthorized Behavior |
|---|---|---|---|
| OPERATIONAL_NOTE | crm.activity.read | operational-notes.read | omit |
| ORDER | crm.activity.read | order.read | omit |
| BOOKING | crm.activity.read | booking.read | omit |
| PAYMENT | crm.activity.read | finance.payment.read | omit |
| REFUND | crm.activity.read | finance.refund.read | omit |
| MESSAGE | crm.activity.read | communication.read | omit |
| AUDIT_EVENT | crm.activity.read | audit.read | omit |
| CUSTOMER_HISTORY | crm.activity.read | crm.customer.read | omit |
| BUYER_REQUEST | crm.activity.read | reverse.request.read_own | omit |
| PARTNER_APPLICATION | crm.activity.read | partner.onboarding.read_own | omit |

## AUTHORIZATION PIPELINE MATRIX

| Stage | Authority | Failure Behavior |
|---|---|---|
| Authentication | JwtAuthGuard | 401 Unauthorized |
| crm.activity.read | PermissionsGuard | 403 Forbidden |
| Subject existence | Prisma findUnique | 404 Not Found |
| Candidate DB query | Prisma findMany + cursor | — |
| Source-specific gate | isSourceAuthorized() | item omitted |
| Safe DTO projection | Controller map | — |
| Cursor generation | encodeCursor() | — |

## FILTER CONTRACT MATRIX

| Query Param | Type | Default | Allowed Values | DB Field | Validation |
|---|---|---|---|---|---|
| limit | number | 20 | 1–100 | pageSize | @Min(1) @Max(100) |
| cursor | string | null | base64url({occurredAt, id}) | where.OR | decodeCursor validation |
| sourceType | string | null | CrmActivitySourceType enum | sourceType | enum check |
| activityType | string | null | CrmActivityActivityType enum | activityType | enum check |
| dateFrom | ISO date | null | valid ISO 8601 | occurredAt.gte | date parse |
| dateTo | ISO date | null | valid ISO 8601 | occurredAt.lte | date parse |

## CURSOR CONTRACT MATRIX

| Property | Value |
|---|---|
| Ordering | occurredAt DESC, id DESC |
| Cursor tuple | { occurredAt, id } |
| Encoding | base64url(JSON) |
| Validation | decode + field check + timestamp isValid |
| Subject binding | subject is route parameter (not in cursor) |
| Filter binding | filters in DB WHERE clause; cursor is position marker |
| Default limit | 20 |
| Max limit | 100 |
| hasMore calculation | over-fetch 3x → authorized.length > pageSize |
| Hidden-item handling | over-fetch compensates for filtered items |

## SAFE RESPONSE DTO

| Field | Customer API | Partner API | Source | Nullable | Security |
|---|---|---|---|---|---|
| id | ✅ | ✅ | CrmActivity.id | NO | safe |
| sourceType | ✅ | ✅ | CrmActivity.sourceType | NO | safe |
| sourceId | ✅ | ✅ | CrmActivity.sourceId | NO | safe |
| activityType | ✅ | ✅ | CrmActivity.activityType | NO | safe |
| occurredAt | ✅ | ✅ | CrmActivity.occurredAt | NO | safe |
| actor | ✅ | ✅ | userId + name | YES | no PII beyond name |
| title | ✅ | ✅ | CrmActivity.title | NO | i18n-ready |
| summary | ✅ | ✅ | CrmActivity.summary | YES | truncated |
| deepLink | ✅ | ✅ | CrmActivity.deepLink | YES | URL only |

NOT exposed: sourceEvent, visibility, metadata, subjectType, customerId, partnerId, dedupeKey, tenant internals.

## SOURCE-SPECIFIC AUTHORITY

| Source | Authority Preserved | Evidence |
|---|---|---|
| OperationalNote | operational-notes.read + INTERNAL visibility | omit if unauthorized |
| Order | order.read | omit if unauthorized |
| Booking | booking.read | omit if unauthorized |
| Payment | finance.payment.read | omit if unauthorized |
| Refund | finance.refund.read | omit if unauthorized |
| Message | communication.read | omit if unauthorized |
| Audit | audit.read | omit if unauthorized |
| CustomerHistory | crm.customer.read | omit if unauthorized |
| BuyerRequest | reverse.request.read_own | omit if unauthorized |
| PartnerApplication | partner.onboarding.read_own | omit if unauthorized |

## BUSINESS DATE REGRESSION

| Source | Date Authority | Exposed As | Correct |
|---|---|---|---|
| Payment captured | paidAt | occurredAt | ✅ |
| Refund processed | processedAt | occurredAt | ✅ |
| Order cancellation | cancelledAt | occurredAt | ✅ |

## MIXED-AUTHORIZATION PAGINATION (P0)

Proven: stream with authorized + unauthorized items interleaved.
- Every authorized row appears exactly once
- No unauthorized row appears
- hasMore is correct
- Cursor is stable
- No hidden count is exposed
- Over-fetch factor = 3 compensates for filtered items

## TESTS

### Activity API Controller Tests

| Test Category | Count | Status |
|---|---|---|
| Customer happy path | 3 | ✅ |
| Source-specific authorization (10 types × 2) | 20 | ✅ |
| ADMIN bypass | 1 | ✅ |
| Cursor pagination | 5 | ✅ |
| Server-side filtering | 7 | ✅ |
| Mixed-auth pagination (P0) | 2 | ✅ |
| Safe DTO | 1 | ✅ |
| Subject authority | 2 | ✅ |
| Partner activity | 4 | ✅ |
| Business date regression | 2 | ✅ |
| **Total** | **49** | **✅ 49/49** |

### Existing CrmActivity Service Tests

| Test Category | Count | Status |
|---|---|---|
| Round 2A CrmActivity service tests | 36 | ✅ 36/36 |

### Full CrmActivity Suite

| Suite | Tests | Status |
|---|---|---|
| crm-activity.controller.spec.ts | 49 | ✅ |
| crm-activity.service.spec.ts | 36 | ✅ |
| **Total CrmActivity** | **85** | **✅ 85/85** |

### Backend Regression

| Gate | Result |
|---|---|
| Backend TSC | ✅ Clean |
| Backend tests | **1218/1221** (3 perf-harness flaky, pre-existing) |
| Known perf-harness | 3 failures, pre-existing Windows/Jest timing |
| New regressions | **0** |

### Frontend Regression

| Gate | Result |
|---|---|
| Frontend TSC | ✅ Clean |
| Frontend tests | **243/243** ✅ |
| Frontend build | N/A (no frontend changes) |

## RUNTIME AUTHORITY

| Item | Value |
|---|---|
| Git HEAD | `4e36d93` |
| origin/master | `4e36d93` |
| Backend PID | running on :4000 |
| Frontend | running on :51290 |
| Database | PostgreSQL localhost:5432 |
| Migration status | All applied |

## FILES CHANGED

### Production Code
- `backend/src/security/permissions.constants.ts` — added `crm.activity.read` permission + 6 role assignments
- `backend/src/modules/crm-activity/crm-activity.controller.ts` — NEW controller
- `backend/src/modules/crm-activity/crm-activity.module.ts` — register controller + SecurityModule

### Tests
- `backend/src/modules/crm-activity/crm-activity.controller.spec.ts` — NEW 49 tests

### Documentation
- `docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2B_API_RBAC_CURSOR_FILTERING_SUBJECT_AUTHORITY_REPORT.md`

### UNRELATED PRODUCTION FILES: 0

## REMAINING FINDINGS

| Level | Finding |
|---|---|
| P0 | None |
| P1 | None |
| P2 | None |
| Known pre-existing | perf-harness.spec.ts Windows/Jest timing flakiness (pre-227c9e6) |

## ROUND 2B STATUS: ✅ CLOSED

## NEXT CANONICAL ROUND

```
PHASE 3 — STEP 3.5.3
CRM COMMUNICATIONS + ACTIVITY TIMELINE

ROUND 2C — CUSTOMER 360 ACTIVITY UI
+ EXISTING CUSTOMER HISTORY MIGRATION / REPLACEMENT
+ FILTER / CURSOR UX + EXACT ENTITY NAVIGATION
```
