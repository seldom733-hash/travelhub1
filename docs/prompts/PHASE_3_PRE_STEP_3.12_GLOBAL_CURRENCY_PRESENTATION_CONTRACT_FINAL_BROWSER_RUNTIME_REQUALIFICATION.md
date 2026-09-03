# PHASE 3 — PRE-STEP 3.12 — GLOBAL CURRENCY PRESENTATION CONTRACT — FINAL BROWSER / RUNTIME RE-QUALIFICATION

## STATUS

**Task type:** Evidence-only / runtime final re-qualification  
**Currency implementation SHA:** `5409dd3`  
**Auth/runtime restoration SHA:** `17b2bed`  
**Current state:** Currency implementation/static/unit qualification completed; normal browser login restored. Final browser/runtime qualification remains open.

This task is **NOT a new Currency implementation round**.

Do not redesign the formatter or change business formulas unless runtime evidence reveals a concrete currency-presentation defect.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**.

Это относится к:

- Runtime / Evidence Report;
- Strict Re-Qualification Report;
- findings explanations;
- root cause analysis;
- defect descriptions;
- conclusions;
- acceptance matrix explanations;
- verdict explanations.

English допускается только для technical identifiers: file paths, class/method names, API endpoints, HTTP methods/status codes, CLI/Git commands, enums, code snippets, currency codes и standardized `VERDICT`.

**Hard acceptance criterion:** преимущественно англоязычный отчёт считается незавершённым.

---

# 1. PURPOSE

Теперь normal browser authentication восстановлена.

Необходимо выполнить ранее отсутствовавшую **реальную browser/runtime qualification** Global Currency Presentation Contract.

Проверить фактический rendered UI, а не только:

```text
source code
unit tests
code audit
```

Canonical principle:

```text
Browser/runtime observation
>
source-level claim
```

---

# 2. PRESERVE CANONICAL CONTRACT

Expected:

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

Zero/absence:

```text
0 → visible monetary zero
null / undefined → absence marker
```

Do not change DB/API currency identifiers to symbols.

Do not introduce FX conversion.

Do not sum unrelated currencies.

---

# 3. LOGIN / ENVIRONMENT PRECONDITION

Use the normal browser authentication path restored in the previous remediation.

Before qualification prove:

```text
/login
→ valid legitimate test/admin credentials
→ authenticated session
→ /app/dashboard
```

Do not bypass auth.

Do not include plaintext password/token/hash in the report.

Record:

```text
Final HEAD:
Runtime DB:
Frontend URL:
Backend/API URL:
Locale:
Authenticated role:
```

without exposing secrets.

---

# 4. REQUIRED RUNTIME SURFACES — HARD GATE

Browser-verify actual rendered monetary values on:

```text
/app/command-center
/app/analytics
/app/finance/payments
/app/orders
/app/bookings
```

Also verify applicable Partner/Storefront monetary surface if it is currently implemented and accessible through legitimate workspace context.

For each route inspect all applicable:

- KPI cards;
- monetary summary cards;
- aggregate summaries;
- tables;
- details;
- comparison values;
- charts;
- axes;
- legends;
- tooltips;
- empty/zero states;
- currency labels.

---

# 5. COMMAND CENTER — MANDATORY

On:

```text
/app/command-center
```

inspect all monetary cards/sections.

At minimum where present:

- GMV;
- Revenue;
- Net Revenue;
- Commission;
- Payments;
- Refunds;
- Marketplace monetary KPI;
- Storefront SaaS monetary KPI;
- comparison values.

Verify actual rendered symbol and number.

Do not change GMV drill-down destination in this task.

Do not change financial formulas.

---

# 6. ANALYTICS — MANDATORY

On:

```text
/app/analytics
```

verify:

- GMV;
- Revenue;
- Net Revenue;
- Commission;
- Payments;
- Refunds;
- monetary tables;
- period comparison values;
- charts/tooltips where monetary.

This task verifies presentation only.

Do not remediate Analytics business semantics unless a direct currency-presentation defect is found.

---

