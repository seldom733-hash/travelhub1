# PHASE 3 — UI-DOC-ADMIN
# ADMIN / OPERATOR DOCUMENTS UI
## IA + RBAC + PII + ROADMAP PLACEMENT DECISION GATE — REPORT

**Date:** 2026-09-11
**Mode:** GOVERNANCE / IA / ACCESS-MATRIX / ROADMAP DECISION ONLY
**Production implementation:** FORBIDDEN
**Current status:** `UI-DOC-ADMIN = PLANNED / TARGET TBD`
**D13:** CLOSED
**D14:** CLOSED
**STEP 3.12:** BLOCKED by Phase 2 Exit / 2.17B

---

## 1. Mission

Resolve the canonical placement and access model for the already-registered:

```text
UI-DOC-ADMIN
Admin / Operator Documents UI
```

The previous qualification established a frontend gap for the Admin/Operator platform, but the D13 backend contract grants `documents.read` to more staff roles than ADMIN/OPERATOR.

**This report determines the complete role → visibility → PII → action model using the existing backend authorization contract.**

---

## 2. Baseline Git

```text
Branch:           master
HEAD:             a0ecb702752e2ec6198b0afd69f757af6f1aa9ef
Remote:           a0ecb702752e2ec6198b0afd69f757af6f1aa9ef (== HEAD, verified)
Working tree:     clean (only untracked: STEP 3.12 prompt file)
Production code:  UNCHANGED (governance only)
```

---

## 3. Existing UI-DOC-ADMIN State

```text
UI-DOC-ADMIN = PLANNED / TARGET TBD
D13 = CLOSED
D14 = CLOSED
STEP 3.12 = BLOCKED
Phase 2 Exit = BLOCKED / 2.17B
```

The debt was registered because the D13 backend API (`documents.read` / `documents.write`) has no corresponding Admin/Operator frontend surface. The Buyer UI (`/account/documents`) exists but is own-scope only.

---

## 4. Current Authorization Evidence

### 4.1 Permission Definitions

Source: `backend/src/security/permissions.constants.ts`

```text
"documents.read": "Чтение документов"         (line 229)
"documents.write": "Управление документами"   (line 230)
"account.document.read_own": "Чтение собственных документов (Buyer Cabinet, own-scope)" (line 188)
```

### 4.2 Role → Permission Grants

Source: `backend/src/security/permissions.constants.ts` ROLE_PERMISSIONS

| Role | `documents.read` | `documents.write` | `account.document.read_own` | Line |
|---|---|---|---|---|
| ADMIN | YES (ALL_PERMISSIONS) | YES (ALL_PERMISSIONS) | NO | 279 |
| DIRECTOR | YES | NO | NO | 309 |
| FINANCE | YES | NO | NO | 382 |
| ANALYST | YES | NO | NO | 462 |
| SALES_MANAGER | YES | NO | NO | 539 |
| OPERATOR | YES | YES | NO | 590–591 |
| BUYER | NO | NO | YES | 696 |
| PARTNER | NO | NO | NO | 610–672 (explicitly denied, lines 631–634) |

### 4.3 Controller Endpoints

Source: `backend/src/modules/documents/documents.controller.ts`

| Endpoint | Permission | Purpose |
|---|---|---|
| `GET /account/documents` | `account.document.read_own` | Buyer list (own-scope) |
| `GET /account/documents/:id/download` | `account.document.read_own` | Buyer download (own-scope) |
| `GET /documents` | `documents.read` | Admin/Staff list (all documents) |
| `GET /documents/:id` | `documents.read` | Admin/Staff detail (with PII redaction) |
| `GET /documents/:id/download` | `documents.read` | Admin/Staff download |
| `POST /documents/:id/invalidate` | `documents.write` | Admin/Operator invalidate |

### 4.4 Guard Stack

Source: `backend/src/security/auth/permissions.guard.ts`

```text
JwtAuthGuard (global) → PermissionsGuard (global) → @RequirePermissions() decorator
```

All endpoints are protected by the global guard stack. No endpoint bypasses authorization.

---

## 5. Role → Access Matrix

Derived from repository evidence (permissions.constants.ts + documents.controller.ts + pii.ts):

