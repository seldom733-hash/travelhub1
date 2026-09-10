# PHASE 3 — D13 — VOUCHER
## IMPLEMENTATION REMEDIATION PROMPT
### Final Remediation Before Closure

**Stage:** Phase 3 — D13  
**Mode:** REMEDIATION / VALIDATION / CLOSURE PREPARATION  
**Baseline:** Current uncommitted D13 implementation at HEAD `40e2f5b`

## 1. Mission

The D13 implementation is substantially present, but the current implementation report is NOT sufficient for closure.

The report states that:
- PDF generation still uses a text-based renderer;
- full JSX templates are deferred;
- only 10 unit tests are reported;
- Git commit is pending;
- the working tree is modified.

Therefore:

> **Do NOT declare D13 CLOSED yet.**

Perform the minimum remediation required to bring D13 into conformity with the approved implementation contract and produce complete evidence for closure.

Do NOT expand D13 into Finance or multi-payment engine work.

## 2. Frozen Business Model

Maintain exactly:

```text
Partial Payment Document
        ↓
TravelHub platform document reflecting payment state

Full payment + BookingConfirmed
        ↓
TravelHub Voucher

RefundProcessed
        ↓
Refund Document
```

Seller Partner remains responsible for airline tickets, hotel vouchers, rail tickets and other service-specific documents.

TravelHub Voucher does not replace Seller Partner documentation.

## 3. Real PDF Generation

The current text renderer does not satisfy the approved D13 implementation contract.

Implement actual PDF generation using:

```text
@react-pdf/renderer
```

with typed React/TSX templates.

At minimum provide working templates for:

```text
VOUCHER
PARTIAL_PAYMENT
REFUND
```

in:

```text
backend/src/modules/documents/templates/
```

Verify:
- actual PDF binary is produced;
- binary is non-empty and valid PDF;
- each document type renders;
- typed data reaches the template;
- PII redaction is applied before rendering;
- sensitive PII is not logged.

Do not merely install the package.

## 4. Storage

Verify end-to-end:

```text
Document creation
→ PDF render
→ ObjectStorageService.putObject()
→ S3/MinIO object exists
→ signed URL generated
→ authorized download succeeds
```

Use the existing `ObjectStorageService` / `S3ObjectStorageService`.

Approved key:

```text
documents/{documentId}/v{version}.pdf
```

Test that storage failure cannot leave a document incorrectly `ISSUED`.

## 5. Voucher Dual-Gate Integration Tests

Add integration/e2e tests proving:

### T-D13-01
`BookingConfirmed + PAID → exactly one Voucher`

### T-D13-02
`BookingConfirmed + UNPAID → no Voucher`

### T-D13-03
`PaymentCaptured + Booking not confirmed → no Voucher`

### T-D13-04
Second gate arrives later → Voucher generated.

Test both orders:

```text
BookingConfirmed → PaymentCaptured
PaymentCaptured → BookingConfirmed
```

### T-D13-05
Duplicate event delivery → no duplicate active Voucher.

Verify persisted document/version counts.

## 6. Cancellation / Rejection

### T-D13-06
Issued Voucher + `BookingCancelled`:

```text
ISSUED → INVALIDATED
```

Verify:
- download blocked;
- binary retained;
- metadata retained.

### T-D13-07
Issued Voucher + `BookingRejected`: same requirements.

## 7. Refund Document

### T-D13-08 — Partial Refund

Use existing verified refund behavior:

```text
RefundProcessed → Refund Document
```

Verify:
- `refundedAmount` increases;
- `paidAmount` remains historical;
- payment status remains according to current domain;
- Voucher remains `ISSUED`;
- Refund Document exists and authorized retrieval works.

Do not invent a new debt state.

### T-D13-09 — Full Refund

Verify:

```text
RefundProcessed
→ Refund Document
→ paymentStatus = REFUNDED
→ Voucher = INVALIDATED
→ Voucher download blocked
```

Historical Voucher binary remains retained.

## 8. RBAC / IDOR / PII

### T-D13-10 — Buyer isolation

Create Buyer A and Buyer B with separate customers/orders/bookings/documents.

Verify:
- A can see A's documents;
- A cannot retrieve B's documents;
- manipulating document IDs fails;
- client-supplied customerId cannot broaden access.

### Roles

Verify the approved matrix for:
ADMIN, OPERATOR, DIRECTOR, FINANCE, ANALYST, SALES_MANAGER, BUYER, PARTNER.

### PII

Verify:
- ADMIN → full;
- OPERATOR → full;
- all other roles → redacted.

Sensitive fields:
- passportNumber;
- passportExpiry;
- birthDate.

Never log raw PII.

## 9. Versioning / Immutability

