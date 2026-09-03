# PHASE 3 — PRE-STEP 3.12 — GLOBAL CURRENCY PRESENTATION CONTRACT — REMEDIATION ROUND 2

## STATUS

**Task type:** Narrow runtime / semantic / evidence closure  
**Previous implementation SHA:** `379d207`  
**Current qualification:** `VERDICT B — NARROW RUNTIME / EVIDENCE CLOSURE REQUIRED`

This is **not** a rewrite of the Global Currency Presentation Contract.

Preserve the accepted shared `formatPrice()` architecture and the already migrated surfaces. Close only the remaining semantic, runtime, coverage, evidence and Git gaps.

Do **not** start GMV drill-down remediation, Cross-Entity Traceability, Cart/Checkout, Booking KPI Semantics, Finance Center, Reference Number work, or Step 3.12.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация по этой задаче должны быть преимущественно **на русском языке**.

Это относится к:

- Implementation / Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- findings explanations;
- root cause analysis;
- architecture decisions;
- runtime evidence descriptions;
- conclusions/recommendations;
- verdict explanations.

English допускается только для технических идентификаторов: paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, code snippets и стандартизированных `VERDICT`.

**Hard acceptance criterion:** преимущественно англоязычный отчёт считается незавершённым.

---

# 1. PRESERVE THE ACCEPTED CONTRACT

Do not replace the current architecture:

```text
DB / API / domain:
AZN
USD
EUR

Product UI:
AZN → ₼
USD → $
EUR → €
```

Continue to use one canonical shared formatter:

```text
formatPrice(...)
```

or the actual canonical shared helper already introduced.

Do not create per-page competing currency formatters.

---

# 2. HARD SEMANTIC FIX — ZERO IS NOT NULL

Audit the actual current behavior of `formatPrice()`.

The previous report stated both:

```text
Returns null for zero/null/empty values
```

and:

```text
Zero/null → "—"
```

This is not acceptable for financial presentation.

Canonical rule:

```text
0       → real monetary value
null    → no value
undefined → no value
empty invalid input → no value
```

Examples:

```text
formatPrice(0, "AZN", ...)   → 0 ₼
formatPrice(0, "USD", ...)   → 0 $
formatPrice(0, "EUR", ...)   → 0 €

null / undefined             → —
```

Exact thousands/decimal separators and symbol placement must follow the canonical locale-aware UI formatter, but **zero must remain visible as zero**.

This matters for legitimate values such as:

```text
К оплате: 0 ₼
Возвраты: 0 ₼
Комиссия: 0 ₼
Outstanding: 0 ₼
```

Do not conflate absence with numeric zero.

Add regression tests for this behavior.

---

# 3. COMMAND CENTER — MANDATORY COVERAGE

The previous report did not demonstrate `/app/command-center`.

This is a hard gap because Command Center was one of the surfaces where currency inconsistency was originally observed.

Audit and remediate all monetary values on:

```text
/app/command-center
```

including applicable:

- Executive Summary KPI;
- Financial KPI;
- Marketplace monetary KPI;
- Storefront SaaS monetary KPI;
- comparison values;
- cards;
- charts;
- axes;
- tooltips;
- totals;
- other monetary labels.

All must use the shared presentation contract where appropriate.

No local/hardcoded `AZN`, `USD`, `EUR`, `₼`, `$`, `€` formatting should compete with the shared formatter without an explicitly documented reason.

---

# 4. ANALYTICS — MANDATORY RE-QUALIFICATION

Re-check:

```text
/app/analytics
```

Do not rely only on the previous screenshot claim.

Verify monetary:

- KPI cards;
- GMV;
- Revenue;
- Net Revenue;
- Commission;
- Payments;
- Refunds;
- comparison values;
- charts;
- axes;
- tooltips;
- tables/details where present.

This task changes **currency presentation only**.

Do not change GMV formulas or drill-down destinations here.

---

# 5. RU / AZ / EN — MANDATORY

Runtime/browser evidence must cover all supported locales:

```text
RU
AZ
EN
```

The previous evidence covered only RU/EN.

Verify that number formatting and currency presentation remain coherent in all three locales.

For each locale record examples for available currencies.

At minimum demonstrate:

```text
AZN → ₼
USD → $
EUR → €
```

when representative runtime data for those currencies exists.

If a particular surface has no runtime record in one currency, use another already implemented representative surface or controlled test fixture. Do not fabricate production data merely for a screenshot.

---

# 6. AZN / USD / EUR RUNTIME EVIDENCE

Unit tests are necessary but insufficient.

Provide browser/runtime evidence that actual rendered UI uses:

```text
AZN → ₼
USD → $
EUR → €
```

Required priority surfaces:

1. Command Center;
2. Analytics;
3. Payments / financial view;
4. one operational surface such as Orders or Bookings;
5. Partner/Storefront monetary surface if currently implemented.

If Command Center/Analytics do not naturally contain all three currencies, demonstrate their existing currency population accurately and use other surfaces to prove the remaining currency rendering.

Do not claim a currency was browser-verified if it was only unit-tested.

---

# 7. REPOSITORY-WIDE REMAINING OCCURRENCE AUDIT

After remediation, perform a repository-wide audit for remaining currency presentation patterns.

Search at minimum for relevant occurrences of:

```text
AZN
USD
EUR
₼
$
€
.toFixed(
Intl.NumberFormat
toLocaleString
```

Also search for interpolation patterns equivalent to:

```text
{amount} {currency}
`${amount} ${currency}`
```

and local currency formatter helpers.

Do not mechanically replace every ISO occurrence.

Classify every relevant remaining user-facing occurrence as:

```text
VALID EXCEPTION
```

or:

```text
DEFECT
```

Examples of valid exceptions may include:

- API/domain types;
- backend;
- DB/schema;
- currency selector;
- CSV/XLSX export;
- reconciliation;
- accounting/audit;
- PSP diagnostics;
- explicit financial document where ISO is required.

Normal KPI/table/detail monetary rendering using raw ISO without justified UX reason = defect.

Final report must include a concise remaining-occurrence matrix.

---

# 8. DO NOT CALL `frontend/lib/api.ts` A UI SURFACE

The previous report counted modified files as “14 frontend surfaces”, but one listed file was:

```text
frontend/lib/api.ts
```

and its change concerned `referenceNumber`.

Correct the evidence language.

Distinguish:

```text
modified files
UI surfaces
shared infrastructure
unrelated/pre-existing changes
```

Do not use file count as proof that all monetary UI surfaces were covered.

---

# 9. FRONTEND TYPECHECK — REPORT FACTUALLY

Run the actual frontend typecheck.

If it returns any error, report:

```text
Global frontend typecheck: FAIL
```

even if the error is pre-existing and unrelated.

Then separately state:

```text
Currency remediation scope: PASS
Known unrelated blocker: <exact error>
```

Do not report:

```text
Frontend typecheck: PASS (pre-existing error only)
```

if the command itself fails.

If the previously known `storefrontSessions` error has since been fixed by another committed change, prove that with actual current typecheck output rather than assuming it.

---

# 10. BACKEND / API CONTRACT

Re-confirm that the remediation did not mutate domain currency representation.

Backend/API must continue to use ISO codes:

```text
AZN
USD
EUR
```

Do not serialize `$`, `₼`, `€` as canonical currency identifiers.

Provide representative API evidence.

---

# 11. MULTI-CURRENCY SEMANTICS

Presentation changes must not introduce cross-currency summation.

Preserve:

```text
AZN total
USD total
EUR total
```

as separate native-currency totals unless an authoritative FX/reporting conversion contract explicitly applies.

No remediation in this task may silently change financial formulas.

---

# 12. TESTS — REQUIRED

Update/add shared formatter tests.

Minimum required cases:

### Symbols

```text
AZN → ₼
USD → $
EUR → €
```

### Zero semantics

```text
0 AZN → visible zero
0 USD → visible zero
0 EUR → visible zero
```

### Absence semantics

```text
null → —
undefined → —
```

according to actual helper/component contract.

### Values

- integer;
- decimal;
- negative;
- large amount;
- unknown currency fallback.

### Locales

- RU;
- AZ;
- EN.

Add/update component/integration coverage for at least:

- Command Center;
- Analytics;
- one operational surface;
- Payments/financial surface.

Do not weaken existing tests merely to obtain green output.

---

# 13. BROWSER / RUNTIME EVIDENCE — HARD GATE

Run the application and verify actual rendered UI.

For each evidence item report:

```text
Route:
Locale:
Currency:
Rendered value:
Expected:
Result:
Evidence artifact:
```

Minimum routes:

```text
/app/command-center
/app/analytics
/app/finance/payments
/app/orders OR /app/bookings
```

and applicable Partner/Storefront monetary route if implemented.

Screenshots must be current to this remediation run, not merely described as “pre-existing sessions” without proving they reflect the current commit.

Runtime/browser observation outranks source-level claims.

---

# 14. COMMAND CENTER / ANALYTICS CONSISTENCY MATRIX

Include a matrix similar to:

| Surface | Currency | Example rendered | Shared formatter | Result |
|---|---|---|---|---|
| Command Center | AZN | ... | YES | PASS |
| Command Center | USD | .../N/A | YES | PASS/N/A |
| Command Center | EUR | .../N/A | YES | PASS/N/A |
| Analytics | AZN | ... | YES | PASS |
| Analytics | USD | ... | YES | PASS |
| Analytics | EUR | ... | YES | PASS |