# 7. PAYMENTS — MANDATORY

On:

```text
/app/finance/payments
```

verify:

- amount column;
- totals/aggregate summary;
- payment detail if available;
- currency-specific filters;
- zero amount if representative data exists;
- multi-currency separation.

Currency selector/filter may legitimately show ISO codes:

```text
AZN
USD
EUR
```

That is not automatically a defect.

---

# 8. ORDERS / BOOKINGS — MANDATORY

Verify:

```text
/app/orders
/app/bookings
```

including:

- monetary totals;
- aggregate summaries;
- table values;
- detail pages if accessible;
- zero values where present.

Do not perform Booking KPI Semantics remediation here.

---

# 9. PARTNER / STOREFRONT — APPLICABLE RUNTIME

If Partner/Storefront workspace is currently accessible with legitimate test credentials/context, verify at least one monetary surface.

Preserve workspace isolation.

Do not expose Storefront customer commerce inside Platform scope merely to obtain evidence.

If no legitimate Partner runtime context is currently available, report:

```text
N/A — reason
```

rather than fabricating evidence.

---

# 10. RU / AZ / EN — HARD GATE

Browser verification must cover all supported locales:

```text
RU
AZ
EN
```

For each locale verify actual rendered monetary values.

Do not substitute unit-test output for runtime evidence.

Minimum evidence matrix:

| Locale | Browser verified | Example route | Example value | Result |
|---|---|---|---|---|
| RU | YES/NO | ... | ... | PASS/FAIL |
| AZ | YES/NO | ... | ... | PASS/FAIL |
| EN | YES/NO | ... | ... | PASS/FAIL |

---

# 11. AZN / USD / EUR — HARD GATE

We need actual browser evidence for all currencies available in representative data:

```text
AZN → ₼
USD → $
EUR → €
```

Do not claim USD/EUR runtime qualification from unit tests.

First inspect the representative dataset and determine where real USD/EUR records exist.

If USD/EUR records exist, navigate to those records/surfaces and capture actual rendered evidence.

If a currency genuinely does not exist in any representative runtime data, report:

```text
NOT RUNTIME-QUALIFIABLE — no representative data
```

and provide DB/API count evidence proving absence.

Do **not** silently convert this to PASS.

Do not fabricate production records merely to force a screenshot.

---

# 12. ZERO RUNTIME SEMANTICS

Search representative data for a legitimate zero monetary value.

If one exists, prove browser rendering:

```text
0 AZN → visible 0 ₼
```

or equivalent locale-specific representation.

If no legitimate zero-valued runtime record exists:

```text
Runtime zero evidence: N/A — no representative zero record
Unit regression: PASS
```

Do not create misleading business records solely for evidence.

---

# 13. NULL / ABSENCE RUNTIME SEMANTICS

Where an optional monetary value is genuinely absent, verify that UI does not render:

```text
null
undefined
NaN
0 [when value is actually absent]
```

Expected absence marker should follow canonical UI behavior, e.g.:

```text
—
```

Do not confuse absence with numeric zero.

---

# 14. CHART / TOOLTIP RUNTIME AUDIT

For monetary charts actually present:

- hover real data points;
- inspect tooltip;
- inspect axis/legend where applicable;
- verify symbol formatting;
- verify locale formatting;
- verify no raw `AZN/USD/EUR` appears as accidental amount suffix unless the context intentionally requires ISO.

A chart with only counts/percentages is:

```text
N/A — non-monetary
```

not a currency PASS.

---

# 15. MULTI-CURRENCY RUNTIME SEMANTICS

Verify that UI does not display an invalid combined total such as:

```text
100 AZN + 50 USD + 20 EUR = 170
```

without authoritative FX.

Expected native totals remain separated:

```text
AZN total
USD total
EUR total
```

unless an existing authoritative reporting FX contract explicitly applies.

No FX implementation in this task.

---

# 16. API / UI PAIR EVIDENCE

For representative AZN/USD/EUR records, where possible capture:

```text
API:
currency = USD
amount = 1250.50

UI:
$1,250.50
```

