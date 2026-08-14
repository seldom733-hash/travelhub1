# PHASE 2 — STEP 2.10B — PROVIDER FEE / SETTLEMENT / PAYOUT FOUNDATION — STRICT REVIEW REPORT

> **RETROSPECTIVE EVIDENCE RECONSTRUCTION**
>
> This file was created after the original Step 2.10B Strict Review because the
> dedicated report artifact was missing. It reconstructs only those review results
> that are directly supported by committed repository evidence. It is not the
> original contemporaneous review transcript/report.
>
> Source of truth for this reconstruction: commit `aeece37` (canonical `master`),
> the Roadmap 2.10B entry, the committed implementation artifacts, and the
> repository provenance audit report
> `docs/prompts/TRAVELHUB_REPOSITORY_PROVENANCE_AND_ROADMAP_INTEGRITY_AUDIT_REPORT.md`.

## 1. Verdict (preserved from Roadmap, not re-derived)

**`PHASE 2 STEP 2.10B STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`**

Preserved from the Roadmap entry (unchanged). This reconstruction does not re-run
the review; it records that the verdict and the review fixes are supported by
committed artifacts in `aeece37`.

## 2. Repository baseline / persistence evidence

- Branch `master`, commit `aeece3706ae701a27c30ea4b1a779d6b73665432`
  (`feat: Phase 2 Step 2.10B — Provider Fee / Settlement / Payout Foundation
  (STRICT REVIEW APPROVED WITH REVIEW FIXES)`), authored 2026-08-14 01:37:59 +0400.
- Commit message documents the review: «STRICT REVIEW 2026-08-14: 0 architecture
  blockers; fixes — audit action finance.provider_fee.created (snake_case),
  high-risk negative tests (divergent providerRef 409, concurrent divergent 409,
  unknown P2002 → ConflictError, pagination whitelist 400), arch doc idempotency-key
  evolution (2.12G/2.14A/2.14B). Regression: unit 495/495, serial e2e 1055/1055
  (59 suites), frontend 135/135, migrate 49/49 drift 0.»
- Parent baseline: `147d4fa` (Step 2.10A). At review time the working tree was
  clean (commit contains all review fixes; no follow-up fix commits exist for 2.10B
  — confirmed by `git log` for the 2.10B paths).

## 3. Domain separation findings

Committed schema defines three distinct Finance-owned facts
(`backend/prisma/schema.prisma`):

- `finance.ProviderFee` (line 3981) — external provider (PSP/bank) fee fact,
  separate from TravelHub Commission; `provider`/`providerRef` provenance fields.
- `finance.Settlement` (line 4015) — durable settlement fact (no balance/net-payable/
  periods/status fields — lifecycle deferred).
- `finance.Payout` (line 4046) — operational payout record (bank rail), no
  PSP/bank credentials, no status/lifecycle fields.
- No universal financial table; Payment (Buyer rail) and Payout (Partner rail) are
  not linked (no `settlementId`/`paymentId` FK columns on Payout; e2e #10 asserts
  absence of linkage columns).

## 4. Write-path audit

Repository-wide write-path audit (committed evidence, `aeece37` content):

- Exactly 3 production create writers: `tx.providerFee.create`,
  `tx.settlement.create`, `tx.payout.create` — all inside
  `backend/src/modules/finance/settlement.service.ts` (single canonical
  `SettlementService`).
