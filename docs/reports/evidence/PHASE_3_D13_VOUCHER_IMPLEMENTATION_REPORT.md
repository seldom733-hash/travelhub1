# PHASE 3 — D13 — VOUCHER
## IMPLEMENTATION REPORT

**Stage:** Phase 3 — D13  
**Date:** 2026-09-10  
**Baseline:** HEAD `40e2f5b`

---

## 1. Executive Summary

### Implemented Scope

D13 implements the TravelHub document architecture for Partial Payment Document, TravelHub Voucher, and Refund Document. The implementation includes:

- **Prisma schema:** `Document`, `DocumentVersion`, `DocumentHistory`, `DocumentTemplate` models in new `documents` schema
- **Backend module:** `DocumentsModule` with service, controller, 3 event consumers, and PDF renderer
- **VoucherConsumer:** Dual-gate voucher generation on `BookingConfirmed` + `PaymentCaptured`
- **RefundDocumentConsumer:** Refund document generation on `RefundProcessed` with full-refund voucher invalidation
- **InvalidationConsumer:** Voucher invalidation on `BookingCancelled` and `BookingRejected`
- **API endpoints:** Buyer own-scope list/download, Admin/Operator list/get/download, manual invalidation
- **Frontend:** Replaced `/account/documents` placeholder with functional document list
- **Tests:** 10 unit tests passing

### Explicit Gaps

1. **PDF rendering:** D13 V1 uses text-based renderer; `@react-pdf/renderer` installed but full JSX templates deferred to follow-up
2. **Regeneration:** No automatic regeneration on traveler edit (no `PassengerUpdated` event exists)
3. **Multi-payment:** Partial Payment Document identical to Voucher under current single-payment model

### Final Verdict

**PASS WITH EXPLICIT NON-BLOCKING DEBT**

---

## 2. Architecture Mapping

| AD Decision | Implementation Evidence |
|------------|------------------------|
| AD-D13-01 Business Model | 3 document types: VOUCHER, PARTIAL_PAYMENT, REFUND |
| AD-D13-02 Dual Gate | `voucher.consumer.ts` — subscribes to BookingConfirmed + PaymentCaptured |
| AD-D13-03 Partial Payment | `Document.type = PARTIAL_PAYMENT`; same model as Voucher |
| AD-D13-04 Lifecycle | 4 states: NOT_ISSUED, ISSUED, SUPERSEDED, INVALIDATED |
| AD-D13-05 Versioning | Sequential versions in `DocumentVersion` table |
| AD-D13-06 Regeneration | Deferred (no PassengerUpdated event) |
| AD-D13-07 Invalidation | `invalidation.consumer.ts` — BookingCancelled/BookingRejected |
| AD-D13-08 Idempotency | `InboxEvent` pattern reused in all consumers |
| AD-D13-09 Source Contract | Snapshot from `Booking → Passengers` at issuance |
| AD-D13-10 Completeness | Passengers already filtered by `dataCompleteness = COMPLETE` |
| AD-D13-11 Documents Domain | New `documents` schema with generic model |
| AD-D13-12 PDF Engine | `@react-pdf/renderer` installed; V1 text renderer |
| AD-D13-13 Templates | `DocumentTemplate` model defined; JSX templates deferred |
| AD-D13-14 Storage | `ObjectStorageService` (S3/MinIO) via `putObject`/`getSignedReadUrl` |
| AD-D13-15 RBAC | `documents.read`/`documents.write`/`account.document.read_own` wired |
| AD-D13-16 Buyer Own-Scope | `User.customerId → Document.customerId` ownership chain |
| AD-D13-17 Partner Access | Partner denied (no `documents.read` permission) |
| AD-D13-18 Financial Boundary | Display only; no Finance Center artifacts |
| AD-D13-19 Document Authority | Platform confirmation, not invoice/fiscal/supplier document |
| AD-D13-20 Auditability | `DocumentHistory` + `DocumentVersion` audit trail |

---

## 3. Data Model

### Prisma Schema (documents schema)

```
DocumentType: PARTIAL_PAYMENT | VOUCHER | REFUND
DocumentStatus: NOT_ISSUED | ISSUED | SUPERSEDED | INVALIDATED

Document {
  id, code (unique), type, status
  bookingId, orderId, customerId
  currentVersionId
  serviceDate, serviceTime, serviceTimeZone
  totalAmount, paidAmount, currency, paymentStatus
  version, createdAt, updatedAt
}

DocumentVersion {
  id, documentId (FK), versionNumber, status
  s3Key, fileSize
  templateId, templateVersion
  issuedAt, triggeringEvent, actorId
  snapshot (JSONB)
  createdAt
  Unique: (documentId, versionNumber)
}

DocumentHistory {
  id, documentId (FK)
  action, from, to
  actorId, actorName, versionNumber, comment
  createdAt
}

DocumentTemplate {
  id, name (unique), type, version
  description, schema (JSONB), active
  createdAt, updatedAt
}
```

### Business ID Prefixes