| Role | `documents.read` | List (all) | Detail | PII full | Download | Invalidate | Current UI |
|---|---|---|---|---|---|---|---|
| ADMIN | YES | YES | YES | YES | YES | YES | NONE |
| DIRECTOR | YES | YES | YES | REDACTED | YES | NO | NONE |
| FINANCE | YES | YES | YES | REDACTED | YES | NO | NONE |
| ANALYST | YES | YES | YES | REDACTED | YES | NO | NONE |
| SALES_MANAGER | YES | YES | YES | REDACTED | YES | NO | NONE |
| OPERATOR | YES | YES | YES | YES | YES | YES | NONE |
| BUYER | `account.document.read_own` | OWN only | OWN | REDACTED | OWN only | NO | `/account/documents` |
| PARTNER | NO | NO | NO | NO | NO | NO | NONE |

**Key finding:** The debt name "UI-DOC-ADMIN" is misleading. Six staff roles have `documents.read`, not just ADMIN/OPERATOR. The UI must support all six roles with appropriate PII visibility.

---

## 6. Document-Type Visibility

Source: `backend/src/modules/documents/documents.controller.ts` + `documents.service.ts`

The backend does NOT differentiate document types by role. All `documents.read` holders can see all document types:

| Role | VOUCHER | PARTIAL_PAYMENT | REFUND | Evidence |
|---|---|---|---|---|
| ADMIN | YES | YES | YES | `documents.read` — no type filter in controller |
| DIRECTOR | YES | YES | YES | `documents.read` — no type filter |
| FINANCE | YES | YES | YES | `documents.read` — no type filter |
| ANALYST | YES | YES | YES | `documents.read` — no type filter |
| SALES_MANAGER | YES | YES | YES | `documents.read` — no type filter |
| OPERATOR | YES | YES | YES | `documents.read` — no type filter |
| BUYER | YES (own) | YES (own) | YES (own) | `account.document.read_own` — no type filter |
| PARTNER | NO | NO | NO | No permission |

The `listAllDocuments` endpoint accepts optional `type` and `status` query parameters for filtering, but these are client-side convenience filters — the backend does not restrict which types a role can see.

---

## 7. PII / Field-Level Visibility

Source: `backend/src/shared/pii.ts`

### 7.1 Redacted Fields

```text
TRAVELER_PII_FIELDS = ["passportNumber", "passportExpiry", "birthDate"]
```

These are the ONLY fields redacted. Names (firstName/lastName), nationality, and gender remain visible for identification.

### 7.2 Who Sees Full PII?

```text
canViewTravelerPii(role): role === OPERATOR || role === ADMIN
```

Only OPERATOR and ADMIN see unredacted passport/birthDate data.

### 7.3 Redaction Scope

Source: `documents.controller.ts` line 62–70

Redaction is applied in the `getDocument` endpoint (detail view only):

```typescript
if (!canViewTravelerPii(user.role as any)) {
  if (doc.versions?.[0]?.snapshot) {
    const snapshot = doc.versions[0].snapshot as Record<string, unknown>;
    const travelers = snapshot.travelers as Array<Record<string, unknown>> | undefined;
    if (travelers) {
      (snapshot as any).travelers = travelers.map((t) => redactTravelerPii(t, { role: user.role as any }));
    }
  }
}
```

| Scope | Redacted? | Evidence |
|---|---|---|
| List endpoint (`GET /documents`) | NOT EXPLICITLY SEPARATED | List returns `DocumentListItem` without snapshot — no PII in list response |
| Detail endpoint (`GET /documents/:id`) | YES (for non-ADMIN/OPERATOR) | Controller applies `redactTravelerPii` to snapshot.travelers |
| Download endpoint (`GET /documents/:id/download`) | NOT EXPLICITLY SEPARATED | Returns signed URL redirect — PDF content not redacted at API level |
| PDF content | NOT EXPLICITLY SEPARATED | Renderer uses snapshot directly — no redaction pass in renderer |

**Gap identified:** The API-level redaction applies to the detail endpoint's JSON response, but the PDF download and list endpoint do not have explicitly documented redaction behavior. The list endpoint does not include snapshot data (so no PII exposure). The PDF content question is a gap — the renderer receives the snapshot as-is.

---

## 8. Download Authorization

Source: `backend/src/modules/documents/documents.controller.ts` + `documents.service.ts`

### 8.1 Staff Download (`GET /documents/:id/download`)

```text
Permission: documents.read
Authorization:JwtAuthGuard + PermissionsGuard + @RequirePermissions("documents.read")
Ownership check: NONE (staff can download any document)
Scope: ALL documents
```

### 8.2 Buyer Download (`GET /account/documents/:id/download`)