- Zero update/updateMany/upsert/delete/deleteMany/raw SQL for these models.
- No public POST route; PATCH/DELETE → 404 (e2e #1).
- Zero references to these models outside `src/modules/finance` (repo-wide grep in
  audit report §6; no cross-domain writers).

## 5. Immutability findings

- Schema-level: models have `createdAt` UTC and **no `updatedAt`** (e2e #10 asserts
  column absence for all three tables).
- Code-level: no update/delete paths (see §4); no PATCH/DELETE routes; no
  cleanup/job removal; no hidden status lifecycle columns.
- Honest classification: schema + code enforcement (no DB trigger). No mutable
  parent has a relation to these tables, so cascade-delete is impossible.

## 6. Migration findings

- Migration `backend/prisma/migrations/20260813140508_add_provider_fee_settlement_payout_foundation/migration.sql`
  (committed in `aeece37`): 3 `CREATE TABLE` (ProviderFee, Settlement, Payout),
  6 unique indexes, **0 ALTER** of existing tables — purely additive, replay-proof
  (verified by audit: 56/56 migrations committed; e2e global setup applies real
  migrations on fresh DB).
- No `db push`, no backfill, no drift (Roadmap: «migrate 49/49 drift 0» at the
  time).

## 7. ID / Decimal / currency findings

- IDs: `PFE-########`, `STL-########`, `POT-########` via canonical `IdsService`
  (`ids.nextCode`) **inside the same transaction** as create
  (`settlement.service.ts` → `idempotentCreate` → `this.ids.nextCode(tx, prefix)`);
  DB UNIQUE on `code`; prefixes registered in `docs/contracts/ids.md` (§92/§100).
- Money: `Prisma.Decimal` DECIMAL(12,2), API serializes Decimal-strings
  (`amount: r.amount.toString()`); never float as authority
  (`finance.money.ts` convention from Step 2.10).
- Currency: ISO 4217 snapshot validated against `finance.Currency`
  (`assertCurrencyKnown` → unknown currency → controlled 422), no FK → durable
  across currency deactivation/rename.

## 8. Idempotency / divergent replay findings

- DB-unique idempotency keys: ProviderFee `@@unique([sourceType, sourceId, provider])`,
  Settlement `@@unique([sourceType, sourceId])`, Payout `@@unique([sourceType, sourceId])`.
- `idempotentCreate` (first-write-wins convention from 2.10A FIX 1):
  - identical replay → returns existing fact (no-op);
  - same key + divergent amount/currency/providerRef → **controlled 409**
    (ConflictError), never raw 500;
  - unknown P2002 → controlled ConflictError (unit spec covers code-key collision);
  - non-P2002 → rethrow.
- Concurrency: concurrent identical creates → exactly one durable fact (e2e #7);
  concurrent divergent → one fact + one 409 (e2e #7b — review-added).
- Future-key evolution documented in arch doc §5.1 (2.12G feeType discriminator /
  2.14A settlement version / 2.14B payout attempt — swap on empty tables, additive).

## 9. RBAC / read API findings

- Permissions `finance.provider_fee.read`, `finance.settlement.read`,
  `finance.payout.read` — committed in `backend/src/security/permissions.constants.ts`
  (lines 119–121 + role grants at 247–249, 293–294; FINANCE/DIRECTOR/ANALYST/ADMIN).
- Read-only controller routes: `GET /api/v1/finance/{provider-fees,settlements,payouts}`
  and `/:code` (`finance.controller.ts`, committed in `aeece37`); documented in
  `docs/contracts/api.md` (§691–697).
- e2e RBAC matrix: anonymous 401; BUYER/PARTNER/OPERATOR/SALES_MANAGER/MODERATOR/
  MARKETER → 403; FINANCE/DIRECTOR/ANALYST/ADMIN → 200 (e2e #2).
- Filters/pagination whitelist: `sourceType`, `currency`, page/pageSize with
  pageSize cap ≤ 100; review-added negative tests `pageSize=101 → 400`,
  `page=0 → 400`, `page=abc → 400` (committed e2e #6, lines 196–200).

## 10. Ledger / Payment / Refund / Invoice / Commission boundary findings

- **Ledger boundary (2.10A intact)**: these facts do NOT auto-post to
  `LedgerTransaction`; ledger count unchanged after creates (e2e #9); the only
  ledger writer remains `LedgerService` (repo-wide grep: 1 writer).
- **Payment boundary**: zero Payment create/status/authorize/capture/PSP webhook;
  `Order.paymentStatus`/`paidAmount` untouched (e2e #9: Payment/Refund/Invoice/
  Commission/CommissionAccrual/Booking counts unchanged).
- **PaymentTerms boundary**: frozen Sales/Order terms remain authority; no Finance
  recalculation (arch doc notes PaymentTerms collision resolution from Step 2.10).
- **Refund/Invoice/Commission**: zero runtime (schema-only models from Step 2.10);
  ProviderFee is explicitly NOT TravelHub Commission.
- **Events**: 0 domain events emitted (no consumers); `events.md` §180–182 records
  `ProviderFeeCreated`/`SettlementCreated`/`PayoutCreated` as NOT emitted.
- **Milestones**: no `paidAt/authorizedAt/capturedAt/refundedAt/settledAt/
  payoutRequestedAt` columns (e2e #10 asserts absence) — Step 2.10C temporal
  boundary respected; `createdAt` only.

## 11. Review fixes — verified in committed artifacts

| Fix (per commit message / Roadmap) | Verified evidence | Commit |
|---|---|---|
| Audit action normalized to `finance.provider_fee.created` (snake_case, was `finance.providerfee.created`) | `settlement.service.ts:98` — `action: "finance.provider_fee.created"` | `aeece37` |
| Divergent providerRef replay → controlled 409 | e2e #6b (committed spec, line 237) | `aeece37` |
| Concurrent divergent replay → one fact + 409, no raw 500 | e2e #7b (line 266) | `aeece37` |
| Unknown P2002 → controlled ConflictError | unit spec `settlement.service.spec.ts` (3 tests, P2002 edge paths incl. code-key collision) | `aeece37` |
| Pagination whitelist (pageSize>100 / page=0 / page=abc → 400) | e2e #6 (lines 196–200) | `aeece37` |
| Future idempotency-key evolution documented | arch doc `docs/architecture/provider-fee-settlement-payout-foundation.md` §5.1 (lines 74–87) | `aeece37` |
| Payment vs Payout rail separation (no linkage) | e2e #10 (Payout has no `settlementId` column) | `aeece37` |

All six expected review fixes are verifiable in committed code/tests/docs. No
expected fix was found missing.

## 12. Actual committed test artifacts

- e2e: `backend/test/provider-fee-settlement-payout-foundation.e2e-spec.ts`
  (356 lines, committed in `aeece37`) — **14 `it()` blocks**:
  1. anonymous 401 + no write routes (POST/PATCH/DELETE → 404);
  2. RBAC matrix (6 forbidden roles 403, 3 allowed + ADMIN 200);
  3. ProviderFee canonical create (PFE-*, Decimal, currency snapshot, provenance, audit);
  4. Settlement + Payout create/read/list/filters/404;
  5. amount/currency validation (0/negative/excess precision/unknown currency);
  6. identical replay no-op + divergent amount/currency 409 + pagination whitelist 400;
  6b. divergent providerRef → 409 (review-added);
  7. concurrent duplicate → one row (Settlement + Payout);
  7b. concurrent divergent → one fact + 409 (review-added);
  8. correlation/causation/actor server-authoritative;
  9. zero cross-domain mutations + zero ledger auto-postings;
  10. no PSP columns/milestones/Settlement↔Payout linkage;
  11. migration tables on fresh replay + legacy ledger readable.
- unit: `backend/src/modules/finance/settlement.service.spec.ts` (3 tests, P2002 edge paths).
- Entry-audit evolution: `backend/test/phase2-entry-audit.e2e-spec.ts` updated in
  `aeece37` (settlement/payout now schema-only entities — legitimate contract evolution).

## 13. Historical count evidence classification

| Claim | Source | Classification |
|---|---|---|
| unit 495/495 | `aeece37` commit message + Roadmap | **commit-message / Roadmap claim** (not independently re-executed in this reconstruction) |
| serial e2e 1055/1055 (59 suites) | `aeece37` commit message + Roadmap | **commit-message / Roadmap claim** |
| frontend 135/135 | `aeece37` commit message | **commit-message claim** |
| migrate 49/49 drift 0 | `aeece37` commit message + Roadmap | **claim; current repo = 56/56 up-to-date** (later steps added migrations) |
| e2e suite «13/13» (Roadmap) | Roadmap text | **Roadmap-only historical claim; committed spec actually contains 14 `it()` blocks** — minor count discrepancy noted; verdict/fixes unaffected |

No fabricated counts added. These are historical claims recorded as such.

## 14. Exact files changed during review (from commit history)

`aeece37` (the only commit touching 2.10B paths — review fixes folded into the
same commit as implementation; no separate fix commit exists):

- `backend/prisma/migrations/20260813140508_add_provider_fee_settlement_payout_foundation/migration.sql` (A)
- `backend/prisma/schema.prisma` (M), `backend/src/modules/finance/finance.controller.ts` (M),
  `backend/src/modules/finance/finance.module.ts` (M), `backend/src/modules/finance/finance.validation.ts` (M)
- `backend/src/modules/finance/settlement.service.spec.ts` (A), `settlement.service.ts` (A)
- `backend/src/security/permissions.constants.ts` (M)
- `backend/test/phase2-entry-audit.e2e-spec.ts` (M),
  `backend/test/provider-fee-settlement-payout-foundation.e2e-spec.ts` (A)
- `docs/architecture/provider-fee-settlement-payout-foundation.md` (A)
- `docs/contracts/api.md`, `events.md`, `ids.md` (M)
- `docs/prompts/..._IMPLEMENTATION.md`, `..._IMPLEMENTATION_REPORT.md`, `..._STRICT_REVIEW.md` (A)
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (M)

## 15. Persistence SHA

`aeece3706ae701a27c30ea4b1a779d6b73665432` (canonical `master`, pushed to origin — verified HEAD/origin sync in provenance audit).

## 16. Note on the missing original artifact

The original contemporaneous strict-review report file for Step 2.10B was absent
from the worktree, HEAD, and all refs (confirmed in the provenance audit). This
document is the **retrospective evidence reconstruction** of that review, built
exclusively from committed evidence. It is not a re-run of the review and does
not claim to be the original transcript.

---

```text
REPOSITORY EVIDENCE
repository: seldom733-hash/travelhub1 (canonical local clone D:/travelhub_v1)
branch: master
head: aeece3706ae701a27c30ea4b1a779d6b73665432 (reviewed artifacts)
origin: aeece37 (verified in sync at audit time 6c18895 chain)
worktree_clean: true (at commit time)
migration_count: 49/49 (at commit time; current 56/56 up-to-date)
reviewed_state: COMMIT
reviewed_diff_base: 147d4fa
reviewed_diff_head: aeece37
persistence_status: PERSISTED
persistence_sha: aeece3706ae701a27c30ea4b1a779d6b73665432
```
