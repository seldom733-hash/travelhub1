# TRAVELHUB — UI-DOC-ADMIN
# TARGET STAGE & IMPLEMENTATION AUTHORIZATION

**Date:** 2026-09-11  
**Mode:** GOVERNANCE DECISION + IMPLEMENTATION AUTHORIZATION  
**Project:** TravelHub  
**Work Item:** `UI-DOC-ADMIN` — Admin / Operator Documents UI

---

## 0. EXECUTIVE DECISION

**DECISION: AUTHORIZED FOR IMPLEMENTATION**

`UI-DOC-ADMIN` is hereby approved as an independent Phase 3 implementation item.

This authorization is **not dependent on**:

- Step 2.17B performance qualification;
- Phase 2 Exit;
- Step 3.12;
- PSP/provider implementation;
- Finance Center;
- multi-payment implementation;
- reopening or changing D13.

The purpose of this decision is to remove the previous governance-only stop caused by an unresolved target-stage/ownership assignment.

---

# 1. GOVERNANCE PLACEMENT

## 1.1 Canonical work item

```text
ID:
UI-DOC-ADMIN

Title:
Admin / Operator Documents UI

Type:
Phase 3 UI Implementation Work Item

Track:
C — Commerce UI / Presentation

Domain:
Operations / Admin Platform
```

`UI-DOC-ADMIN` is a **named work item inside the existing Phase 3 C-track**.

It is **not** a new `UI-C19` stage.

No competing roadmap is created.

---

## 1.2 Target stage

```text
TARGET:
Phase 3 — Commerce UI / Presentation (C-track)
Operations UI continuation

WORK ITEM:
UI-DOC-ADMIN
```

The work item is authorized as the next implementation item for the Operations Documents surface within the existing C-track.

The authorization does not reinterpret historical `UI-C1..UI-C18` stages and does not reopen closed stages.

---

## 1.3 Ownership

### Domain owner

```text
Operations
```

Operations owns the Admin/Operator operational UI surface represented by this feature.

### Formal product / roadmap owner

```text
TravelHub Product / Roadmap Governance
```

For the purpose of this authorization, the project governance authority assigns responsibility for roadmap placement and sequencing to the TravelHub Product / Roadmap Governance function.

No individual person is invented or named.

---

# 2. INDEPENDENCE RULE

The following dependency graph is authoritative for this work item:

```text
D13 — CLOSED
      │
      ▼
Documents API — AVAILABLE
      │
      ├── RBAC — AVAILABLE
      ├── signed download — AVAILABLE
      └── Buyer Documents UI — AVAILABLE
              │
              ▼
       UI-DOC-ADMIN
```

The following are **not prerequisites**:

```text
2.17B
Phase 2 Exit
STEP 3.12
PSP
Finance Center
multi-payment
new document backend
D14 rework
```

The existing placement evidence explicitly establishes that UI-DOC-ADMIN does not depend on 2.17B, Phase 2 Exit, or STEP 3.12.

---

# 3. INFORMATION ARCHITECTURE

The approved IA is:

```text
Admin Platform
└── OPERATIONS
    └── Documents
```

Do not:

- move Documents to Finance;
- create a new top-level Documents group;
- create a second Documents domain;
- create `UI-C19` solely for this feature.

---

# 4. FUNCTIONAL SCOPE

The implementation scope is frozen to:

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

Canonical route:

```text
/app/documents
```

Required document types:

```text
VOUCHER
PARTIAL_PAYMENT
REFUND
```

---

# 5. ACCESS / SECURITY CONTRACT

Do not redesign the already verified permission model.

```text
documents.read
→ ADMIN
→ DIRECTOR
→ FINANCE
→ ANALYST
→ SALES_MANAGER
→ OPERATOR

documents.write
→ ADMIN
→ OPERATOR

account.document.read_own
→ BUYER

PARTNER
→ denied
```

PII behavior remains:

```text
ADMIN / OPERATOR
→ full traveler PII

DIRECTOR / FINANCE / ANALYST / SALES_MANAGER / BUYER
→ redacted traveler PII
```

The feature must consume the existing backend authorization model.

No new permission model is authorized by this document.

---

# 6. REQUIRED UI BEHAVIOR

## 6.1 List

Must provide:

- pagination;
- filtering by document type;
- filtering by status;
- no traveler PII in list rows.

## 6.2 Detail

Must provide:

- document snapshot/details;
- role-correct PII presentation;
- status/history information;
- existing document facts only.

## 6.3 Download

Must use the existing signed-download mechanism.

Do not invent a second storage/download path.

## 6.4 Invalidate

Available only to:

```text
ADMIN
OPERATOR
```

Must require the existing reason/contract.

Invalidated documents must not be downloadable through the authorized flow.

## 6.5 Creation

```text
NO DOCUMENT CREATION UI
```

Documents continue to be created by the existing event-driven backend consumers.

---

# 7. FINANCE BOUNDARY

The Documents UI is an Operations UI.

It may display existing document/payment/refund facts exposed by the Documents API.

It must not become:

```text
General Ledger
Settlement
Payout accounting
Reconciliation engine
Tax accounting
Fiscal receipts
Invoice engine
PSP management
ProviderFee runtime
```

Finance Center remains a separate scope.

---