```text
Permission: account.document.read_own
Authorization:JwtAuthGuard + PermissionsGuard + @RequirePermissions("account.document.read_own")
Ownership check: YES — getDownloadUrl() verifies user.customerId === doc.customerId (line 250-254)
Scope: OWN documents only
```

### 8.3 Signed URL Generation

```text
getDownloadUrl(documentId, userId, userRole):
  1. Fetch document with ISSUED versions
  2. Status check: INVALIDATED → ConflictError; NOT_ISSUED → ConflictError
  3. Ownership check: if BUYER, verify customerId match
  4. Generate signed URL (5 min TTL)
```

The signed URL generation repeats authorization (ownership check for BUYER). Staff roles pass through without ownership check.

### 8.4 Summary

| Role | Can download? | Scope | Ownership check |
|---|---|---|---|
| ADMIN | YES | ALL | NO |
| DIRECTOR | YES | ALL | NO |
| FINANCE | YES | ALL | NO |
| ANALYST | YES | ALL | NO |
| SALES_MANAGER | YES | ALL | NO |
| OPERATOR | YES | ALL | NO |
| BUYER | YES | OWN only | YES (customerId match) |
| PARTNER | NO | — | — |

---

## 9. Invalidation Authorization

Source: `backend/src/modules/documents/documents.controller.ts` line 85–94

```text
Endpoint: POST /documents/:id/invalidate
Permission: documents.write
Authorization:JwtAuthGuard + PermissionsGuard + @RequirePermissions("documents.write")
```

| Role | Can invalidate? | Permission |
|---|---|---|
| ADMIN | YES | documents.write (via ALL_PERMISSIONS) |
| OPERATOR | YES | documents.write (explicit grant, line 591) |
| DIRECTOR | NO | No documents.write |
| FINANCE | NO | No documents.write |
| ANALYST | NO | No documents.write |
| SALES_MANAGER | NO | No documents.write |
| BUYER | NO | No documents.write |
| PARTNER | NO | No documents.write |

Invalidation is ADMIN + OPERATOR only. This is a restricted action.

---

## 10. Admin IA Audit

Source: `frontend/components/Shell.tsx` lines 36–86

Current Admin sidebar navigation:

```text
NAV_GROUPS:
  (top-level)
    Dashboard          /app/dashboard
    Command Center     /app/command-center     (analytics.read)
    Analytics          /app/analytics          (analytics.read)
  
  OPERATIONS
    Requests           /app/requests           (order.read)
    Orders             /app/orders             (order.read)
    Bookings           /app/bookings           (booking.read)
  
  FINANCE
    Payments           /app/payments           (finance.payment.read)
  
  COMMERCIAL
    Catalog            /app/catalog            (catalog.product.read)
    CRM                /app/crm                (crm.customer.read)
    Marketing          /app/marketing          (marketing.campaign.read)
  
  PARTNER NETWORK
    Partner Onboarding /app/partners/onboarding (partner.onboarding.review)
    Seller Profiles    /app/seller-profiles    (seller_public_profile.review)
  
  SERVICE
    Support            /app/support            (support.case.read)
    Help               /app/help
  
  ADMIN
    Users              /app/users              (settings.write)
```

**No Documents entry exists in any group.**

### Candidate Placement Analysis

| Candidate | IA evidence | Domain fit | RBAC fit | Workflow fit | Risk | Verdict |
|---|---|---|---|---|---|---|
| OPERATIONS group | Documents are operational artifacts (Voucher/PPD/Refund created during order lifecycle) | HIGH — documents are lifecycle outputs | GOOD — OPERATOR has full access; other ops roles have read | GOOD — documents relate to orders/bookings workflow | LOW — natural grouping | **PREFERRED** |
| FINANCE group | Documents contain payment/refund facts | MEDIUM — documents are not finance domain | POOR — FINANCE has read-only, no write | POOR — invalidation is operational, not financial | MEDIUM — misleading ownership | REJECTED |
| New top-level DOCUMENTS group | No existing group fits perfectly | LOW — documents are cross-cutting | GOOD — all roles have appropriate access | NEUTRAL — standalone group | HIGH — new group requires governance approval | REJECTED |
| SERVICE group | Documents could be "support artifacts" | LOW — documents are not support cases | POOR — support roles don't align | POOR — workflow mismatch | MEDIUM — misleading | REJECTED |

**Decision: OPERATIONS group.**

Rationale:
- Documents are lifecycle outputs of the commerce flow (Order → Booking → Document)
- OPERATOR is the primary operational role with full access (read + write + invalidate)
- The OPERATIONS group already contains Orders and Bookings — Documents are a natural extension
- No new top-level group required (avoids governance overhead)
- Finance boundary preserved (Finance has read-only access, not ownership)

