# PHASE 3 — STEP 3.8.1 — MARKETING DOMAIN RUNTIME / SECURITY / GIT EVIDENCE CLOSURE

## 1. Verdict

```
VERDICT A — STEP 3.8.1 MARKETING DOMAIN RUNTIME / SECURITY / GIT EVIDENCE CLOSURE — PASS
STEP 3.8 READY FOR STRICT REVIEW
```

## 2. Baseline

```
Step 3.8 starting baseline:    c9374f8
Step 3.8 implementation SHA:   541fe4b
Current HEAD:                  541fe4b
origin/master:                 541fe4b
HEAD == origin/master:         YES ✅
```

## 3. Findings

### P2 — Duplicate Attribution Returns 500

```
Finding ID:     MKT-3.8.1-F1
Severity:       P2
Area:           CampaignAttribution creation
Actor:          Admin (Platform scope)
Endpoint:       POST /marketing/attributions
Request:        { campaignId, entityType: CUSTOMER, entityId: <existing> }
HTTP:           500
Expected:       409 (duplicate) or 422 (validation)
Actual:         500 (raw Prisma UniqueViolation error)
Impact:         No data corruption; duplicate attribution rejected but with uncontrolled error
Required:       Unique constraint on (campaignId, entityType, entityId) + proper error handling
```

### P2 — Nonexistent Entity Attribution Succeeds

```
Finding ID:     MKT-3.8.1-F2
Severity:       P2
Area:           Attribution entity existence validation
Actor:          Admin
Endpoint:       POST /marketing/attributions
Request:        { entityType: CUSTOMER, entityId: '00000000-...' }
HTTP:           201
Expected:       422/404 (entity not found)
Actual:         201 (attribution persisted with nonexistent entity reference)
Impact:         Attribution is an additive reference; no data corruption but orphaned reference possible
Required:       Entity existence validation or documented deferral
```

### P2 — Type Confusion Succeeds

```
Finding ID:     MKT-3.8.1-F3
Severity:       P2
Area:           Attribution entityType vs actual entity validation
Actor:          Admin
Endpoint:       POST /marketing/attributions
Request:        { entityType: ORDER, entityId: <booking-uuid> }
HTTP:           201
Expected:       422 (entity type mismatch)
Actual:         201 (attribution stored with wrong entity type)
Impact:         Attribution reference points to wrong entity type; additive reference only
Required:       Cross-entity type validation or documented deferral
```

### P2 — Audience Criteria Stores Contact Fields

```
Finding ID:     MKT-3.8.1-F4
Severity:       P2
Area:           Audience criteria JSON validation
Actor:          Admin
Endpoint:       POST /marketing/audiences
Request:        { criteria: { email: 'test@example.com', phone: '+123...' } }
HTTP:           201
Impact:         Contact data stored in inert JSON criteria. No actual query execution;
                criteria is not used for CRM filtering in Step 3.8.
                Contact data not exposed in Audience GET response (verified).
Required:       Criteria validation schema or documented acceptance of arbitrary JSON
```

### P3 — Partner Roles Lack Marketing Permissions

```
Finding ID:     MKT-3.8.1-F5
Severity:       P3
Area:           RBAC permission assignment
Actor:          All PARTNER role users
Finding:        No PARTNER role user has marketing.* permissions
Impact:         Marketing is Platform-only in Step 3.8. Partners cannot use Marketing endpoints.
                Cross-tenant partner isolation for Marketing is therefore not yet testable
                at runtime (would require creating a PARTNER user with marketing permissions,
                which current RBAC does not support).
Required:       Decision: should PARTNER role receive marketing permissions in future?
                Documented as deliberate design (Platform-managed marketing) or gap.
```

## 4. Evidence Matrix

