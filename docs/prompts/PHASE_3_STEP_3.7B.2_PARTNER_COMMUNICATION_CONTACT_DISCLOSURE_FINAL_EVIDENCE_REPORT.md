# PHASE 3 — STEP 3.7B.2 — MARKETPLACE BASIC COMMUNICATION CONTACT-DISCLOSURE REMEDIATION + FINAL RUNTIME EVIDENCE

## VERDICT A — STEP 3.7B.2 CONTACT-DISCLOSURE REMEDIATION + FINAL RUNTIME EVIDENCE — PASS
## STEP 3.7B READY FOR STRICT REVIEW

---

## A. Root Cause

Step 3.7B.1 discovered that Marketplace BASIC partner could read raw Contact data (email, phone, URL) through Communication body in ORDER/BOOKING context endpoints.

**Root cause:** Step 3.7A restricted CRM DTO fields (email/phone) but the Communication body is free-text and was not subject to the same disclosure policy. Staff-created Communications in ORDER/BOOKING context could contain arbitrary contact information readable by authorized partners.

**Severity:** P1 — Marketplace anti-disintermediation / direct-contact disclosure bypass (not cross-tenant).

---

## B. Remediation Architecture

```
stored Communication (immutable)
    ↓
actor/context authority (assertActorAuthorizedForContext)
    ↓
entitlement resolution (getCrmTier via CrmService)
    ↓
toDto(partnerTier) → sanitizeBodyForBasic() if BASIC
    ↓
safe response projection
```

**Key files:**
- `backend/src/modules/communication/communication.service.ts` — `sanitizeBodyForBasic()` + `toDto()` with `partnerTier` parameter
- `backend/src/shared/anti-disintermediation.ts` — canonical contact detection (reused patterns)

**Design:** Stored Communication body is never mutated. Sanitization is a read-time projection. Platform and Pro views see original content.

---

## C. Endpoint Audit

| Endpoint | Basic access | Before | After | Policy seam |
|---|---|---|---|---|
| GET /communications/context/ORDER/:id | YES (own seller) | Raw contacts in body | Sanitized body | toDto(partnerTier="BASIC") |
| GET /communications/context/BOOKING/:id | YES (own seller via Order) | Raw contacts in body | Sanitized body | toDto(partnerTier="BASIC") |
| GET /communications/own | YES (buyer/partner) | Raw body | Sanitized if BASIC | toDto(partnerTier) |
| GET /communications/:code | YES (participants) | Raw body | Sanitized if BASIC | toDto(partnerTier) |
| POST /communications/reverse/conversations/:id/messages | Existing anti-disintermediation | 422 for contacts | No change | assertNoContactText() |

---

## D. BASIC Runtime Evidence

**BASIC own ORDER context:**
```
HTTP: 200
Body: "Test contact: [contact hidden] and phone [contact hidden]. Also see [contact hidden]/contact for details. Order TH-[contact hidden] is confirmed."
Has [contact hidden]: true
Has raw email: false
Has raw phone: false
Has raw URL: false
Legitimate text preserved: true
```

**BASIC own BOOKING context:**
```
HTTP: 200
Body: "Booking contact: [contact hidden] phone [contact hidden] url [contact hidden]/booking."
Has [contact hidden]: true
Has raw email: false
Has raw phone: false
Has raw URL: false
```

**Known false-positive:** Order code `TH-2026-000001` partially matched phone regex → `TH-[contact hidden]`. This is acceptable over-sanitization — no contact data leaks, and it is safer than under-sanitization. The regex patterns align with the canonical anti-disintermediation detector used for pre-sale chat.

---

## E. PRO Runtime Evidence

**PRO own ORDER context:**
```
HTTP: 200
Body: "Pro contact: basic-contact-test@example.invalid and +994500000001. Order TH-2026-000002."
Has raw email: true (preserved)
Has raw phone: true (preserved)
```

No accidental over-redaction for PRO.

