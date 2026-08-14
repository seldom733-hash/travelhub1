# Finance Temporal Contract (Step 2.10C)

**Step:** Phase 2 — 2.10C — Finance Temporal Contract
**Status:** IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-14)
**Predecessor:** Step 2.10B (APPROVED WITH REVIEW FIXES)
**NEXT:** Phase 2 — Step 2.10C — STRICT REVIEW

---

## 1. Purpose

Establish a precise, durable, server-owned temporal vocabulary for the Finance
domain **only where the current architecture and approved Roadmap already
justify the fact**. The contract prevents future Finance implementations from
reconstructing business time from `updatedAt`, current status, AuditLog,
provider payloads, or ledger insertion time.

Step 2.10C is **not** permission to invent lifecycle semantics: Payment /
Refund / Invoice / Commission / Settlement / Payout business lifecycles and
their milestones belong to later Roadmap steps (2.12–2.14).

## 2. Scope

- **In scope:** temporal vocabulary audit, entity classification, one
  justified schema addition (`LedgerTransaction.occurredAt`), validation +
  mass-assignment protection, tests, docs, contracts, Roadmap update.
- **Out of scope (deferred):** `authorizedAt/capturedAt/paidAt/failedAt/
  cancelledAt` (Payment, 2.12), `requestedAt/approvedAt/processedAt/failedAt`
  (Refund, 2.13), `issuedAt/dueAt` (Invoice, 2.14), `accruedAt` (Commission,
  2.12C/E), `eligibleAt/calculatedAt/settledAt` (Settlement, 2.14A),
  `scheduledAt/processingAt/paidAt/failedAt` (Payout, 2.14B). No producer /
  canonical transition exists for any of these today — adding them would
  fabricate lifecycle semantics (Roadmap hard gate §5/§6, §39 stop-conditions).

## 3. Entity classification

| Model | Class | Writers | Temporal fields today | 2.10C action |
|---|---|---|---|---|
| `Currency` / `ExchangeRate` / `Tax` / `TaxRule` | master/reference data | FinanceService (manage) | createdAt/updatedAt (entity time) | none — master data |
| `Payment` | future mutable lifecycle aggregate | none (schema-only) | createdAt (schema-only) | defer milestones (2.12) |
| `PaymentTerms` | reference/frozen snapshot | none (source — 2.3B frozen) | createdAt | none |
| `Refund` | future mutable lifecycle aggregate | none (schema-only) | createdAt | defer milestones (2.13) |
| `Invoice` | future mutable lifecycle aggregate | none (schema-only) | createdAt | defer milestones (2.14) |
| `Commission` / `CommissionAccrual` | future runtime model, no producer | none (schema-only) | createdAt | defer accrual time (2.12C/E) |
| `LedgerTransaction` | **immutable financial fact** | LedgerService.create (2.10A) | createdAt, **occurredAt (2.10C)** | **added occurredAt** |
| `ProviderFee` | immutable foundation fact (2.10B) | SettlementService.create | createdAt | none — fee fact time = createdAt (Roadmap has no separate fee milestone) |
| `Settlement` | immutable foundation fact (2.10B) | SettlementService.create | createdAt | defer `settledAt` (2.14A — version semantics unresolved) |
| `Payout` | immutable foundation fact (2.10B) | SettlementService.create | createdAt | defer milestones (2.14B — attempt semantics unresolved) |

## 4. Temporal vocabulary audit

Candidates considered (Roadmap §5 hard gate — each one answered, none guessed):

- `authorizedAt` — Payment authorize transition. Aggregate: Payment (not built).
  Transition: PSP authorize (not implemented). **DEFER (2.12B).**