# 8. IMPLEMENTATION CONSTRAINTS

The implementation must:

1. consume the existing Documents backend;
2. preserve D13 API contracts;
3. preserve existing RBAC;
4. preserve existing PII rules;
5. avoid creation of a second document system;
6. avoid changing payment/finance authority;
7. avoid PSP/provider work;
8. avoid unrelated schema/domain redesign;
9. avoid reopening D13 or D14;
10. remain isolated from Phase 2 performance qualification.

---

# 9. ACCEPTANCE CRITERIA

`UI-DOC-ADMIN` can be proposed for closure only when all are true:

```text
[ ] /app/documents exists
[ ] Documents appears under Admin Platform → OPERATIONS
[ ] ADMIN can list documents
[ ] OPERATOR can list documents
[ ] Authorized roles can view permitted details
[ ] PII redaction is correct
[ ] BUYER remains isolated to /account/documents
[ ] PARTNER remains denied
[ ] Download uses signed URL flow
[ ] Invalidation works only for ADMIN/OPERATOR
[ ] Invalidated documents cannot be downloaded
[ ] Version/history is correctly represented
[ ] No new document backend was created
[ ] D13 API contracts remain unchanged
[ ] Existing D8-D13 behavior regresses cleanly
```

Required acceptance test set:

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

# 10. VERIFICATION / REVIEW SEQUENCE

Implementation is authorized, but closure still requires independent evidence.

Sequence:

```text
1. Repository/provenance baseline
2. Implement UI-DOC-ADMIN
3. Run targeted UI-DOC tests
4. Run frontend typecheck/build as applicable
5. Run affected backend/API regression
6. Run D8-D13 regression
7. Verify RBAC / PII behavior
8. Verify download/invalidation behavior
9. Artifact/evidence integrity check
10. Independent strict review
11. Fix any findings
12. Re-run affected regression
13. Persist closure evidence
14. Synchronize Master Roadmap
15. Update Debt Register status/closure
16. Commit
17. Push
18. Verify HEAD/upstream
19. Only then declare UI-DOC-ADMIN CLOSED
```

Implementation and strict review remain separate passes.

---

# 11. ROADMAP / DEBT SYNCHRONIZATION

The canonical roadmap must be updated so that the current state becomes:

```text
UI-DOC-ADMIN
Status: AUTHORIZED / IN IMPLEMENTATION
Track: C — Commerce UI / Presentation
Domain: Operations
Dependency: D13 CLOSED
Route: /app/documents
Target: Phase 3 C-track Operations UI continuation
```

The Debt Register entry must no longer describe the item as blocked by an unresolved target stage once this authorization is persisted.

It must not be incorrectly marked CLOSED before implementation and strict review finish.

---

# 12. WHAT THIS DECISION DOES NOT DO

This authorization does **not**:

- close Phase 2;
- close Step 2.17B;
- close Step 3.12;
- waive any performance qualification requirement;
- approve PSP/provider runtime;
- approve Finance Center;
- approve Storefront subscription work;
- reopen historical closed stages;
- create a new C-stage number;
- change the D13 document contract.

---

# 13. PARALLEL WORK POLICY

TravelHub may continue independent work in parallel with unresolved external/performance prerequisites.

Therefore:

```text
UI-DOC-ADMIN
        │
        ├── implementation now
        │
        └── independent strict review / closure

2.17B
        │
        └── separate qualification track when the required environment exists
```

One track must not be used as an artificial gate for the other.

---

# 14. NEXT EXECUTION COMMAND

The next implementation pass is:

```text
PHASE 3 — UI-DOC-ADMIN — IMPLEMENTATION
```

The implementation pass should begin from the current repository HEAD, verify the existing Documents API and Shell/IA state, and implement only the frozen scope in this authorization.

Do not begin another governance/placement pass.

Do not create another roadmap.

Do not wait for unrelated performance work.

---

# 15. TERMINAL GOVERNANCE DECISION

```text
UI-DOC-ADMIN
    = APPROVED
    = TARGET ASSIGNED
    = OWNERSHIP ASSIGNED
    = AUTHORIZED FOR IMPLEMENTATION

2.17B
    = INDEPENDENT PERFORMANCE TRACK

STEP 3.12
    = INDEPENDENT FINAL PHASE GATE

TRUE NEXT
    = UI-DOC-ADMIN IMPLEMENTATION
```

---

# 16. SOURCE BASIS

This authorization is based on the established project evidence that:

- Documents is an Operations-owned Admin Platform surface;
- the existing Documents backend/API is available;
- D13 is closed;
- the UI scope is list/detail/download/invalidate;
- the UI does not require Finance Center or PSP work;
- UI-DOC-ADMIN has no technical dependency on 2.17B, Phase 2 Exit, or STEP 3.12.

The project's earlier placement decision intentionally left target-stage selection open; this document is the explicit governance decision that resolves that remaining placement item without creating a new numbered UI stage.

---

# 17. FINAL STATUS

```text
STATUS: AUTHORIZED FOR IMPLEMENTATION

TRUE NEXT:
PHASE 3 — UI-DOC-ADMIN — IMPLEMENTATION
```

**STOP HERE.**

Do not perform implementation inside this governance document.
The next pass is the dedicated implementation pass named above.