or locale-equivalent rendering.

This proves:

```text
ISO domain/API
→ shared presentation formatter
→ symbol UI
```

Use real record IDs/referenceNumbers where safe.

---

# 17. SCREENSHOT / BROWSER EVIDENCE FORMAT

For each major proof record:

```text
Route:
Workspace:
Locale:
Record/KPI:
API currency:
API amount:
Rendered UI:
Expected UI:
Result:
Screenshot:
```

Screenshots must come from the current runtime/commit.

Do not reuse stale screenshots from previous remediation rounds.

---

# 18. DEFECT HANDLING

If runtime reveals a genuine currency-presentation defect:

1. record the defect first;
2. identify exact root cause;
3. make the smallest shared-contract-consistent fix;
4. add regression coverage;
5. rerun affected runtime surface;
6. create a remediation commit;
7. report both pre-fix and post-fix evidence.

Do not broaden scope into unrelated business logic.

If no defect is found, this task should remain evidence-only.

---

# 19. NEGATIVE MONETARY VALUES — AUDIT, DO NOT REDESIGN BLINDLY

Current formatter behavior reportedly treats negative values as invalid/null.

Audit whether any currently implemented legitimate financial surface can contain signed monetary values such as:

- adjustments;
- reversals;
- FX gain/loss;
- ledger entries;
- corrections.

If no current applicable surface uses signed money:

```text
Current runtime applicability: N/A
Future finance concern: RECORDED
```

Do not redesign the formatter solely from speculation.

If current legitimate negative monetary values exist and are incorrectly hidden, classify as a real defect and remediate narrowly.

---

# 20. FRONTEND TYPECHECK — FACTUAL STATUS

Run current frontend typecheck.

Previously known issue:

```text
storefrontSessions type mismatch
```

Report actual current result.

If FAIL:

```text
Global frontend typecheck: FAIL
Currency runtime qualification: PASS/FAIL separately
Known unrelated blocker: ...
```

Do not convert actual FAIL into global PASS.

---

# 21. AUTH / SCHEMA INFRASTRUCTURE — OBSERVATION ONLY

Normal login is now available.

Do not reopen the previous Schema Drift remediation in this task unless auth/runtime fails again.

Known infrastructure closure still requiring separate final evidence may include:

- actual isolated fresh-DB migration reproduction;
- verification that migration does not unconditionally reset an existing admin password;
- disabled-user auth test where applicable.

These are **not** to be silently marked resolved by this Currency report.

---

# 22. ROADMAP

Update the canonical roadmap additively only after the actual runtime qualification result is known.

If all Currency runtime hard gates pass, record:

```text
GLOBAL CURRENCY PRESENTATION CONTRACT
→ FINAL BROWSER / RUNTIME RE-QUALIFICATION COMPLETED
```

with real final SHA/evidence.

If a hard gate remains unverified, keep status open.

Do not rewrite prior history.

---

# 23. GIT / SHA EVIDENCE

Report:

```text
Starting SHA:
Currency implementation SHA: 5409dd3
Auth/runtime restoration SHA: 17b2bed
Runtime qualification SHA / report SHA:
Final HEAD:
origin/master:
HEAD == origin:
Working tree clean:
```

If evidence-only and no source code changed, still record exact HEAD used for qualification.

If roadmap/report changes are committed, provide their real SHA.

Do not hide unrelated dirty files.

---

# 24. REQUIRED RUNTIME MATRIX

Final report must include:

| Surface | RU | AZ | EN | AZN | USD | EUR | Browser evidence | Result |
|---|---|---|---|---|---|---|---|---|
| Command Center | | | | | | | | |
| Analytics | | | | | | | | |
| Payments | | | | | | | | |
| Orders | | | | | | | | |
| Bookings | | | | | | | | |
| Partner/Storefront | | | | | | | | |

Use:

```text
PASS
FAIL
N/A — justified
NOT VERIFIED
```

Do not use `PASS (code audit)` in a browser-runtime matrix.

---