- `capturedAt` — Payment capture transition. Same. **DEFER (2.12B).**
- `paidAt` — Payment success. Same. **DEFER (2.12).**
- `failedAt` — Payment/Refund failure. Same. **DEFER (2.12/2.13).**
- `cancelledAt` — Payment cancellation. Same. **DEFER (2.12).**
- `refundedAt` — Refund processed. Aggregate: Refund (not built). **DEFER (2.13).**
- `issuedAt` — Invoice issue. Aggregate: Invoice (not built). **DEFER (2.14).**
- `dueAt` — Invoice due date. Same. **DEFER (2.14).**
- `accruedAt` — Commission accrual; requires unresolved accounting recognition
  policy. **DEFER (2.12C/E)** — stop-condition §39 triggered → documented, not
  guessed.
- `eligibleAt/calculatedAt/settledAt` — Settlement engine milestones; require
  unresolved settlement-version semantics. **DEFER (2.14A)** — stop-condition.
- `scheduledAt/processingAt/paidAt/failedAt` — Payout lifecycle; require
  unresolved payout-attempt semantics. **DEFER (2.14B)** — stop-condition.
- `occurredAt` (Ledger) — business occurrence time of an immutable ledger fact.
  Aggregate: LedgerTransaction (exists, 2.10A). Transition: fact creation
  (exists, canonical producer = LedgerService). First-only: yes. Can be NULL
  forever: yes (legacy/unknown). Authority: server-validated ISO 8601 (for
  event-borne facts 2.12+ — canonical event `occurredAt`). Instant: yes, UTC.
  Replay: cannot change it (first-write-wins). **IMPLEMENTED.**

No candidate was added "because it will probably be useful": every deferred
item has an unresolved producer/ownership/recognition question, which is the
explicit stop-condition (§39) for deferral.

## 5. Implemented milestones

Exactly one:

| Field | Entity | Meaning | Authority | NULL policy | First-only |
|---|---|---|---|---|---|
| `occurredAt` | `finance.LedgerTransaction` | business occurrence time of the financial fact (UTC instant) | server-validated ISO 8601 (2.12+ event-borne facts: canonical event occurredAt) | NULL = unknown (legacy / producer did not pass; no fabricated backfill) | yes — identical replay keeps first occurrence |

## 6. Deferred milestones

See §4. All deferred items are **documented** here and in the Roadmap; none
are encoded in schema. The Roadmap explicitly assigns them to 2.12–2.14.
Future producers MUST read this document's §24 before adding any of them.

## 7. Business time vs technical time

- `createdAt` = persistence/record creation time. On LedgerTransaction it is
  the **immutable ledger-fact persistence timestamp**, never a Payment/Refund/
  Settlement/Payout business time.
- `updatedAt` — exists on mutable models; **never** used as a Finance
  milestone. LedgerTransaction has no `updatedAt` (append-only).
- `occurredAt` (Ledger, 2.10C) = actual business occurrence time, **separate
  from** `createdAt`. Never derived from `createdAt/updatedAt`/AuditLog/
  Outbox/current status.
- Outbox `occurredAt` = event occurrence per event contract — for event-borne
  ledger facts (2.12+) the canonical event occurredAt becomes the ledger
  `occurredAt` authority; it is NOT inferred from outbox insertion time.
- Provider timestamps — no provider time is accepted anywhere in 2.10C
  (no PSP contract exists; adding provider-time handling without a contract
  would violate §14 "do not add provider-time handling unless required").

## 8. Ownership

- `LedgerTransaction.occurredAt` is written **only** by `LedgerService.create`
  (the single canonical writer established in 2.10A), from server-validated
  input. No other service, controller, migration, or test fixture writes it in
  production paths.
- Forbidden cross-domain writes (unchanged): Order/Booking/Sales writing
  Finance milestones; LedgerService mutating Payment/Settlement/Payout;
  ProviderFee writer touching Settlement/Payout; frontend supplying
  server-owned milestones.

## 9. Canonical occurrence authority

Per field (only one implemented):

