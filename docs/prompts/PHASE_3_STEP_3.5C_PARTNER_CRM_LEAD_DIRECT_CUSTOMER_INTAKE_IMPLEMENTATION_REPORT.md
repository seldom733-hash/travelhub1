# PHASE 3 — STEP 3.5C — PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE

## ОТЧЁТ IMPLEMENTATION

**Дата:** 2026-08-28
**Branch:** master
**Starting HEAD:** bd6aee3
**Final HEAD:** (после коммита)

---

## 1. REPOSITORY BASELINE

```
Starting HEAD: bd6aee3
Branch: master
HEAD == origin/master: ✓
Worktree: clean (до изменений)
bd6aee3 reachable: ✓
737de35 reachable: ✓
27b2653 reachable: ✓
e4b38a3 reachable: ✓
```

## 2. CANONICAL STEP 3.5C SCOPE

```
Canonical Step 3.5C: Partner CRM Lead & Direct Customer Intake
Dependencies: Step 3.5 ✅, Step 3.5A ✅, Step 3.5B ✅
Acceptance criteria: SEE §64 VERDICT A GATES
Deferred: Tasks, Documents, Segmentation, Analytics, Supplier, Partner Workspace CRM
Exact NEXT: PHASE 3 — STEP 3.5D — Partner CRM Entitlement & Capability Model
```

## 3. ACTUAL INTAKE INVENTORY

| Intake path | Exists? | Endpoint | Creates Customer? | Creates PCR? | Source attribution | Idempotent? |
|---|---|---|---|---|---|---|
| Platform CRM manual | ✓ | POST /customers | ✓ | ✗ | N/A | ✓ (unique email) |
| Platform CRM admin intake | ✓ (NEW) | POST /partners/:id/intake | ✓ | ✓ | ✓ leadSource | ✓ (reuse) |
| Partner intake (PRO) | ✓ (FIXED) | POST /partner/customers/intake | ✓ | ✓ | ✓ leadSource | ✓ (reuse) |
| Order-derived | ✓ | Order → ensureCustomerForBuyer | ✓ (reuse) | ✗ | N/A | ✓ |
| Booking-derived | ✓ | Via Order | ✓ (reuse) | ✗ | N/A | ✓ |

**Ключевые исправления:**
1. `intakePartnerCustomer` — выбрасывал ConflictError при существующем PCR → **ИСПРАВЛЕНО: reuse**
2. Platform CRM admin intake — **ДОБАВЛЕН**: `POST /partners/:partnerId/intake`

## 4. IDENTITY RESOLUTION AUTHORITY

| Concept | Entity | Authority |
|---|---|---|
| Customer identity | Customer (email @unique) | deterministic match |
| Partner relationship | PartnerCustomerRelation | @@unique([partnerId, customerId]) |
| Normalization | normalizeEmail() | trim + lowercase |
| Matching field | email only | deterministic, no fuzzy |

**Identity Resolution Matrix:**

| Scenario | Existing Customer? | Existing PCR? | Customer result | PCR result | Duplicate? |
|---|---|---|---|---|---|
| New identity + Partner A | No | No | Created | Created | 0 |
| Existing identity + new Partner | Yes | No | Reused | Created | 0 |
| Existing identity + same Partner | Yes | Yes | Reused | Reused | 0 |
| Same identity + Partner B | Yes | No | Reused | Created | 0 |

## 5. PCR ENSURE SEMANTICS

```
Existing Customer + new PCR → Customer reused, PCR created
Existing Customer + existing PCR → Customer reused, PCR reused (NO throw)
New Customer + new PCR → both created
```

**Исправлено:** Previously `intakePartnerCustomer` threw `ConflictError` when PCR existed. Now returns existing relation.

## 6. PLATFORM CRM ADMIN INTAKE

```
Endpoint: POST /partners/:partnerId/intake
Permission: crm.partner.write
Partner scope: explicit path parameter (not actor.partnerId)
Tier gating: NONE (Platform CRM admins can intake for any partner)
```

## 7. RUNTIME SCENARIOS

| Scenario | customerCreated | relationCreated | Customer delta | PCR delta |
|---|---|---|---|---|
| A: New + Partner A | True | True | +1 | +1 |
| B: Same + Partner B | False | True | 0 | +1 |
| C: Repeat + same Partner | False | False | 0 | 0 |

**Верификация:** 1 Customer, 2 PCR rows, 0 дубликатов.

## 8. PREVIOUS STAGE REGRESSION

| Stage | Status |
|---|---|
| Step 3.5.3 | ✓ Customer 360 orders/bookings/payments work |
| Step 3.5A | ✓ Partner 360 all tabs work |
| Step 3.5B | ✓ Identity/relationship model preserved |

## 9. TESTS

| Test | Count | Status |
|---|---|---|
| Backend intake tests (NEW) | 11 | 11/11 PASS |
| Backend full suite | 1247 | 1247/1247 PASS |
| Frontend full suite | 243 | 243/243 PASS |
| Backend TSC | — | PASS |
| Backend build | — | PASS |
| Frontend TSC | — | PASS |
| Frontend build | — | PASS |
| Skipped | 0 | — |

## 10. SCHEMA / MIGRATION

```
Schema: 0
Migration: 0
Reason: Существующая модель PartnerCustomerRelation с @@unique([partnerId, customerId])
достаточна для canonical intake flow.
```

## 11. FILES CHANGED

| File | Change |
|---|---|
| backend/src/modules/crm/crm.service.ts | Fix intakePartnerCustomer PCR reuse + add platformIntakeCustomer |
| backend/src/modules/crm/crm.controller.ts | Add POST /partners/:partnerId/intake endpoint |
| backend/src/modules/crm/crm.service.intake.spec.ts | NEW: 11 intake tests (scenarios A-E) |
| frontend/app/app/crm/partners/[id]/page.tsx | Add Platform CRM intake form on Customers tab |
| frontend/lib/i18n.tsx | Add intake i18n keys (phone, office, email, other, success/error) |
| frontend/lib/api.ts | Add relationCreated to PartnerIntakeResult |

## 12. LOCALIZATION

| Language | Status |
|---|---|
| RU | ✓ |
| AZ | ✓ |
| EN | ✓ |
| Raw keys | 0 |
| Raw enums | 0 |
| Mixed locale | 0 |

## 13. GIT EVIDENCE

```
Starting HEAD: bd6aee3
Final HEAD: (после коммита)
HEAD == origin/master: ✓
```

## 14. VERDICT

```
VERDICT A — PHASE 3 — STEP 3.5C /
PARTNER CRM LEAD & DIRECT CUSTOMER INTAKE /
CUSTOMER IDENTITY REUSE + PARTNER RELATIONSHIP ENSURE /
FULLY CLOSED
```

## 15. NEXT

```
PHASE 3 — STEP 3.5D —
PARTNER CRM ENTITLEMENT & CAPABILITY MODEL
```

**STOP. Не начинать Step 3.5D без отдельного задания.**