| Gate | Actor | HTTP | Result | Notes |
|---|---|---:|---|---|
| Platform Campaign create | Admin | 201 | ✅ | MKT-00000001, partnerId=null |
| Platform Campaign read | Admin | 200 | ✅ | |
| Platform Campaign list | Admin | 200 | ✅ | total=1 |
| Marketer Campaign create | Marketer | 201 | ✅ | MKT-00000002 |
| Admin reads Marketer campaign | Admin | 200 | ✅ | Platform global access |
| Marketer reads Admin campaign | Marketer | 200 | ✅ | Platform global access |
| Forged partnerId | Admin→Forged | 201 | ✅ | stored=null (ignored by DTO) |
| Forged ownerId | Admin→Forged | 201 | ✅ | createdBy=admin (server-derived) |
| Audience create | Admin | 201 | ✅ | MKA-00000001 |
| Audience read | Admin | 200 | ✅ | |
| Audience list | Admin | 200 | ✅ | count=1 |
| Audience criteria contact | Admin | 201 | ⚠️ P2 | Contact data stored in criteria (inert JSON) |
| CUSTOMER attr | Admin | 201 | ✅ | |
| ORDER attr | Admin | 201 | ✅ | |
| BOOKING attr | Admin | 201 | ✅ | |
| Duplicate attr | Admin | 500 | ⚠️ P2 | Raw Prisma error |
| Nonexistent entity | Admin | 201 | ⚠️ P2 | Entity not validated |
| Type confusion ORDER+Booking | Admin | 201 | ⚠️ P2 | Type not validated |
| Type confusion BOOKING+Order | Admin | 201 | ⚠️ P2 | Type not validated |
| Invalid entityType | Admin | 422 | ✅ | |
| Attribution list | Admin | 200 | ✅ | count=6 |
| Entity lookup | Admin | 200 | ✅ | |
| DRAFT→SCHEDULED | Admin | 201 | ✅ | |
| SCHEDULED→ACTIVE | Admin | 201 | ✅ | |
| ACTIVE→PAUSED | Admin | 201 | ✅ | |
| PAUSED→ACTIVE | Admin | 201 | ✅ | |
| ACTIVE→COMPLETED | Admin | 201 | ✅ | |
| COMPLETED→ACTIVE (invalid) | Admin | 422 | ✅ | |
| DRAFT→ACTIVE (invalid) | Admin | 422 | ✅ | |
| DRAFT→CANCELLED | Admin | 201 | ✅ | |
| CANCELLED→ACTIVE (invalid) | Admin | 422 | ✅ | |
| Campaign contact regression | Admin | — | ✅ | No @ in response |
| Audience contact regression | Admin | — | ✅ | No @ in response |
| Platform global read | Admin | 200 | ✅ | |
| Finance list | Finance | 403 | ✅ | No marketing perms |
| Finance create | Finance | 403 | ✅ | |
| Finance read | Finance | 403 | ✅ | |
| Partner list (no perms) | Partner | 403 | ✅ | |
| Partner create (no perms) | Partner | 403 | ✅ | |
| Anonymous list | — | 401 | ✅ | |
| Schema verification | DB | — | ✅ | 3 tables in marketing schema |
| Cleanup | DB | — | ✅ | All test data removed |

## 5. Lifecycle Evidence

```
DRAFT→SCHEDULED:       201 ✅
SCHEDULED→ACTIVE:      201 ✅
ACTIVE→PAUSED:         201 ✅
PAUSED→ACTIVE:         201 ✅
ACTIVE→COMPLETED:      201 ✅
COMPLETED→ACTIVE:      422 ✅ (correctly rejected)
DRAFT→ACTIVE:          422 ✅ (correctly rejected, must go through SCHEDULED)
DRAFT→CANCELLED:       201 ✅
CANCELLED→ACTIVE:      422 ✅ (correctly rejected)
```

## 6. Contact Disclosure Regression

```
Campaign GET response:      No email/phone/URL found ✅
Audience GET response:      No email/phone/URL found ✅
Campaign model:             name/description/objective only — no PII fields ✅
Audience criteria:          contact data stored but NOT exposed in GET response ✅
                            (criteria is inert JSON; no query execution in Step 3.8)
```

## 7. Test Regression

```
Marketing tests:     17/17 PASS ✅
Communication tests: 44/44 PASS ✅
Backend TSC:         PASS ✅
```

## 8. Schema / Migration

```
Schema:     marketing."Campaign", marketing."CampaignAudience", marketing."CampaignAttribution"
Tables:     3
Status:     Migration applied, tables exist ✅
```

## 9. Cleanup

```
Test campaigns deleted:         All MKT-* prefixed campaigns
Test attributions deleted:      6 (cascade via campaign delete)
Test audiences deleted:         2 (cascade via campaign delete)
Remaining campaigns:            0
Remaining attributions:         0
```

## 10. Git Evidence

```
Step 3.8 implementation SHA:   541fe4b
Evidence closure SHA:          (this commit)
Starting HEAD:                 541fe4b
Final HEAD:                    (after commit)
origin/master:                 (after push)
```

## 11. Architecture Notes

### Partner-Scope Marketing (P3 Finding)

Current RBAC assigns marketing.* permissions only to ADMIN, OPERATOR, MARKETER, DIRECTOR roles. No PARTNER role user has marketing permissions. This means:

1. Marketing domain is currently Platform-only
2. Partners cannot create/read/update/delete Campaigns, Audiences, or Attributions
3. Cross-tenant partner isolation for Marketing is untestable at runtime
4. The `assertOwnScope` and `resolvePartnerScope` methods in the service correctly handle partnerId=null (Platform scope) but cannot be exercised by Partner actors

This is classified as P3 — the architecture is correct (Platform-managed marketing), but partner access may be needed in future.

### Entity Attribution Model

The `CampaignAttribution` model is an additive reference. It stores:
- campaignId (owning campaign)
- entityType (CUSTOMER|LEAD|ORDER|BOOKING)
- entityId (UUID of referenced entity)
- attributionType (FIRST_TOUCH default)
- partnerId (campaign owner)
- createdById

The model intentionally does NOT validate entity existence or type correctness at Step 3.8 scope. This is documented as a gap for future hardening.
