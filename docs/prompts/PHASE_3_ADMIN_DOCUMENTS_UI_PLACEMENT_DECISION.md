# PHASE 3 — ADMIN DOCUMENTS UI
## ROADMAP PLACEMENT DECISION & TRACKING GATE

**Purpose:** Officially place the missing Admin/Operator Documents UI into the canonical TravelHub roadmap so it cannot be forgotten.

**Current D13 status:** CLOSED  
**Current Admin Documents UI status:** DOCUMENTED DEBT / FUTURE FEATURE  
**Mode:** ARCHITECTURE / ROADMAP DECISION ONLY — NO PRODUCTION IMPLEMENTATION

---

# 1. Problem

D13 implemented and closed the TravelHub document backend and Buyer Documents surface.

The current platform Admin UI does NOT contain an Admin/Operator Documents section.

Current verified state:

```text
ADMIN / OPERATOR
    ├── documents.read ✅
    ├── documents.write ✅
    ├── list/get/download API ✅
    └── frontend Documents UI ❌
```

The qualification classified this as:

```text
C — DOCUMENTED DEBT
```

and explicitly recommended tracking it as a separate debt item / feature rather than reopening D13.

Therefore this task exists to give it a **canonical future implementation location**.

---

# 2. FROZEN SCOPE OF THE FUTURE FEATURE

Feature name:

```text
Admin / Operator Documents UI
```

Minimum functional scope:

```text
Admin Platform
    ↓
Documents
    ↓
Document List
    ↓
Document Detail
    ↓
Download
    ↓
Invalidate (ADMIN / OPERATOR)
```

Required document types:

```text
VOUCHER
PARTIAL_PAYMENT
REFUND
```

The UI MUST consume the existing Documents backend.

It MUST NOT create a second document system.

---

# 3. REQUIRED FUNCTIONALITY

## 3.1 Documents List

Display, at minimum:

- document type;
- document number/code;
- status;
- issue date;
- Order reference;
- Booking reference;
- service information where available;
- amount/payment state where applicable.

Provide appropriate pagination/filtering according to existing platform UI conventions.

Do not invent business filters unsupported by the Documents API.

---

## 3.2 Document Detail

Display:

- document identity;
- type;
- current status;
- version;
- Order / Booking relationship;
- relevant service information;
- payment information where applicable;
- document history/version context where the API exposes it.

PII MUST follow existing canonical role policy.

---

## 3.3 Download

Use:

```text
GET /api/v1/documents/:id/download
```

The frontend MUST NOT expose raw S3/MinIO keys.

Use the existing signed-download flow.

---

## 3.4 Invalidation

For:

```text
ADMIN
OPERATOR
```

where `documents.write` is available:

```text
POST /api/v1/documents/:id/invalidate
```

The UI MUST:

- confirm the action;
- show resulting status;
- prevent download of an invalidated document;
- never delete historical binary records.

---

# 4. RBAC

Reuse the current backend authorization model.

Do NOT introduce frontend-only authorization as the security boundary.

Minimum:

| Role | Documents UI | Read | Write |
|---|---|---|---|
| ADMIN | ✅ | ✅ | ✅ |
| OPERATOR | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ if product UX requires | ✅ | ❌ |
| FINANCE | ✅ if product UX requires | ✅ | ❌ |
| ANALYST | ✅ if product UX requires | ✅ | ❌ |
| SALES_MANAGER | ✅ if product UX requires | ✅ | ❌ |
| BUYER | ❌ | Own-scope via `/account/documents` | ❌ |
| PARTNER | ❌ | ❌ | ❌ |

The implementation must follow backend permissions as the source of truth.

PII policy:

- ADMIN / OPERATOR → full PII where existing canonical helper permits;
- other internal roles → redacted;
- Buyer → own-scope;
- Partner → denied.

---

# 5. INFORMATION ARCHITECTURE PLACEMENT

The feature MUST be placed into the existing Admin platform IA rather than creating a random new navigation area.

The current sidebar already contains:

```text
OPERATIONS
  Requests
  Orders
  Bookings

FINANCE
  Payments

COMMERCIAL
  Catalog
  CRM
  Marketing

PARTNER NETWORK
  Partner Onboarding
  Seller Profiles

SERVICE
  Support
  Help

ADMINISTRATION
  Users
```

The eventual placement decision must be made using existing IA principles and real product ownership.

Candidates:

```text
OPERATIONS
FINANCE
```

Do NOT finalize a new top-level group called “Documents” unless a formal IA review approves it.

The preferred location should be the area whose business ownership best matches platform document operations.

---

# 6. DEPENDENCIES

The future feature depends on:

```text
D13 — CLOSED ✅
Documents API — AVAILABLE ✅
RBAC — AVAILABLE ✅
S3/MinIO signed download — AVAILABLE ✅
Buyer Documents UI — AVAILABLE ✅
```

It does NOT require:

