# PHASE 3 — D13 — ADMIN DOCUMENTS UI QUALIFICATION

**Date:** 2026-09-11
**Mode:** AUDIT / QUALIFICATION ONLY — NO PRODUCTION CODE CHANGES
**Git:** `606ee9a698787a3688d8002bfa6e5728a9c3ff54`

---

## 1. Executive Verdict

**C — DOCUMENTED DEBT**

The Admin/Operator Documents frontend UI is useful and expected but was **never explicitly required as MUST** by any approved D13 architecture decision, implementation prompt, or closure gate. The backend API is complete, RBAC is wired, and the Buyer Cabinet page is functional. The missing Admin/Operator frontend surface is a known scope boundary — not a D13 defect.

---

## 2. Repository Evidence

### 2.1 Frontend — Admin/Operator Documents UI

| Item | Finding | Evidence |
|------|---------|----------|
| Admin Documents page | **NOT FOUND** | `frontend/app/app/documents/` directory does not exist |
| Documents in admin sidebar | **NOT FOUND** | `frontend/components/Shell.tsx` lines 36-86: 7 nav groups, 15 items — no "Documents" entry |
| Admin document API calls | **NOT FOUND** | Zero references to `/api/v1/documents` in `frontend/` (only `/api/v1/account/documents`) |
| Admin document components | **NOT FOUND** | No `DocumentList`, `DocumentDetail`, or admin document components |
| `documents.read` in frontend | **NOT FOUND** | No permission string references in frontend code |
| `documents.write` in frontend | **NOT FOUND** | Same |

### 2.2 Frontend — Buyer Documents UI (EXISTS)

| Item | Finding | Evidence |
|------|---------|----------|
| Buyer page | **EXISTS** | `frontend/app/account/documents/page.tsx` line 31 |
| Buyer nav link | **EXISTS** | `frontend/app/account/layout.tsx` line 63 |
| Buyer API client | **EXISTS** | `frontend/lib/account-api.ts` lines 186-191 (`/account/documents`) |
| Role gate | **EXISTS** | `frontend/app/account/layout.tsx` line 42: `if (user.role !== "BUYER")` |

### 2.3 Admin Navigation Architecture

Current sidebar (`Shell.tsx` lines 36-86):

| Group | Items |
|-------|-------|
| *(none)* | Dashboard, Command Center, Analytics |
| OPERATIONS | Requests, Orders, Bookings |
| FINANCE | Payments |
| COMMERCIAL | Catalog, CRM, Marketing |
| PARTNER NETWORK | Partner Onboarding, Seller Profiles |
| SERVICE | Support, Help |
| ADMINISTRATION | Users |

**No "Documents" group or item exists.** No route `/app/documents` is reserved.

### 2.4 Backend API (COMPLETE)

| Endpoint | Permission | Controller | Status |
|----------|-----------|------------|--------|
| `GET /account/documents` | `account.document.read_own` | DocumentsController:20, AccountController:113 | Implemented |
| `GET /account/documents/:id/download` | `account.document.read_own` | DocumentsController:31 | Implemented |
| `GET /documents` | `documents.read` | DocumentsController:42 | Implemented |
| `GET /documents/:id` | `documents.read` | DocumentsController:55 | Implemented |
| `GET /documents/:id/download` | `documents.read` | DocumentsController:74 | Implemented |
| `POST /documents/:id/invalidate` | `documents.write` | DocumentsController:85 | Implemented |

### 2.5 RBAC Matrix

| Permission | ADMIN | DIRECTOR | FINANCE | ANALYST | SALES_MGR | OPERATOR | BUYER |
|------------|-------|----------|---------|---------|-----------|----------|-------|
| `documents.read` | Y | Y | Y | Y | Y | Y | — |
| `documents.write` | Y | — | — | — | — | Y | — |
| `account.document.read_own` | — | — | — | — | — | — | Y |

Source: `backend/src/security/permissions.constants.ts` lines 229-230, 279, 309, 382, 462, 539, 590-591, 696.

---

## 3. Contract Comparison

### 3.1 Architecture Decisions (AD-D13-01 through AD-D13-21)

**Source:** `docs/reports/evidence/PHASE_3_D13_VOUCHER_ARCHITECTURE_DECISION_READINESS.md`

All 20 AD decisions address backend domain only (data model, lifecycle, events, storage, rendering, access control, PII). **None explicitly mandate Admin/Operator frontend UI.** AD-D13-15 (Access Control) defines RBAC at the API level only.

Classification per AD: **NOT DEFINED**

### 3.2 Final Implementation Prompt

**Source:** `docs/prompts/PHASE_3_D13_VOUCHER_FINAL_IMPLEMENTATION_PROMPT.md`

| Section | Text | Classification |
|---------|------|---------------|
| §18 API (line 578) | "authorized administrative/operator document access" | **MUST** — implemented |
| §18 API (line 579) | "authorized document download" | **MUST** — implemented |
| §19 Frontend (line 598) | "Replace the existing /account/documents placeholder with a functional document surface" | **MUST** — implemented (Buyer page) |
| §19 Frontend (line 613) | "Admin/operator document views must honor PII policy" | **SHOULD** — ambiguous; could mean API-level PII projection (implemented) or UI surface (not implemented) |

### 3.3 Remediation Prompt

**Source:** `docs/prompts/PHASE_3_D13_VOUCHER_IMPLEMENTATION_REMEDIATION.md`

§11 (lines 256-269) references **only** `/account/documents`. No mention of Admin/Operator UI.

Classification: **NOT DEFINED** for Admin/Operator UI

### 3.4 Closure Report

