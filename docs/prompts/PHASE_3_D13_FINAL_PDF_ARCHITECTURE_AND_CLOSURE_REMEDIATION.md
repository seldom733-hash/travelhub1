# PHASE 3 — D13 — FINAL PDF ARCHITECTURE DECISION + CLOSURE REMEDIATION

**Stage:** Phase 3 — D13  
**Mode:** ARCHITECTURE DECISION + TARGETED REMEDIATION  
**Current issue:** implementation uses `pdf-lib` at runtime while approved AD-D13-12/13 selected `@react-pdf/renderer` + TSX templates.

## 1. Resolve the PDF architecture deviation

Do not silently accept the deviation.

Inspect the real repository/runtime and compare:

| Criterion | `@react-pdf/renderer` | `pdf-lib` | Evidence |
|---|---|---|---|
| Node/runtime compatibility | | | |
| NestJS/CommonJS compatibility | | | |
| TypeScript/build | | | |
| Jest/test execution | | | |
| Production deployment | | | |
| Template architecture | | | |
| Operational dependencies | | | |

Preferred rule: keep the already-approved `@react-pdf/renderer` unless repository evidence proves genuine production incompatibility.

If compatible:
- use `@react-pdf/renderer` at runtime;
- use the TSX templates as actual production templates;
- remove `pdf-lib` unless separately justified.

If genuinely incompatible:
- explicitly revise AD-D13-12/13;
- provide exact evidence;
- justify `pdf-lib` as the minimal safe alternative;
- update the D13 decision/report;
- do not hide the architectural change as a “gap”.

Do not optimize only for Jest convenience.

## 2. Prove real PDF output

For `VOUCHER`, `PARTIAL_PAYMENT`, `REFUND` verify:
- valid non-empty PDF binary;
- expected content/layout;
- A4 output;
- snapshot data;
- PII redaction before rendering;
- no sensitive PII in logs.

Tests must validate actual generated PDF, not only mocked renderer calls.

## 3. Prove storage

Verify:

`Document → PDF render → ObjectStorageService.putObject → S3/MinIO object → signed URL → authorized download`

Add failure coverage proving an upload failure cannot leave the document incorrectly `ISSUED`.

Use the existing storage abstraction only.

## 4. Run actual D8–D12 regression

Run relevant real regression suites for D8, D9, D10, D11, D12.

Report exact commands, totals, pass/fail/skip and classify any pre-existing failures.

“Files unchanged” is not regression evidence.

## 5. Git finalization

After successful remediation:
1. review `git diff`;
2. include only D13 changes;
3. commit;
4. push canonical branch;
5. create tag `D13_VOUCHER`;
6. verify `git status --short`, `git rev-parse HEAD`, latest log and tag.

Working tree must be clean.

## 6. Final report

Update:

`docs/reports/evidence/PHASE_3_D13_VOUCHER_IMPLEMENTATION_REPORT.md`

Include:
- final PDF decision and evidence;
- Partial Payment Document / Voucher / Refund Document model;
- Seller Partner document boundary;
- RBAC/PII/IDOR;
- unit + D13 e2e + real PDF + storage + D8–D12 regression tests;
- explicit statement that D13 does not modify Payment for multi-payment/installments;
- final SHA, tag and clean-tree evidence.

## 7. Closure rule

`PASS / D13 CLOSED` is allowed only when:
- PDF architecture is resolved;
- real PDFs are generated and tested;
- storage/signed retrieval is proven;
- D13 lifecycle/security/refund/versioning tests pass;
- D8–D12 regression has actual evidence;
- Payment model remains unchanged;
- no Finance expansion;
- commit/push/tag completed;
- working tree clean.

Otherwise use `FAIL / REMEDIATION REQUIRED` or `PASS WITH EXPLICIT NON-BLOCKING DEBT`.

Do not start D14.

## 8. Hard prohibitions

Do NOT:
- modify Payment schema for multi-payment;
- fake production multi-payment;
- implement Finance Center, invoice or fiscal infrastructure;
- generate partner service documents;
- reopen D8–D12;
- silently replace an approved architecture.

Stop after the final evidence report.