Test:
- v1 creation;
- immutable stored binary;
- replacement creates v2;
- v1 → `SUPERSEDED`;
- v2 → `ISSUED`;
- historical v1 remains downloadable;
- invalidation → `INVALIDATED`;
- invalidated version not downloadable;
- old binary is never overwritten.

Use only:

```text
NOT_ISSUED
ISSUED
SUPERSEDED
INVALIDATED
```

Do not add `CURRENT`.

## 10. Partial Payment Scope

Do NOT modify the Payment schema to support multiple captured payments.

Do NOT add installment logic.

Do NOT create fake production states representing multiple captured payments.

The final report must explicitly state:

> D13 implements the `PARTIAL_PAYMENT` document type, but the current production payment model does not support two captured payments on one Order. Genuine multi-payment/installment behavior remains outside D13 and belongs to Step 2.12F.

A deterministic test may validate document contract/rendering without falsifying production payment semantics.

## 11. Frontend

Verify `/account/documents` is functional:
- list;
- type;
- status;
- date;
- Order/Booking reference;
- payment information;
- authorized download;
- invalidated document cannot be downloaded.

No unrelated UI redesign.

## 12. Error / Retry

Test:
- rendering failure → no incorrect `ISSUED`;
- storage failure → no inconsistent issued state;
- duplicate event → idempotent;
- missing gate → no Voucher;
- missing required passenger data → safe block;
- missing binary → controlled error without data disclosure.

## 13. Regression

Run the actual D8-D12 regression-relevant suites.

Do not claim regression merely because files were not modified.

Report:
- suite names;
- command;
- total;
- passed;
- failed;
- skipped;
- whether failures are D13-related or pre-existing.

Do not alter D8-D12 to hide failures.

## 14. Database / Migration

Verify:
- migration works on clean DB;
- Prisma generation works;
- document constraints/indexes are correct;
- active-version semantics are safe;
- ownership queries are indexed;
- migration is reproducible.

Do NOT change the Payment constraint.

## 15. Audit / Observability

Verify structured logging for:
- creation;
- issuance;
- version creation;
- invalidation;
- refund-document creation;
- render/storage failures;
- auth denial;
- duplicate-event suppression.

Do not log passport numbers, birth dates or unnecessary PII.

## 16. Final Implementation Report

Update:

```text
docs/reports/evidence/PHASE_3_D13_VOUCHER_IMPLEMENTATION_REPORT.md
```

Include:
1. Executive Summary.
2. AD-D13-01 through AD-D13-21 mapping.
3. Exact Prisma models/constraints/migration.
4. Exact event flow.
5. Actual PDF implementation evidence.
6. Actual storage/signed-URL evidence.
7. Security evidence.
8. Full test matrix with commands/results.
9. Explicit multi-payment limitation.
10. Actual D8-D12 regression evidence.
11. Exact Git SHA, branch, status, changed files.

## 17. Closure Gates

D13 MUST NOT be CLOSED until all are true:

- Real PDF generated with `@react-pdf/renderer`.
- Voucher / Partial Payment / Refund templates render.
- PDFs stored in S3/MinIO.
- Authorized signed download works.
- Voucher dual-gate tested in both event orders.
- Duplicate events proven idempotent.
- Cancellation/rejection invalidation tested.
- Partial/full refund behavior tested.
- Buyer IDOR protection tested.
- PII redaction tested.
- Versioning/immutability tested.
- Frontend document surface functional.
- D8-D12 regression has actual test evidence.
- Payment schema unchanged.
- No Finance expansion.
- Migration/build/tests pass.
- All D13 changes committed and pushed.
- Working tree clean.

## 18. Git Finalization

After successful remediation:
1. Review `git diff`.
2. Ensure only D13 changes are included.
3. Commit with a clear message, e.g.:

```text
feat(d13): implement travelhub documents and voucher lifecycle
```

4. Push according to project workflow.
5. Create tag:

```text
D13_VOUCHER
```

6. Verify:

```text
git status --short
git log --oneline -1
git rev-parse HEAD
git tag --list D13_VOUCHER
```

Final working tree must be clean.

## 19. Final Verdict

Choose exactly one:

```text
PASS / D13 CLOSED
```

```text
PASS WITH EXPLICIT NON-BLOCKING DEBT
```

```text
FAIL / REMEDIATION REQUIRED
```

`PASS / D13 CLOSED` requires all closure gates above.

## 20. Hard Prohibitions

Do NOT:
- modify Payment for multi-payment;
- create fake production payment states;
- implement Finance Center;
- implement invoice/fiscal receipt infrastructure;
- generate airline tickets or hotel vouchers;
- create supplier-document systems;
- reopen D8-D12;
- replace S3 abstraction;
- introduce alternate authorization;
- introduce `CURRENT` status;
- weaken PII controls.

## 21. Stop Condition

After remediation, complete validation, commit, push, tag and clean-tree checks, stop.

Return the final implementation/closure report with exact evidence.

Do not start D14.