- `occurredAt`: server transaction context accepts a producer-supplied UTC ISO
  8601 instant that is **validated by the server** (`validateOccurredAt`):
  valid → stored as UTC `DateTime`; `null`/`undefined` → NULL (unknown);
  malformed/impossible (e.g. `2026-13-01`, hour 25, non-date) →
  `ValidationDomainError` (controlled 422), never becomes authority.
  For 2.12+ event-borne facts the contract prescribes: authority = canonical
  domain event `occurredAt`, validated identically, preserved explicitly,
  distinguished from ingestion time (`createdAt`).

## 10. First-only semantics

First successful occurrence wins. Implemented for `occurredAt`:

- idempotency key `@@unique(sourceType, sourceId, type)` (2.10A) means an
  identical logical replay returns the existing fact.
- `occurredAt` is **excluded** from the replay payload comparison: a retry that
  happens later (different business time) does not make identical logical
  replay diverge (§16). The first occurrence's `occurredAt` is preserved.
- Divergent replay on immutable payload fields (amount/currency/sourceEventId/
  businessRef) still → controlled 409 (2.10A STRICT REVIEW FIX 1 unchanged).

## 11. Atomicity

- Ledger fact creation is a single `create` (row + audit log + idempotency) in
  one transaction — `occurredAt` is written atomically with the fact itself.
- No state machine exists in 2.10C (no Payment/Refund/Settlement/Payout
  runtime), so the §15 "business transition + milestone + history/outbox"
  invariant is documented here as an obligation for the future producer steps
  (2.12–2.14), not invented now.

## 12. Idempotency

- 2.10A invariant preserved: identical replay = no-op (returns existing fact);
  unknown P2002 = controlled 409; divergent immutable payload = 409.
- `occurredAt` is not part of replay comparison (see §10) — this is the exact
  §16 requirement: a milestone field must not make identical logical replay
  diverge because a retry occurred later.

## 13. Concurrency

- 2.10A concurrency contract unchanged: concurrent duplicate creates on the
  idempotency key → one fact wins, others receive the existing fact (no raw
  500, no milestone overwrite). Covered by existing 2.10A e2e concurrency
  tests, now including occurredAt-bearing facts.
- No lifecycle races created (no lifecycle was introduced).

## 14. Ordering rules

- No global chain of Finance timestamps is assumed.
- Known ordering: for a real business fact, `occurredAt <= createdAt`
  (occurrence precedes persistence) — semantically true, not encoded as a DB
  constraint (clock-skew between producer and server is legitimate).
- Deferred ordering (documented for future steps, NOT encoded):
  `authorizedAt <= capturedAt <= paidAt` (2.12); refund occurrence >= payment
  occurrence (2.13); settlement >= payment (2.14A). These become constraints
  only when the owning lifecycle contract establishes them.

## 15. Legacy NULL policy

- Existing Finance rows remain readable after the migration.
- Unknown historical milestone time stays NULL. **No fabricated backfill**:
  the repository contains no authoritative source proving exact occurrence
  times of legacy ledger facts.
- Migration adds a nullable column with no default and no backfill; old API
  consumers are unaffected (additive nullable field).

## 16. Mass-assignment protection

- `occurredAt` is server-owned. There is no public write API for
  LedgerTransaction at all (write routes → 404, 2.10A).
- Where server-owned fields are exposed on master-data endpoints, the
  established convention is loud rejection: `assertNoForbiddenKeys` on raw
  body → 422. `occurredAt` is not in any client-writable DTO; when later
  steps add an internal write path, they must follow the same loud-rejection
  convention (not silent stripping).

## 17. RBAC

- No new permissions introduced (§20 2.10C): no `finance.temporal.write`,
  no `finance.milestone.manage`.
- Read visibility follows the existing contract: `finance.ledger.read`
  (FINANCE/DIRECTOR/ANALYST/ADMIN); BUYER/PARTNER/etc → 403; anonymous → 401.
  `occurredAt` is part of the ledger read model for those roles.