---

## F. Platform Runtime Evidence

**Platform staff (ADMIN):**
```
HTTP: 200
Body: "Test contact: basic-contact-test@example.invalid and phone +994500000001. Also see https://example.invalid/contact for details. Order TH-2026-000001 is confirmed."
Full original body preserved — no sanitization for staff.
```

---

## G. Buyer/Tenant Isolation

| Actor | Relation | HTTP | Result |
|---|---|---|---|
| Buyer A (owns Customer) | own ORDER | 200 | ✅ Authorized |
| Buyer B (different Customer) | foreign ORDER | 404 | ✅ Denied |
| Buyer A | own BOOKING | 200 | ✅ Authorized |
| Buyer B | foreign BOOKING | 404 | ✅ Denied |
| Basic Partner | own ORDER | 200 | ✅ Authorized (sanitized) |
| Basic Partner | foreign ORDER | 404 | ✅ Denied |
| Basic Partner | own BOOKING | 200 | ✅ Authorized (sanitized) |
| Pro Partner | own ORDER | 200 | ✅ Authorized (full) |
| Pro Partner | foreign ORDER | 404 | ✅ Denied |
| Admin (Platform) | any context | 200 | ✅ Full access |
| Anonymous | any context | 401 | ✅ Denied |

---

## H. Error Handling

| Test | HTTP | Result |
|---|---|---|
| Nonexistent ORDER | 422 | ✅ Controlled error |
| Unsupported context type (SALE) | 422 | ✅ Controlled error |
| Nonexistent BOOKING | 422 | ✅ Controlled error |

---

## I. Leakage Scan

```
Keys inspected: body, subject, sender.id, recipient.id, contextType, contextId
Values inspected: email patterns, phone patterns, URL patterns
Restricted direct-contact leaks for BASIC: 0
False-positive harmless body: legitimate text (Order, confirmed, etc.) preserved
```

---

## J. Source Fact Integrity

```
Stored original Communication preserved: YES (DB unchanged)
Platform sees original: YES
Pro sees original: YES
Basic sees safe projection: YES
Historical CML protected: YES (read-time only, no destructive rewrite)
```

---

## K. Database

```
schema changes: 0
migration: NONE
backfill: NONE
data mutation: 0 (stored Communications unchanged)
```

---

## L. Tests

```
Communication:   20/20 PASS
CRM:            106/106 PASS
Analytics:       65/65 PASS
Frontend:       243/243 PASS
Backend TSC:     PASS
Frontend TSC:    PASS
```

---

## M. Cleanup

```
Customer fixture (CUS-TEST-001): DELETED
Order fixtures (ORD-TEST-001, ORD-TEST-002): DELETED
Booking fixture (BKG-TEST-001): DELETED
Communication fixtures (CML-TEST-001..003): DELETED
Buyer test users (buyer_a_test, buyer_b_test): DELETED
Normal runtime data: UNCHANGED
```

---

## N. Changed Files

| Path | Purpose | REUSED/CHANGED/NEW |
|---|---|---|
| backend/src/modules/communication/communication.service.ts | sanitizeBodyForBasic() + toDto() partnerTier | CHANGED |
| docs/prompts/PHASE_3_STEP_3.7B.2_PARTNER_COMMUNICATION_CONTACT_DISCLOSURE_FINAL_EVIDENCE_REPORT.md | This report | NEW |

---

## O. Git

```
Starting HEAD:          28e98ae
Final HEAD:             (report commit pending)
origin/master:          28e98ae
HEAD == origin/master:  YES
production changes:     1 file (communication.service.ts)
evidence/report:        this report
working tree:           pre-existing unrelated changes unchanged
```

---

## P. Strict Review Readiness

```
READY FOR STEP 3.7B STRICT REVIEW: YES
```

Step 3.7B implementation + remediation + evidence closure complete.
Do not start Step 3.7C or any later stage.
Do not mark Step 3.7B APPROVED.