---

## 11. Domain Ownership

### 11.1 Current Architecture

Documents are a **cross-cutting concern** owned by the `DocumentsModule` (`backend/src/modules/documents/`):

```text
DocumentsModule:
  - DocumentsService (CRUD + lifecycle)
  - DocumentsController (API endpoints)
  - DocumentRenderer (PDF generation)
  - VoucherConsumer (event-driven creation)
  - RefundDocumentConsumer (event-driven creation)
  - InvalidationConsumer (event-driven invalidation)
```

The module consumes events from multiple domains (Orders, Bookings, Finance) but is not owned by any of them.

### 11.2 Recommended Ownership

```text
Domain: Operations (Admin Platform)
Owner: Operations team / ADMIN role
What it owns: Document list, detail, download, invalidation UI
What it does NOT own: Document creation (event-driven), Finance reconciliation, PSP integration
```

The Operations domain owns the UI surface because:
- OPERATOR is the primary operational user with full access
- Documents are operational artifacts in the order/booking lifecycle
- The UI consumes the existing Documents backend — no new domain needed

---

## 12. Future UI Scope

Frozen as:

```text
Admin Platform
  └── OPERATIONS group
       └── Documents
            ├── Document List (filterable by type/status)
            ├── Document Detail (with PII redaction per role)
            ├── Download (signed URL)
            └── Invalidate (ADMIN/OPERATOR only)
```

### Required Document Types

```text
VOUCHER          — travel voucher (Booking confirmation)
PARTIAL_PAYMENT  — partial payment document (payment state)
REFUND           — refund document (refund processing)
```

### UI Behavior Rules

1. **List view:** Shows all documents (paginated, filterable by type/status). No PII in list.
2. **Detail view:** Shows full document with snapshot. Traveler PII redacted for non-ADMIN/OPERATOR roles.
3. **Download:** Generates signed URL (5 min TTL). Available for all `documents.read` holders.
4. **Invalidate:** Button visible only for `documents.write` holders (ADMIN/OPERATOR). Requires reason.
5. **No creation UI:** Documents are created by event consumers, not manually.

---

## 13. Finance Boundary

Explicitly preserved:

```text
Admin Documents UI ≠ Finance Center
```

The future UI may present:
- Existing payment/refund facts already exposed by the Documents API
- Document status (ISSUED, INVALIDATED, SUPERSEDED)
- Payment status field on documents

The future UI must NOT become:
- Ledger management
- Settlement processing
- Payout accounting
- Reconciliation engine
- Tax accounting
- Fiscal receipt system
- Invoice engine
- PSP management

Finance Center remains a separate, deferred feature.

---

## 14. Phase 2 / 2.17B Relationship

```text
UI-DOC-ADMIN does NOT depend on 2.17B, Phase 2 Exit, or STEP 3.12.
```

The UI may be planned and designed while those are blocked. Planning does not authorize implementation.

```text
2.17B = BLOCKED / DEFERRED
Phase 2 Exit = BLOCKED
STEP 3.12 = BLOCKED
UI-DOC-ADMIN = PLANNED / TARGET TBD (independent of above)
```

---

## 15. Roadmap Placement

### Current State

```text
UI-DOC-ADMIN = PLANNED / TARGET TBD
```

### Placement Options

| Option | Description | Verdict |
|---|---|---|
| A — Attach to existing future stage | No suitable existing stage found | REJECTED |
| B — Attach to post-Phase-3 stage | Phase 3 is complete; UI-DOC-ADMIN is Phase 3 debt | REJECTED |
| C — New UI stage | Requires governance approval; premature | REJECTED |
| D — Named future debt with scheduled target | Target not determinable yet (need IA decision) | POSSIBLE |
| E — Target still not determinable | Current state | **SELECTED** |

### Decision

```text
PLANNED — TARGET STAGE STILL NOT DETERMINED
```

**Rationale:**
- The IA location is now confirmed (OPERATIONS group)
- The domain owner is now confirmed (Operations)
- The access matrix is now fully documented
- However, the target implementation stage cannot be determined until:
  1. The governance decision on whether to create a new stage or attach to an existing one
  2. The Phase 2 exit resolution (which may affect staging priorities)
  3. Product ownership assignment

The placement is **evidence-backed but not yet scheduled**. The debt remains in the register with updated metadata.

---

## 16. Required Decisions

### A. Who can see documents now?

