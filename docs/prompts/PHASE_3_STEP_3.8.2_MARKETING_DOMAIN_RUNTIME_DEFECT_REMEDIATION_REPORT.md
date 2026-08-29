# PHASE 3 — STEP 3.8.2 — MARKETING DOMAIN ATTRIBUTION / AUDIENCE RUNTIME DEFECT REMEDIATION — REPORT

## 1. Baseline

```
Step 3.8.1 evidence SHA:   8b32e34
Starting HEAD:             8b32e34
Starting origin/master:    8b32e34
HEAD == origin/master:     YES
```

## 2. Original Findings (Step 3.8.1)

| Finding | Severity | Runtime |
|---|---:|---|
| Duplicate attribution raw 500 | P2 | duplicate returns raw Prisma P2002 error |
| Nonexistent attribution entity accepted | P2 | nonexistent entityId persists with 201 |
| Attribution type confusion | P2 | wrong entity type ID persists with 201 |
| Audience arbitrary/contact criteria | P2 | arbitrary JSON including contact fields stored |
| Partner Marketing permissions | P3 | Partner roles lack marketing.* permissions |

## 3. Root Causes and Fixes

### 3.1 Defect A: Nonexistent Entity (P2 → FIXED)

**Root cause:** `createAttribution` stored `entityId` without verifying the entity exists in the canonical domain.

**Fix:** Added `validateEntityReference()` private method that resolves each `entityType` through its canonical authority:
- `CUSTOMER` → `prisma.customer.findUnique`
- `LEAD` → `prisma.lead.findUnique`
- `ORDER` → `prisma.order.findUnique`
- `BOOKING` → `prisma.booking.findUnique`

Nonexistent entity → controlled 404 `NotFoundError`, persistence = 0.

**Files:** `marketing.service.ts` — `validateEntityReference()` method, called from `createAttribution()`.

### 3.2 Defect B: Type Integrity (P2 → FIXED)

**Root cause:** `entityId` was not validated through the authority matching `entityType`. An Order UUID could be submitted as `entityType: BOOKING`.

**Fix:** Same `validateEntityReference()` method — each `entityType` branch does a lookup against its specific table. An Order UUID submitted as `BOOKING` fails `prisma.booking.findUnique` → 404.

**Runtime proof:** `BOOKING + OrderId → HTTP 404, persistence=0`

### 3.3 Defect C: Duplicate Attribution Raw 500 (P2 → FIXED)

**Root cause:** The DB-level unique constraint `(campaignId, entityType, entityId)` produced a raw Prisma P2002 error mapped to HTTP 500.

**Fix:** Added try/catch around `prisma.campaignAttribution.create` that catches `Prisma.PrismaClientKnownRequestError` with code `P2002` and maps to `ConflictError` (HTTP 409). Unrelated Prisma errors are rethrown.

**Runtime proof:** `Duplicate CUSTOMER → HTTP 409, DB rows = 1`

### 3.4 Defect D: Audience Criteria Contract (P2 → FIXED)

**Root cause:** `CampaignAudience.criteria` JSONB accepted arbitrary fields including `email`, `phone`, `partnerId`, `rawSql`, `password`, `url`, `tenantId` — potential contact-policy bypass and tenant selector surface.

**Fix:** Added `validateAudienceCriteria()` method with:
- **Whitelist:** `lifecycle`, `leadSource`, `tags`, `status`, `customerType`
- **Blocklist:** `email`, `phone`, `url`, `address`, `socialHandle`, `partnerId`, `tenantId`, `ownerId`, `createdById`, `password`, `auth`, `token`, `secret`, `rawSql`, `query`, `$where`, `$expr`
- **Type validation:** values must be string, number, boolean, or string array — no nested objects

Rejected criteria → controlled 422 `ValidationDomainError`.

**Runtime proof:** All 7 blocked fields + unknown field + nested object → HTTP 422.

### 3.5 Partner Marketing Permissions (P3 → DOCUMENTED)