- Finance Center;
- PSP;
- multi-payment engine;
- new document backend;
- reopening D13.

---

# 7. FINANCE BOUNDARY

The Admin Documents UI may display existing commercial/payment facts already provided by the Documents API.

It MUST NOT implement:

- General Ledger;
- Settlement;
- Payout accounting;
- Reconciliation engine;
- Tax accounting;
- Fiscal receipts;
- Invoice engine;
- PSP logic.

Existing Payments UI and future Finance Center remain separate.

---

# 8. ROUTE

Canonical future route:

```text
/app/documents
```

This route is currently not implemented.

Do not implement it during this placement decision.

---

# 9. ROADMAP TRACKING DECISION

The Admin Documents UI MUST be added to the canonical roadmap as a named future work item.

Suggested identifier:

```text
UI-DOC-ADMIN
```

Suggested title:

```text
Admin / Operator Documents UI
```

Suggested type:

```text
UI IMPLEMENTATION DEBT
```

Suggested dependency:

```text
D13 CLOSED
```

Suggested closure:

```text
UI-DOC-ADMIN
```

Suggested status initially:

```text
PLANNED
```

---

# 10. WHEN TO IMPLEMENT

Do NOT automatically assign this feature to D14 merely because D14 follows D13.

Do NOT automatically assign it to Finance.

The correct placement must be determined by the canonical roadmap based on:

1. Admin IA priorities;
2. related Operations/Finance UI work;
3. dependency readiness;
4. whether the Documents UI naturally belongs to an upcoming UI consolidation stage;
5. whether introducing the route earlier would cause navigation fragmentation.

The decision report MUST select exactly one:

```text
A — D14
B — STEP 3.12
C — EXISTING FUTURE UI STAGE
D — NEW EXPLICIT UI SUB-STAGE
E — PLANNED DEBT WITH EXPLICIT TARGET STAGE TO BE DETERMINED
```

A target stage MUST NOT be invented without evidence.

If the current canonical roadmap does not provide enough evidence to choose A-D, choose E and state exactly what future governance decision is required.

---

# 11. REQUIRED ROADMAP UPDATE

After the placement decision, update the canonical roadmap / Debt Register so that the feature cannot disappear.

The update MUST include:

```text
UI-DOC-ADMIN
Name: Admin / Operator Documents UI
Status: PLANNED
Dependency: D13 CLOSED
Scope: list/detail/download/invalidate
Route: /app/documents
Owner domain: Documents / Admin Platform
Security: existing documents RBAC + PII policy
```

Do not create a competing roadmap.

Use the existing canonical roadmap and Debt Register.

Do not alter D13 closure status.

---

# 12. ACCEPTANCE CRITERIA FOR THE FUTURE IMPLEMENTATION

When this feature is eventually implemented, it is complete only when:

- `/app/documents` exists;
- Admin navigation contains the route in the approved IA location;
- ADMIN can list documents;
- OPERATOR can list documents;
- authorized roles can view permitted details;
- PII redaction is correct;
- Buyer remains isolated to `/account/documents`;
- Partner remains denied;
- download uses signed URL flow;
- invalidation works only for authorized roles;
- invalidated documents cannot be downloaded;
- version/history information is correctly represented;
- no new document backend is created;
- D13 API contracts remain unchanged;
- existing D8-D13 behavior regresses cleanly.

---

# 13. ACCEPTANCE TESTS

The future implementation should include at least:

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

# 14. GIT / GOVERNANCE

This placement decision MUST NOT implement the feature.

Permitted changes:

- roadmap;
- Debt Register;
- architecture/debt documentation;
- placement decision report.

Forbidden:

- new route;
- new React page;
- navigation code changes;
- API changes;
- schema changes;
- migration;
- dependency changes.

---

# 15. REQUIRED OUTPUT

Create:

```text
docs/reports/evidence/PHASE_3_ADMIN_DOCUMENTS_UI_PLACEMENT_DECISION.md
```

The report MUST include:

## 1. Existing State

D13 + current Admin UI.

## 2. Evidence

Exact roadmap and repository references.

## 3. Placement Analysis

Evaluate D14 / STEP 3.12 / other existing UI stage / explicit sub-stage.

## 4. Final Placement

Choose A-E.

## 5. Canonical Tracking Entry

Provide the exact proposed roadmap/Debt Register entry.

## 6. Scope

Minimum feature scope.

## 7. Dependencies

## 8. Acceptance Criteria

## 9. Final Governance Verdict

One of:

```text
PLACED — TARGET STAGE CONFIRMED
```

or

```text
PLANNED — TARGET STAGE NOT YET DETERMINABLE
```

---

# 16. STOP CONDITION

After producing the placement decision and updating the canonical roadmap/Debt Register as required:

STOP.

Do not implement Admin Documents UI.

Do not reopen D13.

Do not start D14.

Do not start Finance.

Return:

- final placement;
- updated roadmap entry;
- exact files changed;
- Git SHA;
- clean/dirty status.