**Source:** `docs/reports/evidence/PHASE_3_D13_VOUCHER_IMPLEMENTATION_REPORT.md`

| Claimed Scope | Implementation |
|---------------|----------------|
| API: `Admin/Operator CRUD, download (302 redirect)` (line 46) | Implemented |
| Frontend: `/account/documents functional document list` (line 47) | Implemented |

**The closure report does NOT claim Admin/Operator frontend UI exists.** It only claims Buyer frontend and Admin/Operator backend API.

### 3.5 Scope Audit

**Source:** `docs/prompts/PHASE_3_D13_VOUCHER_SCOPE_AUDIT.md`

§23 (line 677) lists "staff UI" as a delivery channel candidate but states: "do not assume D13 must implement delivery channels" (line 683).

Classification: **OPTIONAL**

---

## 4. Admin / Operator UX Assessment

### What a platform ADMIN can actually do TODAY

| Action | Possible? | How |
|--------|-----------|-----|
| View document list | YES — via API | `GET /api/v1/documents` (requires `documents.read`) |
| View document detail | YES — via API | `GET /api/v1/documents/:id` (with PII redaction) |
| Download document | YES — via API | `GET /api/v1/documents/:id/download` (302 redirect) |
| Invalidate document | YES — via API | `POST /api/v1/documents/:id/invalidate` (requires `documents.write`) |
| Navigate to Documents in UI | **NO** | No sidebar entry, no page, no route |

### What a platform OPERATOR can actually do TODAY

Same as ADMIN for API access. UI access: **NO**.

### What a BUYER can do TODAY

| Action | Possible? | How |
|--------|-----------|-----|
| View own documents | YES | `/account/documents` page |
| Download own document | YES | Download link on document list |
| Navigate to Documents | YES | Sidebar in Buyer Cabinet |

**The Admin/Operator has full backend API access but no frontend surface to use it.** They would need to use API tools (curl, Postman) or a future Admin UI.

---

## 5. Security Assessment

| Check | Status | Evidence |
|-------|--------|----------|
| `documents.read` enforced on admin endpoints | OK | `DocumentsController` lines 42-43, 55-56, 74-75 |
| `documents.write` enforced on invalidate | OK | `DocumentsController` line 85-86 |
| PII redaction on admin detail view | OK | `DocumentsController` lines 62-68 via `canViewTravelerPii()` |
| Buyer own-scope enforcement | OK | `DocumentsService` line 252 scopes by `actor.customerId` |
| PARTNER denial | OK | `documents.read` not assigned to PARTNER (permissions.constants.ts line 631) |
| No frontend permission bypass | OK | No admin document UI exists to bypass anything |
| Duplicate endpoint concern | LOW RISK | `GET /account/documents` in both DocumentsController:20 and AccountController:113; AccountController adds role gate (`assertBuyerActor`), DocumentsController does not. Currently no non-BUYER has `account.document.read_own`, so no exploit path. |

**Backend security is intact.** The absence of Admin UI means there is no UI-based attack surface for document access.

---

## 6. Scope Decision

**D13 remains CLOSED.**

Rationale:

1. **No AD mandates Admin/Operator frontend UI.** All 20 architecture decisions address backend domain.
2. **The implementation prompt is ambiguous.** §19 line 613 ("Admin/operator document views must honor PII policy") is the strongest hint, but "views" can mean API-level views (implemented with PII redaction), not necessarily a UI page.
3. **The closure report explicitly scopes frontend to Buyer only.** Line 47: "Frontend | /account/documents functional document list."
4. **The remediation prompt references only `/account/documents`.** No remediation step mentions Admin UI.
5. **The backend API is complete and secure.** Admin/Operator have full `documents.read` + `documents.write` access via API.
6. **The Buyer Cabinet page is functional.** The D13 contract's primary frontend deliverable is met.

---

## 7. Recommendation

### Classification: C — DOCUMENTED DEBT

The Admin/Operator Documents UI is a **documented scope boundary**, not a D13 defect.

### What exists

- Backend API: complete (6 endpoints, RBAC enforced, PII redaction working)
- Buyer UI: complete (`/account/documents` page with list, download, status display)
- RBAC: `documents.read` assigned to ADMIN/DIRECTOR/FINANCE/ANALYST/SALES_MANAGER/OPERATOR; `documents.write` to ADMIN/OPERATOR

### What is missing (and why it is debt, not a gap)

- No `/app/documents` page in Admin platform
- No "Documents" entry in admin sidebar navigation
- No frontend code calling admin document API endpoints

### Why D13 remains closed

The D13 contract's core deliverables were:
1. Document data model ✅
2. Voucher lifecycle (ISSUED → INVALIDATED) ✅
3. Partial Payment Document ✅
4. Refund Document ✅
5. Real PDF generation ✅
6. Buyer Cabinet document surface ✅
7. Admin/Operator backend API ✅
8. RBAC + PII controls ✅

The Admin/Operator frontend surface was **not a closing condition** in any approved prompt or gate.

### If Admin UI is desired later

Minimum scope for a future Admin Documents UI:
- New page: `frontend/app/app/documents/page.tsx`
- Sidebar entry in `Shell.tsx` under OPERATIONS or FINANCE group
- API client calling `/api/v1/documents` (admin endpoint)
- Document list with type, status, date, booking reference
- Document detail view with PII redaction respect
- Download action via `/api/v1/documents/:id/download`
- Invalidate action for ADMIN/OPERATOR roles

This should be tracked as a **separate debt item or feature request**, not as a D13 re-open.

---

## 8. Git State

```
SHA:    606ee9a698787a3688d8002bfa6e5728a9c3ff54
Status: Clean (no production code changes made)
```