**Six staff roles:** ADMIN, DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, OPERATOR (via `documents.read`). Plus BUYER (own-scope via `account.document.read_own`).

### B. What does "see" mean?

| Action | Permission | Roles |
|---|---|---|
| List (all documents) | `documents.read` | ADMIN, DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, OPERATOR |
| List (own documents) | `account.document.read_own` | BUYER |
| Detail (with PII redaction) | `documents.read` | ADMIN, DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, OPERATOR |
| Detail (own, with PII) | `account.document.read_own` | BUYER |
| Download | `documents.read` / `account.document.read_own` | All above |
| Invalidate | `documents.write` | ADMIN, OPERATOR only |

### C. What PII can each role see?

| Role | Traveler PII (passport, birthDate) | Evidence |
|---|---|---|
| ADMIN | FULL | `canViewTravelerPii` returns true |
| OPERATOR | FULL | `canViewTravelerPii` returns true |
| DIRECTOR | REDACTED (→ null) | `redactTravelerPii` applied |
| FINANCE | REDACTED (→ null) | `redactTravelerPii` applied |
| ANALYST | REDACTED (→ null) | `redactTravelerPii` applied |
| SALES_MANAGER | REDACTED (→ null) | `redactTravelerPii` applied |
| BUYER | REDACTED (→ null) | `redactTravelerPii` applied (own-scope) |

### D. Does the UI need to support all `documents.read` staff roles?

**YES.** The backend grants `documents.read` to six roles. The UI must respect this contract. The debt name "UI-DOC-ADMIN" is historical — the actual access matrix is broader.

### E. What is the approved IA location?

**OPERATIONS group** in the Admin sidebar. Documents are lifecycle outputs of the order/booking workflow.

### F. Who owns the feature?

**Operations domain / ADMIN role.** The UI consumes the existing Documents backend. No new domain needed.

### G. When will it be implemented?

**TARGET TBD.** The placement is confirmed but the implementation stage is not yet scheduled.

---

## 17. Canonical Updates

### Debt Register Update

```text
ID: UI-DOC-ADMIN
Name: Admin / Operator Documents UI
Status: PLANNED
Planned closure stage: TBD (confirmed IA, confirmed owner, target pending)
Access scope: documents.read (6 staff roles) + documents.write (ADMIN/OPERATOR) + account.document.read_own (BUYER)
IA location: OPERATIONS group in Admin sidebar
Domain owner: Operations
PII model: ADMIN/OPERATOR = full; all other roles = redacted (passportNumber, passportExpiry, birthDate → null)
Invalidation: ADMIN/OPERATOR only (documents.write)
Document types: VOUCHER, PARTIAL_PAYMENT, REFUND (all visible to all authorized roles)
Finance boundary: UI ≠ Finance Center
```

### Master Roadmap

No update — target stage not yet established.

### D13/D14 Status

UNCHANGED — D13 and D14 remain CLOSED.

---

## 18. Final Governance Verdict

```text
PLANNED — TARGET STAGE STILL NOT DETERMINED
```

**What is confirmed:**
- Full staff role matrix (6 roles with `documents.read`)
- Buyer own-scope access
- Partner denial
- PII redaction model (ADMIN/OPERATOR = full; others = redacted)
- Download authorization (staff = all; buyer = own)
- Invalidation authorization (ADMIN/OPERATOR only)
- IA location (OPERATIONS group)
- Domain owner (Operations)
- Document types (all visible to all authorized roles)
- Finance boundary preserved

**What is NOT confirmed:**
- Target implementation stage (TBD)
- Product ownership assignment
- Governance decision on stage creation

---

## 19. Mandatory Safety Statement

```text
Production code changed: NO
Backend changed: NO
Schema changed: NO
Permissions changed: NO
D13 reopened: NO
D14 reopened: NO
STEP 3.12 unblocked: NO
Finance implemented: NO
2.17B changed: NO
```

---

## 20. Success Criteria

- [x] Full staff role matrix verified
- [x] Buyer access verified
- [x] Partner denial verified
- [x] Document types assessed
- [x] PII policy traced to implementation
- [x] Download authorization verified
- [x] Invalidation authorization verified
- [x] Admin IA audited
- [x] Finance boundary preserved
- [x] Domain owner identified (Operations)
- [x] Roadmap target identified as TBD (proven)
- [x] UI scope frozen
- [x] Debt Register updated with confirmed metadata
- [x] Master Roadmap NOT updated (target TBD)
- [x] No production implementation
- [x] Report created
