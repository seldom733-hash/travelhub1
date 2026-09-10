# PHASE 3 — ADMIN DOCUMENTS UI
## ROADMAP PLACEMENT DECISION & TRACKING GATE

**Date:** 2026-09-11
**Mode:** ARCHITECTURE / ROADMAP DECISION ONLY — NO PRODUCTION IMPLEMENTATION
**Git:** `606ee9a698787a3688d8002bfa6e5728a9c3ff54`

---

## 1. Existing State

### D13 Closure

D13 is CLOSED. The implementation delivered:

- Document data model (Prisma schema + migration)
- Voucher lifecycle (ISSUED → INVALIDATED)
- Partial Payment Document
- Refund Document
- Real PDF generation (`@react-pdf/renderer`)
- Buyer Cabinet document surface (`/account/documents`)
- Admin/Operator backend API (6 endpoints, RBAC enforced, PII redaction)
- RBAC wired: `documents.read` (ADMIN/DIRECTOR/FINANCE/ANALYST/SALES_MANAGER/OPERATOR), `documents.write` (ADMIN/OPERATOR)

### Admin UI Gap

The Admin platform sidebar (`frontend/components/Shell.tsx` lines 36-86) contains 7 navigation groups with 15 items. **No "Documents" entry exists.** No `/app/documents` route, no admin document page, no frontend code calling `/api/v1/documents`.

### Qualification Result

`PHASE_3_D13_ADMIN_DOCUMENTS_UI_QUALIFICATION.md` classified this as **C — DOCUMENTED DEBT**: the Admin/Operator frontend surface was never explicitly required as MUST by any approved D13 contract, and D13 remains CLOSED.

---

## 2. Evidence

### Canonical Roadmap

**File:** `docs/prompts\TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2,971 lines)
- D-track sequence: D1→…→D13→**D14**→STEP 3.12
- D14 = "PRE-STEP 3.12 Final Requalification" (ACCEPTANCE_DEBT)
- STEP 3.12 = Final Phase 3 gate (BLOCKED by D14)

**File:** `docs/prompts\TRAVELHUB_MASTER_ROADMAP.md` (944 lines)
- Current state: D8=DONE, D9=DONE, TRUE NEXT=D10
- C-track: UI-C1 through UI-C18 all CLOSED
- No future UI stages defined beyond C-track

### Master Debt Register

**File:** `docs\TRAVELHUB_DEBT_REGISTER.md` (921 lines)
- Contains SEC-UI-01, UI-01 through UI-09, HELP-01 through HELP-04, DATA-01/02, PROD-01, FIN-01
- **No UI-DOC-ADMIN entry exists**

**File:** `docs\reports\PHASE_3_PRE_STEP_3.12_CANONICAL_ARCHITECTURE_RECONCILIATION_ROADMAP_REALIGNMENT_REPORT.md` (line 281-297)
- Master Debt Register D0-D14 established
- D14 = PRE-STEP 3.12 Final Requalification, ACCEPTANCE_DEBT, NOT STARTED

### D14 Scope

D14 is a **requalification pass** over all D0-D13 work. It is NOT an implementation stage. It has no capacity to absorb new feature work.

### STEP 3.12 Scope

STEP 3.12 is the **final Phase 3 completion gate**. It is BLOCKED by D14 and Phase 2 exit. It is also not an implementation stage.

### C-Track (UI Stages)

All C-track stages are CLOSED (UI-C1 through UI-C18). The C-track ended with UI-C18 Git Hard Closure. There are **no open or future UI stages** in the canonical roadmap.

---

## 3. Placement Analysis

### Option A — D14

**D14 = PRE-STEP 3.12 Final Requalification** (ACCEPTANCE_DEBT)

D14 is a requalification audit, not an implementation stage. It reviews D0-D13 work for correctness. It does not create new features. Adding UI implementation to D14 would violate its scope definition.

**Verdict: REJECTED** — D14 has no implementation capacity.

### Option B — STEP 3.12

STEP 3.12 is the final Phase 3 completion gate. It is a qualification checkpoint, not a feature delivery stage. It depends on D14 completion and Phase 2 exit.

**Verdict: REJECTED** — STEP 3.12 is a gate, not an implementation stage.

### Option C — EXISTING FUTURE UI STAGE

The C-track (UI-C1 through UI-C18) is fully CLOSED. There are no open or future UI stages in the canonical roadmap. The C-track was explicitly closed with UI-C18 Git Hard Closure.

**Verdict: REJECTED** — No existing future UI stage exists.

### Option D — NEW EXPLICIT UI SUB-STAGE

Could create a new stage (e.g., "UI-C19 — Admin Documents UI"). However, the placement decision prompt states: "Do NOT finalize a new top-level group called 'Documents' unless a formal IA review approves it" and "A target stage MUST NOT be invented without evidence."

Creating a new stage requires:
1. Formal IA review for navigation placement
2. Governance approval for new stage creation
3. Product ownership assignment

This exceeds the scope of a placement decision.

**Verdict: REJECTED** — Requires formal IA review + governance approval not available in this pass.

### Option E — PLANNED DEBT WITH EXPLICIT TARGET STAGE TO BE DETERMINED

The Admin Documents UI is a real, validated debt item. The backend is complete, the Buyer UI is complete, and the Admin surface is missing. The feature needs a canonical home in the roadmap, but the current roadmap structure does not provide a ready-made stage for it.

The correct action is:
1. Register UI-DOC-ADMIN in the Debt Register as PLANNED
2. Define its scope, dependencies, and acceptance criteria
3. Leave the target stage as "TO BE DETERMINED" pending:
   - IA review for navigation placement (OPERATIONS vs FINANCE vs new group)
   - Product ownership assignment
   - Governance decision on whether to create a new UI stage or attach to an existing future stage

**Verdict: ACCEPTED** — This is the only option consistent with the current roadmap structure.

---

## 4. Final Placement

**E — PLANNED DEBT WITH EXPLICIT TARGET STAGE TO BE DETERMINED**

---

## 5. Canonical Tracking Entry

### Debt Register Entry (UI-DOC-ADMIN)

```text
ID:                  UI-DOC-ADMIN
Title:               Admin / Operator Documents UI
Category:            UX CONSISTENCY
Severity:            P2
Origin:              D13 Qualification Gate (2026-09-11)
Description:         Admin/Operator platform lacks a Documents section in the navigation.
                     Backend API (documents.read, documents.write) is complete.
                     Buyer Documents UI (/account/documents) is complete.
                     Admin/Operator have no frontend surface to list, view, download,
                     or invalidate documents.