# 25. REQUIRED ACCEPTANCE MATRIX

| Gate | Result |
|---|---|
| Normal browser login works | PASS/FAIL |
| Command Center browser verified | PASS/FAIL |
| Analytics browser verified | PASS/FAIL |
| Payments browser verified | PASS/FAIL |
| Orders browser verified | PASS/FAIL |
| Bookings browser verified | PASS/FAIL |
| Partner/Storefront applicable browser verified | PASS/FAIL/N/A |
| RU browser runtime | PASS/FAIL |
| AZ browser runtime | PASS/FAIL |
| EN browser runtime | PASS/FAIL |
| AZN runtime rendering | PASS/FAIL/NOT QUALIFIABLE |
| USD runtime rendering | PASS/FAIL/NOT QUALIFIABLE |
| EUR runtime rendering | PASS/FAIL/NOT QUALIFIABLE |
| Zero semantics runtime | PASS/FAIL/N/A |
| Null/absence semantics runtime | PASS/FAIL/N/A |
| Monetary chart/tooltips runtime | PASS/FAIL/N/A |
| API ISO → UI symbol mapping proven | PASS/FAIL |
| Multi-currency separation preserved | PASS/FAIL |
| Negative-money applicability audited | PASS/FAIL |
| Currency unit regression remains green | PASS/FAIL |
| Frontend typecheck actual status reported | PASS/FAIL |
| Currency business formulas unchanged | PASS/FAIL |
| Currency drill-down semantics unchanged | PASS/FAIL |
| Roadmap truthful | PASS/FAIL |
| Git state documented | PASS/FAIL |

---

# 26. FINAL REPORT STRUCTURE — MANDATORY

Отчёт преимущественно на русском:

```text
1. Executive Summary
2. Qualification Environment / SHA
3. Authentication Precondition
4. Command Center Runtime Evidence
5. Analytics Runtime Evidence
6. Payments Runtime Evidence
7. Orders Runtime Evidence
8. Bookings Runtime Evidence
9. Partner / Storefront Runtime Evidence
10. RU / AZ / EN Runtime Matrix
11. AZN / USD / EUR Runtime Evidence
12. Zero vs Null Runtime Evidence
13. Chart / Tooltip Runtime Audit
14. Multi-Currency Runtime Verification
15. API ISO → UI Symbol Evidence
16. Negative Monetary Value Applicability
17. Defects Found / Remediation Performed
18. Tests / Frontend Typecheck
19. Known Infrastructure Residuals
20. Canonical Roadmap Evidence
21. Git / SHA Evidence
22. Runtime Matrix
23. Acceptance Matrix
24. Residual Gaps
25. Final Verdict
```

---

# 27. VERDICT RULES

## VERDICT A — FINAL CURRENCY CONTRACT QUALIFIED

Allowed only when required browser/runtime gates are actually satisfied.

A unit test cannot substitute for runtime.

A code audit cannot substitute for runtime.

For a currency genuinely absent from representative data, use truthful:

```text
NOT RUNTIME-QUALIFIABLE
```

and determine verdict according to whether the contract required representative runtime coverage and whether authoritative absence is proven. Do not fabricate PASS.

## VERDICT B — RUNTIME QUALIFICATION INCOMPLETE / DEFECT FOUND

Required if:

- Command Center or Analytics was not browser-verified;
- required locale was not browser-verified;
- existing representative USD/EUR data was not checked;
- actual UI shows incorrect currency presentation;
- multi-currency totals are invalid;
- runtime cannot be accessed again;
- evidence is substituted by code audit/unit tests.

---

# 28. STOP CONDITION

After this final Currency re-qualification:

**STOP.**

Do not automatically start:

- Prisma Fresh-DB Evidence Closure;
- Reference Number Strict Review;
- GMV / Financial KPI Drill-down;
- Cross-Entity Business Reference & Traceability;
- Booking KPI Semantics;
- Finance Center;
- Final PRE-STEP 3.12 Re-Qualification;
- Step 3.12.

Return the report for independent review before selecting the next task.