`N/A` must be justified by actual dataset/surface semantics.

Do not fabricate monetary cards just to avoid `N/A`.

---

# 15. ROADMAP

Verify that the existing additive roadmap entry accurately records:

```text
GLOBAL CURRENCY PRESENTATION CONTRACT

DB/API:
ISO 4217

Product UI:
AZN → ₼
USD → $
EUR → €
```

If Round 2 changes semantics for zero handling, add that clarification additively.

Do not rewrite previous history.

Record real implementation/remediation SHA.

---

# 16. GIT / SHA EVIDENCE — HARD GATE

The previous report only gave:

```text
379d207
```

Final closure requires:

```text
Starting SHA:
Previous Currency Implementation SHA: 379d207...
Round 2 Remediation SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```

Commit intended Round 2 changes.

Push to the intended branch.

Hard gate:

```text
HEAD == origin/master
```

unless repository branch configuration proves another canonical tracked branch; if so document it explicitly.

Do not issue final `VERDICT A` while the final remediation commit exists only locally.

---

# 17. REQUIRED ACCEPTANCE MATRIX

Final report must contain:

| Gate | Result |
|---|---|
| Shared formatter preserved | PASS/FAIL |
| DB/API remain ISO | PASS/FAIL |
| AZN → ₼ | PASS/FAIL |
| USD → $ | PASS/FAIL |
| EUR → € | PASS/FAIL |
| Zero remains monetary zero | PASS/FAIL |
| Null/undefined remain absence | PASS/FAIL |
| RU runtime | PASS/FAIL |
| AZ runtime | PASS/FAIL |
| EN runtime | PASS/FAIL |
| Command Center runtime | PASS/FAIL |
| Analytics runtime | PASS/FAIL |
| Payments runtime | PASS/FAIL |
| Operational surface runtime | PASS/FAIL |
| Partner/Storefront applicable runtime | PASS/FAIL/N/A |
| Charts/tooltips audited | PASS/FAIL |
| Multi-currency semantics preserved | PASS/FAIL |
| Remaining occurrences classified | PASS/FAIL |
| Unit tests | PASS/FAIL |
| Component/integration tests | PASS/FAIL |
| Frontend typecheck actual status | PASS/FAIL |
| Backend/API ISO verification | PASS/FAIL |
| Roadmap updated/verified | PASS/FAIL |
| Git synchronized | PASS/FAIL |

Do not convert a failing command into `PASS (scope)`.

Scope-specific status may be reported separately.

---

# 18. REQUIRED FINAL REPORT STRUCTURE

Produce the final report predominantly in Russian:

```text
1. Executive Summary
2. Starting Repository / Git State
3. Round 1 Findings Re-Qualification
4. Zero vs Null Semantic Audit
5. Remediation Implemented
6. Shared Formatter Contract
7. Command Center Audit
8. Analytics Audit
9. Payments / Operational Audit
10. Partner / Storefront Audit
11. RU / AZ / EN Runtime Evidence
12. AZN / USD / EUR Runtime Evidence
13. Charts / Tooltip Audit
14. Remaining Occurrence Audit
15. Multi-Currency Verification
16. Backend / API ISO Verification
17. Unit / Component / Integration Tests
18. Frontend Typecheck Actual Status
19. Roadmap Evidence
20. Git / SHA Evidence
21. Residual Gaps
22. Acceptance Matrix
23. Final Verdict
```

---

# 19. VERDICT RULES

## VERDICT A

Allowed only when all hard gates are genuinely satisfied.

In particular:

- `0` is rendered as a real monetary zero, not as missing data;
- Command Center is actually audited/runtime-verified;
- Analytics is runtime-verified;
- RU/AZ/EN are covered;
- AZN/USD/EUR are runtime-proven where representative data allows;
- remaining ISO/symbol occurrences are classified;
- DB/API remain ISO;
- actual frontend typecheck status is reported truthfully;
- roadmap is synchronized;
- final Git commit is pushed and `HEAD == origin`.

## VERDICT B

Required if any hard gate remains unresolved.

Do not issue:

```text
VERDICT A — с оговорками
```

for an actual hard-gate failure.

---

# 20. STOP CONDITION

After Round 2:

**STOP.**

Do not automatically start:

- GMV drill-down remediation;
- Cross-Entity Business Reference & Traceability;
- Cart / Checkout;
- Booking KPI Semantics;
- Finance Center;
- Reference Number Strict Review;
- Final Re-Qualification;
- Step 3.12.

The next stage will be selected separately after review.