Why it matters:      Platform staff with documents.read/write permissions cannot access
                     documents through the UI. They must use API tools (curl, Postman).
                     This is inconsistent with other admin entities (Orders, Bookings,
                     Payments) which all have admin UI surfaces.
Dependencies:        D13 CLOSED (backend API available)
Planned closure:     TO BE DETERMINED (pending IA review + governance decision)
Status:              PLANNED
Acceptance condition:
  - /app/documents route exists
  - Admin navigation contains Documents in approved IA location
  - ADMIN can list documents
  - OPERATOR can list documents
  - authorized roles can view permitted details
  - PII redaction is correct
  - Buyer remains isolated to /account/documents
  - Partner remains denied
  - download uses signed URL flow
  - invalidation works only for authorized roles
  - invalidated documents cannot be downloaded
  - no new document backend is created
  - D13 API contracts remain unchanged
Closure SHA:         —
Notes:               Placement decision: E (target stage TBD).
                     Requires: (1) IA review for navigation placement,
                     (2) governance decision on new stage vs existing stage,
                     (3) product ownership assignment.
                     Do NOT implement until placement is resolved.
```

---

## 6. Scope

Minimum functional scope:

```text
Admin Platform → Documents → Document List → Document Detail → Download → Invalidate (ADMIN/OPERATOR)
```

Required document types: VOUCHER, PARTIAL_PAYMENT, REFUND

The UI MUST consume the existing Documents backend. It MUST NOT create a second document system.

---

## 7. Dependencies

| Dependency | Status |
|------------|--------|
| D13 CLOSED | ✅ |
| Documents API (6 endpoints) | ✅ Available |
| RBAC (`documents.read`, `documents.write`) | ✅ Wired |
| S3/MinIO signed download | ✅ Available |
| Buyer Documents UI (`/account/documents`) | ✅ Available |
| Finance Center | NOT required |
| PSP / multi-payment | NOT required |
| New document backend | NOT required |

---

## 8. Acceptance Criteria

When eventually implemented, UI-DOC-ADMIN is complete when:

- `/app/documents` exists
- Admin navigation contains the route in the approved IA location
- ADMIN can list documents
- OPERATOR can list documents
- Authorized roles can view permitted details
- PII redaction is correct
- Buyer remains isolated to `/account/documents`
- Partner remains denied
- Download uses signed URL flow
- Invalidation works only for authorized roles
- Invalidated documents cannot be downloaded
- Version/history information is correctly represented
- No new document backend is created
- D13 API contracts remain unchanged
- Existing D8-D13 behavior regresses cleanly

### Required Acceptance Tests

```text
UI-DOC-01 Admin navigation
UI-DOC-02 Operator navigation
UI-DOC-03 Admin document list
UI-DOC-04 Operator document list
UI-DOC-05 Document detail
UI-DOC-06 Authorized download
UI-DOC-07 Invalidate by ADMIN
UI-DOC-08 Invalidate by OPERATOR
UI-DOC-09 Unauthorized invalidate denied
UI-DOC-10 Invalidated download blocked
UI-DOC-11 PII redaction
UI-DOC-12 Buyer/tenant isolation
UI-DOC-13 Partner denial
UI-DOC-14 Version/history display
```

---

## 9. Final Governance Verdict

**PLANNED — TARGET STAGE NOT YET DETERMINABLE**

UI-DOC-ADMIN is registered in the Debt Register as PLANNED with status "target stage TBD." The three prerequisites before implementation can begin:

1. **IA Review** — Determine whether Documents belongs under OPERATIONS, FINANCE, or requires a new navigation group
2. **Governance Decision** — Determine whether to create a new UI stage (UI-C19) or attach to an existing future stage
3. **Product Ownership** — Assign ownership (Documents domain vs Admin Platform vs Finance)

D13 remains CLOSED. No production code was changed.

---

## 10. Files Changed

| File | Change |
|------|--------|
| `docs/reports/evidence/PHASE_3_ADMIN_DOCUMENTS_UI_PLACEMENT_DECISION.md` | NEW — this report |
| `docs/TRAVELHUB_DEBT_REGISTER.md` | UPDATED — UI-DOC-ADMIN entry added |

---

## 11. Git State

```
SHA:    606ee9a698787a3688d8002bfa6e5728a9c3ff54
Status: Documentation-only changes (placement report + debt register update)
```