## 18. API exposure

See `docs/contracts/api.md` (Finance — LedgerTransaction). `occurredAt` is
exposed in the ledger read model as `string | null` (UTC ISO 8601), with
documented business meaning, server-owned flag, NULL semantics for legacy rows.
No future fields are exposed as if their producer existed (deferred milestones
are not in any read model).

## 19. Event boundary

- Zero new domain events (§22 2.10C): no new canonical business fact with a
  consumer was introduced — the timestamp documents an existing fact.
- The existing ledger audit entry (`finance.ledger_transaction.created`) is
  unchanged (minimal metadata, no PII).
- ADR-0010 correlation/causation semantics untouched.
- 2.12+ obligation: if a domain event becomes the canonical producer of an
  event-borne ledger fact, the event's `occurredAt` becomes the ledger
  `occurredAt` authority without changing the envelope.

## 20. Ledger boundary

- 2.10A invariants proven unchanged: one LedgerService writer, append-only,
  no hidden auto-posting, no balance/double-entry logic.
- `occurredAt` is data on the fact, not a posting trigger. No ledger writes
  are triggered by temporal milestones of other Finance entities (none exist).

## 21. ProviderFee / Settlement / Payout boundary

- ProviderFee ≠ Commission; Settlement ≠ Payout; Payment ≠ Payout — unchanged.
- ProviderFee/Settlement/Payout remain immutable foundation records: no status
  vocabulary, no lifecycle, no milestones added by 2.10C.
- Their idempotency behavior (2.10B) is unchanged.
- Future idempotency evolution stays assigned to: 2.12G fee-type
  discriminator, 2.14A settlement version, 2.14B payout attempt. Not
  pre-implemented (2.10B strict-review note preserved).

## 22. Migration strategy

- One additive migration: `20260814090000_add_ledger_occurred_at` —
  `ALTER TABLE "finance"."LedgerTransaction" ADD COLUMN "occurredAt" TIMESTAMP(3);`
- Additive, nullable, no default, no backfill, no destructive ALTER, no
  `db push`. Fresh replay proven by e2e globalSetup (drop + recreate +
  `migrate deploy` over real migrations); drift = 0 (verified after
  `prisma migrate deploy` + status check).

## 23. Write-path audit

`occurredAt` writers (production):

1. canonical owning service — `LedgerService.create` (ledger.service.ts):
   sole production writer.
2. canonical consumer — Finance ledger read (controller DTO via
   `toLedgerDto`); no other consumer.
3. migration/backfill — none (no backfill).
4. test fixture — e2e `createLedgerFact` (test-only helper in
   ledger-transaction-foundation.e2e-spec.ts); unit validation spec.
5. obsolete/unsafe writer — **zero.**

Deferred milestones: production writer count = 0 (correct — no producer).

## 24. Future producer obligations

When 2.12–2.14 introduce milestone producers, each new field MUST:

- be additive + nullable (legacy NULL preserved);
- be server-owned with a documented authority (server transaction time /
  canonical event occurredAt / validated provider time);
- follow first-only semantics (`existing ?? canonicalOccurrenceTime`), never
  unconditional `now()` on retries;
- not fabricate backfill;
- not join replay comparison if it would diverge identical logical replays;
- be written atomically with its owning state transition (+ history/outbox);
- preserve this document's ordering rules or explicitly extend them;
- pass the §19 mass-assignment gate (loud 422, not silent stripping).

## 25. Out-of-scope items (explicit)

Payment PSP runtime; authorize/capture engine; Refund workflow; Invoice
workflow; Commission calculation; CommissionAccrual producer; double-entry;
chart of accounts; balances; automatic ledger posting; provider
reconciliation; Settlement lifecycle/versioning; Payout attempts; bank rails;
Finance frontend; Step 2.12+ functionality; Step 2.17 hardening; unrelated
refactoring.