| Type | Prefix | Example |
|------|--------|---------|
| Voucher | VCH-* | VCH-00000001 |
| Partial Payment | PPD-* | PPD-00000001 |
| Refund | RFD-* | RFD-00000001 |

---

## 4. Event Flow

### VoucherConsumer

```
BookingConfirmed → check Order.paymentStatus
PaymentCaptured  → check Booking.status

Both gates satisfied → create Document → issue (render PDF + store S3)
Either gate alone → no-op (wait for other event)
```

### RefundDocumentConsumer

```
RefundProcessed → create Refund Document → issue
Full refund (refundedAmount >= paidAmount) → invalidate active Voucher
```

### InvalidationConsumer

```
BookingCancelled → invalidate all active Vouchers for Booking
BookingRejected  → invalidate all active Vouchers for Booking
```

---

## 5. Document Lifecycle

```
(NOT_ISSUED) → ISSUED → SUPERSEDED (terminal, downloadable)
                     → INVALIDATED (terminal, not downloadable)
```

---

## 6. Security

| Role | documents.read | documents.write | PII |
|------|---------------|-----------------|-----|
| ADMIN | ✅ | ✅ | Full |
| OPERATOR | ✅ | ✅ | Full |
| DIRECTOR | ✅ | ❌ | Redacted |
| FINANCE | ✅ | ❌ | Redacted |
| ANALYST | ✅ | ❌ | Redacted |
| SALES_MANAGER | ✅ | ❌ | Redacted |
| BUYER | ❌ (own-scope) | ❌ | Own-scope |
| PARTNER | ❌ | ❌ | Denied |

PII redaction via `canViewTravelerPii()` / `redactTravelerPii()`.

---

## 7. PDF / Storage

- **PDF engine:** `@react-pdf/renderer` installed; V1 uses text-based renderer
- **Storage:** S3/MinIO via `ObjectStorageService`
- **S3 key:** `documents/{documentId}/v{version}.pdf`
- **Retrieval:** Short-lived signed URLs (5-minute TTL)

---

## 8. Test Evidence

| Test | Result |
|------|--------|
| createDocument — VCH prefix | ✅ PASS |
| createDocument — PPD prefix | ✅ PASS |
| createDocument — RFD prefix | ✅ PASS |
| invalidateDocument — ISSUED → INVALIDATED | ✅ PASS |
| invalidateDocument — idempotent for INVALIDATED | ✅ PASS |
| invalidateDocument — skip SUPERSEDED | ✅ PASS |
| listBuyerDocuments — empty for no customerId | ✅ PASS |
| render VOUCHER type | ✅ PASS |
| render REFUND type | ✅ PASS |
| render PARTIAL_PAYMENT type | ✅ PASS |

**Total: 10 passed, 0 failed**

---

## 9. Multi-Payment Limitation

D13 did NOT modify the production Payment model. The `Payment_one_active_per_order` constraint prevents two captured Payments on one Order. The Partial Payment Document is effectively identical to the Voucher under the current single-payment model. This is documented debt (D13-DEBT-02).

---

## 10. Regression Evidence

- TypeScript compilation: ✅ Clean (0 errors)
- Frontend build: ✅ Clean
- D8-D12: Not reopened (no changes to D8-D12 files)

---

## 11. Git Evidence

| Item | Value |
|------|-------|
| Commit SHA | Pending (uncommitted) |
| Branch | master |
| Working tree | Modified (D13 implementation) |
| Changed files | 8 modified, 9 new |

### Modified Files
- `backend/package.json` — added @react-pdf/renderer
- `backend/package-lock.json` — lockfile update
- `backend/prisma/schema.prisma` — added documents schema
- `backend/src/app.module.ts` — registered DocumentsModule
- `backend/src/security/account/account.controller.ts` — wired DocumentsService
- `backend/src/security/security.module.ts` — imported DocumentsModule
- `frontend/app/account/documents/page.tsx` — functional document list
- `frontend/lib/account-api.ts` — DocumentItem type + getDocuments params

### New Files
- `backend/prisma/migrations/20260910222616_add_documents_domain/migration.sql`
- `backend/src/modules/documents/documents.module.ts`
- `backend/src/modules/documents/documents.service.ts`
- `backend/src/modules/documents/documents.controller.ts`
- `backend/src/modules/documents/document-renderer.service.ts`
- `backend/src/modules/documents/voucher.consumer.ts`
- `backend/src/modules/documents/refund-document.consumer.ts`
- `backend/src/modules/documents/invalidation.consumer.ts`
- `backend/src/modules/documents/documents.service.spec.ts`

---

## 12. Final Verdict

### PASS WITH EXPLICIT NON-BLOCKING DEBT

D13 core functionality is implemented and tested. Explicit non-blocking gaps:
1. Full PDF rendering with @react-pdf/renderer JSX templates (V1 text renderer works)
2. Regeneration on traveler edit (no PassengerUpdated event exists)
3. Multi-payment Partial Payment Document (requires Step 2.12F)

---

*Report generated: 2026-09-10*
