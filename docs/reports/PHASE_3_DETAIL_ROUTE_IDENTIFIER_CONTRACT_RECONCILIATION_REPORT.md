# PHASE 3 — Detail Route Identifier Contract Reconciliation Report

## 1. Executive Summary

This audit-only reconciliation resolves the apparent conflict between
ADR-OPS-001 §6 (literal token `/app/payments/[id]`) and the implemented
canonical Payments detail route `/app/payments/[code]` (commit `6b0a3cb`).
Conclusion: **there is no semantic conflict.** In ADR-OPS-001 §6 the token
`[id]` is the generic Next.js dynamic-segment NAME for the "detail page"
route (used uniformly for all four registries); it does not legislate the
identifier TYPE. The segment VALUE semantics for Payments are proven — by
git history, by the migration sentence of the ADR itself, by the unchanged
backend authority `GET /finance/payments/:code`, and by post-ADR
implementation — to be the **Payment business code (`PAY-*`)**. The current
implementation conforms; **no code change is required**. The only residual
nuance is notational and is recorded as an optional (non-blocking)
documentation clarification for the architecture owner.

## 2. Baseline SHA

- Branch `master`; baseline `6b0a3cb1b119767cb3c07ad0c93ce460ac775a7a`
  (= `origin/master` at start; tree clean except this task's prompt file).

## 3. Canonical Sources

Read in full-context per the prompt: canonical roadmap docs, canonical
architecture (`TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md` — L127
"Relationships: по FK/UUID, не parsing strings" — no URL-identifier rule),
debt register (no Payments URL identifier entry), ADR-OPS-001/012 source
prompt §30 + §52, the accepted UI-C1.2 reconciliation report (ADR text),
UI-C1.1/C1.2A/C1.2F reports, the detail-route audit prompt §13, the prior
qualification report, and implementation files.

## 4. ADR-OPS-001 Exact Evidence

Verbatim (accepted report `PHASE_3_COMMERCE_CENTER_UI_C1_2_…RECONCILIATION_REPORT.md`,
unchanged since introduction — verified, see §7):

- §6 L188: "`/app/payments` becomes the canonical Payments route. The
  existing `/app/finance/payments` + `/app/finance/payments/[id]` are
  **migrated** (redirect kept during UI-C1.2F; canonical detail becomes
  `/app/payments/[id]`)."
- §6 L190: "Detail pages: canonical entity routes remain `/app/requests/[id]`,
  `/app/orders/[id]`, `/app/bookings/[id]` (accepted UI-C1.1), plus
  `/app/payments/[id]`."
- Same report L117 (descriptive row, same accepted document): "UI detail …
  `finance/payments/[id]/page.tsx`" — i.e. the `[id]` token names the file
  segment of the **existing** detail page whose parameter value is the
  business code (its own header: "route param is `[id]` but backend uses
  `:code`").
- §21 L636/L644 (ADR-OPS-012): "Proposed Payments detail page
  (`/app/payments/[id]`) … **A (dedicated `/app/payments/[id]`) — canonical
  record URL** … → primary."

Semantic reading per prompt §4.2: the ADR uses `[id]` as the dynamic-segment
placeholder (file-convention naming), uniformly across all four registries.
It never states "`[id]` = UUID", never states "identifier = internal UUID"
for Payments, and never redefines the identifier carried by the migrated
page. The source prompt §30 that spawned the ADR used `/app/payments/[id]`
explicitly as an option placeholder ("Do not implement. Evaluate.").

## 5. Related ADR Evidence

| Source | Section | Exact statement / fact | Type | Authority |
|---|---|---|---|---|
| UI-C1.2 report (ADR-OPS-001) | §6 L188 | legacy `[id]` page **migrated** → canonical detail | normative | canonical |
| UI-C1.2 report | §6 L190 | canonical detail route list (`[id]` notation) | normative | canonical |
| UI-C1.2 report | L117 | describes existing `finance/payments/[id]` page (code-based) | descriptive | canonical (same doc) |
| UI-C1.2 report | §21 (ADR-OPS-012) | dedicated detail page is the primary pattern | normative | canonical |
| UI-C1.2 prompt | §30 | `/app/payments/[id]` listed as option placeholder, "Do not implement" | normative (process) | canonical |
| Detail-route audit prompt | §13 | if canonical URL uses business code, `[id]` naming should become `[code]` (example given: `/app/payments/[code]`) | normative (naming guidance) | canonical |
| Pre-Step 3.12 reference reports | multiple | `referenceNumber` (MKT-*) = display; `code` = business identifier; UUID never user-facing | normative (display) | canonical |
| Legacy detail page (pre-ADR, commit `2d8af1f` ← `966582d`) | file header + param line | "Backend endpoint: GET /finance/payments/:code"; "route param is `[id]` but backend uses `:code`" | implementation | supporting |
| Backend `finance.controller.ts` L313 | `@Get("payments/:code")` | lookup `findUnique({ where: { code } })`; no UUID payment-detail endpoint exists | implementation | supporting |
| UI-C1.2F report | payments tab | registry links carried `p.code` into the `[id]` segment (post-ADR) | implementation | supporting |

## 6. Identifier Taxonomy

| Field | Value | Role |
|---|---|---|
| `Payment.id` | internal UUID | persistence identity (FKs, relations) |
| `Payment.code` | `PAY-*` (unique, immutable) | business identifier → **URL identifier** |
| `Payment.referenceNumber` | `MKT-PAY-<seq>-<n>` | display/reference identifier (never a URL key) |
| `/app/payments/<segment>` | segment value = `Payment.code` | URL identifier |

Is there a canonical rule binding the Payment URL identifier to `code`?
Yes — not as a bare phrase, but as the only reading consistent with the
accepted migration of the existing code-based detail page (ADR §6 L188),
the unchanged backend `:code` authority, and the audit prompt's own §13
naming guidance. A UUID reading would require inventing a new
UUID-lookup API endpoint that no normative document authorizes.

## 7. Git History Findings

- `966582d` (2026-08-31) "…add Payment Detail": created
  `finance/payments/[id]/page.tsx`; the `[id]` segment **carried
  `PAY-*` code from day one** (file header documents `:code` backend).
- `2d8af1f` (2026-09-02): page evolved, still code-based.
- `485436a` (2026-09-05) UI-C1.2A: `/app/payments` registry created;
  registry links `p.code` into the detail page.
- `07f8557` (2026-09-05/06) UI-C1.2: ADR-OPS-001 accepted — it declares the
  existing `[id]` page **migrated** to the canonical route ("redirect kept").
- `git diff 07f8557 c9ef2b4` on the report: **no changes** to the §6 region —
  the ADR text was never amended after acceptance.
- Intent finding (evidence-based, not reconstructed): `[id]` was the
  generic dynamic-segment name; the identifier it carried for Payments was
  always the business code. No commit ever introduced a UUID-based payment
  detail route or endpoint.

## 8. Current Implementation State (read-only verification)

Payments: registry `/app/payments` → link `/app/payments/${p.code}` →
canonical page `app/payments/[code]/page.tsx` → `GET /finance/payments/:code`
→ `getByCode` → `findUnique({ where: { code } })`; legacy
`/app/finance/payments/[id]` → client redirect to `/app/payments/<code>`.
Display = `referenceNumber`. Requests/Orders/Bookings: `[id]` segment →
API `:id` → `findUnique({ where: { id } })` (UUID) — re-verified in code.

## 9. Conflict Analysis

The conflict is **notational, not semantic**. ADR-OPS-001 §6 fixes the
canonical route SHAPE (`/app/payments/<segment>`); it does not define the
segment's identifier type. The identifier semantics are fixed by the
migrated contract: business code. Under this reading:
- URL **values** are identical under both notations:
  `/app/payments/PAY-00000710`.
- The implemented file segment name `[code]` is *more* accurate than the
  legacy `[id]` and is explicitly endorsed by the accepted audit prompt §13
  ("Если canonical URL использует business code, рекомендуется устранить
  misleading naming типа `[id]`… например `/app/payments/[code]`").
- The alternative UUID reading fails: no UUID lookup endpoint exists, no
  document defines one, and inventing one is forbidden.

Authority ranking applied (§3): accepted ADR (route shape + migration) →
canonical architecture (no conflicting rule) → accepted reports
(implementation continuity) → implementation → prior report interpretation.
No approved document actually conflicts once `[id]` is read as segment
notation rather than identifier semantics.

## 10. Security / Compatibility Analysis (no code changed)

Fresh probes at this baseline (frontend :3000 → backend :4000):

| Case | Result |
|---|---|
| valid `PAY-00000710` + authorized | 200 |
| anonymous | 401 `Missing access token` |
| non-existent `PAY-99999999` | 404 |
| UUID supplied where code expected | 404 (no polymorphic lookup) |
| malformed segment | 404 |

Object-level authorization is identifier-type-independent (permission guard
`finance.payment.read` before lookup); the compatibility route forwards the
same segment value and therefore preserves identical authorization
semantics. D4 storefront neutral-404 contract unchanged.

## 11. Final Canonical Contract

```text
Canonical Payment URL:  /app/payments/<segment>  (implemented file segment: [code])
URL identifier:         Payment business code `PAY-*` (unique, immutable)
Normative source:       ADR-OPS-001 §6 (route shape + migration of the code-based detail page); ADR-OPS-012 §21 (dedicated page primary); audit prompt §13 ([code] naming for business-code URLs); backend authority GET /finance/payments/:code (unchanged, no UUID endpoint)
Exact section:          UI-C1.2 reconciliation report §6 L188/L190; §21 L636/L644; same report L117 (descriptive [id] = code-based page)
Why this is semantic contract: the ADR's `[id]` is generic segment notation (never defined as UUID); the segment's value semantics were fixed before and preserved through the accepted migration — PAY-* business code — and every post-ADR implementation (C1.2F links, current code) uses the code; a UUID reading would require a non-existent, non-mandated API
```

## 12. Verdict

**VERDICT: A — CONTRACT CONFIRMED** (with documented notational nuance)

- ADR conflict: **NO** (notation only; semantic contract unambiguous).
- Implementation change required: **NO** — current implementation
  (`/app/payments/[code]` + kept redirect) conforms to the confirmed
  contract; URL values are identical to the ADR's intent.

## 13. Required Next Action

- None mandatory. Optional, non-blocking: the architecture owner may
  clarify ADR-OPS-001 §6 wording from `[id]` to `[code]` for the Payments
  entry (or add one sentence defining segment semantics). Per this task's
  §12, such a documentation edit is deliberately **not** performed here;
  this report is the reconciliation record.

## 14. Git Closure

- Documentation-only change: this report (+ task prompt file).
- Production files changed in this pass: none.
- Commit/push executed after this section was written; final SHA,
  origin/master parity, and clean tree are recorded in the commit block of
  the closing message (expected: HEAD == origin/master, clean).

## Final Table (§14 of the prompt)

| Entity | Canonical route | URL identifier | Backend lookup | Normative source | Status |
|---|---|---|---|---|---|
| Request | `/app/requests/[id]` | internal UUID | `findUnique({id})` | ADR-OPS-001 §6 + code chain (route→`:id`→id lookup) | CONFIRMED |
| Order | `/app/orders/[id]` | internal UUID | `findUnique({id})` | ADR-OPS-001 §6 + code chain | CONFIRMED |
| Booking | `/app/bookings/[id]` | internal UUID | `findUnique({id})` | ADR-OPS-001 §6 + code chain | CONFIRMED |
| Payment | `/app/payments/[code]` (ADR notation: segment `[id]`, value = code) | business code `PAY-*` | `findUnique({code})` | ADR-OPS-001 §6 + §21 + audit prompt §13 + backend `:code` authority (exact evidence in §4–§7 above) | CONFIRMED |