**Decision:** Marketing is currently a Platform-only domain. Partner roles correctly lack `marketing.*` permissions.

**Rationale:**
- Step 3.8 contract defines Marketing as Platform authority (Campaign/Audience/Attribution management)
- Marketplace Basic has no Marketing entitlement in canonical roadmap
- Storefront Pro Marketing access is a future entitlement decision
- Granting Partner marketing permissions now would bypass the entitlement architecture

**Classification change:** P3 → ARCHITECTURE DOCUMENTED (Platform-only by design, not a defect).

### 3.6 Partner Campaign Entity Scope (SECURITY — FIXED)

**Root cause discovered during remediation:** When Platform (admin) created attribution on a Partner-scoped campaign, `resolvePartnerScope(actor)` returned `null` (admin has no partnerId), causing entity validation to skip partner-scope checks. This allowed Platform to link foreign Partner entities to Partner A's campaign.

**Fix:** Changed entity validation to use `campaign.partnerId` (the campaign's own partner scope) instead of the actor's `partnerId`. Platform creating on a Partner campaign now correctly enforces Partner entity scope.

**Runtime proof:** `Partner A Campaign + Partner B CUSTOMER/ORDER/BOOKING → HTTP 404`

## 4. Files Changed

| File | Change |
|---|---|
| `backend/src/modules/marketing/marketing.service.ts` | Entity validation, duplicate handling, criteria validation, scope fix |
| `backend/src/modules/marketing/marketing.service.spec.ts` | 45 tests covering all defect fixes |
| `docs/prompts/PHASE_3_STEP_3.8.2_MARKETING_DOMAIN_RUNTIME_DEFECT_REMEDIATION_REPORT.md` | This report |

## 5. Schema/Migration

```
NO NEW MIGRATION
```

All fixes are service-level. No schema changes required. The existing DB-level unique constraint `(campaignId, entityType, entityId)` was already correct — only the application error mapping was wrong.

## 6. API/RBAC Matrix

| Endpoint | Platform | Partner (own scope) | Partner (foreign) | Anonymous |
|---|---|---|---|---|
| POST /marketing/attributions | 201 (validated) | 201 (validated) | 404 (neutral) | 401 |
| POST /marketing/audiences | 201 (criteria validated) | 201 (criteria validated) | 404 (campaign check) | 401 |
| POST /marketing/campaigns | 201 | 201 (own scope) | N/A | 401 |
| POST /marketing/campaigns/:id/transition | 201/422 | 201/422 | 404 | 401 |

## 7. Runtime Evidence

All 56 assertions passed via authenticated HTTP + DB verification:

| Gate | HTTP | Persistence | Result |
|---|---:|---|---|
| Nonexistent CUSTOMER | 404 | 0 rows | ✅ |
| Nonexistent ORDER | 404 | 0 rows | ✅ |
| Nonexistent BOOKING | 404 | 0 rows | ✅ |
| Nonexistent LEAD | 404 | 0 rows | ✅ |
| BOOKING + OrderId (type confusion) | 404 | 0 rows | ✅ |
| Invalid entityType | 422 | 0 rows | ✅ |
| Valid CUSTOMER | 201 | 1 row | ✅ |
| Valid ORDER | 201 | 1 row | ✅ |
| Valid BOOKING | 201 | 1 row | ✅ |
| Duplicate CUSTOMER | 409 | 1 row | ✅ |
| Duplicate ORDER | 409 | 1 row | ✅ |
| Partner A → Partner B CUSTOMER | 404 | 0 | ✅ |
| Partner A → Partner B ORDER | 404 | 0 | ✅ |
| Partner A → Partner B BOOKING | 404 | 0 | ✅ |
| Partner A → Partner A CUSTOMER | 201 | 1 row | ✅ |
| Partner A → Partner A ORDER | 201 | 1 row | ✅ |
| Partner A → Partner A BOOKING | 201 | 1 row | ✅ |
| Platform → any CUSTOMER | 201 | 1 row | ✅ |
| Valid criteria | 201 | — | ✅ |
| email/phone/partnerId/rawSql/password/url/tenantId | 422 | — | ✅ (×7) |
| Unknown field | 422 | — | ✅ |
| Nested object | 422 | — | ✅ |
| No email in responses | clean | — | ✅ |
| No phone in responses | clean | — | ✅ |
| Lifecycle (6 transitions) | 201/422 | — | ✅ |
| Anonymous → 401 | 401 | — | ✅ |
| Schema tables exist | — | — | ✅ |
| Cleanup | — | 0 remaining | ✅ |

## 8. Security Evidence

| Property | Evidence |
|---|---|
| Cross-tenant entity isolation | Partner A cannot attribute Partner B entities — runtime + DB |
| Forged partnerId | Server-derived from campaign scope, not body input |
| Nonexistent entity | Controlled 404, zero persistence |
| Type confusion | Controlled 404 via canonical domain lookup |
| Duplicate protection | 409 ConflictError (not raw 500) |
| Contact field blocking | 7 blocked fields + unknown + nested → 422 |
| Anonymous denial | 401 |
| No PII leakage | Marketing responses contain no email/phone |

## 9. Tests

```
Marketing tests:     45/45 PASS
Communication tests: 44/44 PASS
Total:               89/89 PASS
Backend TSC:         PASS (0 errors)
Backend Build:       PASS
```

## 10. Deferred Items

| Item | Status | Rationale |
|---|---|---|
| Marketing UI | Deferred | Backend foundation only in Step 3.8 |
| EMAIL/SMS/PUSH transports | Deferred | No transport providers |
| Consent/preferences | Deferred | Compliance boundary |
| Marketing automation | Deferred | Future step |
| Partner Marketing access | Deferred | Platform-only by design, entitlement decision deferred |
| Multi-touch attribution | Deferred | Future step |

## 11. Cleanup

```
3.8.2 Campaigns:     0 remaining
3.8.2 Audiences:     0 remaining
3.8.2 Attributions:  0 remaining
3.8.2 Customers:     0 remaining
3.8.2 Orders:        0 remaining
3.8.2 Bookings:      0 remaining
3.8.2 Partners:      0 remaining
3.8.2 PCRs:          0 remaining
```

## 12. Git Closure

```
Step 3.8 implementation SHA:  541fe4b
Step 3.8.1 evidence SHA:      8b32e34
Step 3.8.2 remediation SHA:   (this commit)
Final HEAD:                   (after commit)
origin/master:                (after push)
HEAD == origin/master:        (after push)
```

## 13. Finding Closure Table

| Finding | Original severity | Root cause | Fix/decision | Runtime proof | Status |
|---|---|---|---|---|---|
| Duplicate attribution raw 500 | P2 | P2002 not mapped | → 409 ConflictError | HTTP 409, rows=1 | CLOSED |
| Nonexistent attribution accepted | P2 | No entity lookup | validateEntityReference | HTTP 404, rows=0 | CLOSED |
| Attribution type confusion | P2 | No type-specific lookup | validateEntityReference | HTTP 404, rows=0 | CLOSED |
| Audience arbitrary/contact criteria | P2 | No criteria validation | Whitelist + blocklist + type | HTTP 422 for all blocked | CLOSED |
| Partner Marketing permissions | P3 | Platform-only design | Architecture documented | Correct by design | CLOSED |
| Partner campaign entity scope (NEW) | P2 | Actor scope used instead of campaign scope | Use campaign.partnerId | HTTP 404 for foreign, 201 for own | CLOSED |

## 14. Verdict

```
VERDICT A — STEP 3.8.2 MARKETING DOMAIN ATTRIBUTION / AUDIENCE RUNTIME DEFECT REMEDIATION — PASS

STEP 3.8 RUNTIME DEFECTS REMEDIATED
STEP 3.8 READY FOR STRICT REVIEW
```
