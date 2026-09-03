# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R.2A --- FINAL VISUAL RUNTIME EVIDENCE CLOSURE

### CUSTOMER 360 + PARTNER 360 / GLOBAL RELATED-ENTITY DISPLAY INTEGRITY / EVIDENCE-ONLY QUALIFICATION

**Все ответы разработчика, evidence и итоговый отчёт --- строго на
русском.**

------------------------------------------------------------------------

# 1. PURPOSE

Это **короткий evidence-only closure round**.

После Round 2E.2R.2 пользователь визуально подтвердил, что в реальном
runtime исправились отображаемые названия связанных сущностей:

``` text
Partner → human-readable partner/company name
Customer/User → human-readable person/customer name
Service/Product → human-readable service/product title
и другие проверенные related references
```

Вместо UUID теперь визуально отображаются корректные business labels.

Поэтому:

**НЕ выполнять новый remediation/refactor, если runtime-проверка не
обнаружит реальный дефект.**

Цель Round 2E.2R.2A --- формально закрыть недостающий evidence и
подтвердить, что исправление действительно глобально работает на
Customer 360 и Partner 360.

------------------------------------------------------------------------

# 2. BASELINE

Previous reported state:

``` text
Round 2E.2R.2 implementation commit: a297932
origin/master: a297932
Backend: 1236/1236 PASS
Frontend: 243/243 PASS
Schema: 0
Migration: 0
```

Previous runtime root cause:

``` text
backend dist был stale;
изменения source не были реально запущены;
после rebuild + restart API начал возвращать display fields.
```

Known runtime cases after restart included:

``` text
Customer:
b764c1cc-8036-463e-1186-1350a6f58cf9
→ Marie Park

Partner:
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
→ Baku Tours Pro

Booking → Order:
ORD-00000510

Booking → Service:
Gabala Adventure Day Trip
```

Actual repository/runtime remains authority.

------------------------------------------------------------------------

# 3. STATUS BEFORE THIS ROUND

Until evidence closure is complete:

``` text
Round 2E.2R.2 — IMPLEMENTATION COMPLETE / FINAL EVIDENCE PENDING
Round 2E.2R.2A — CURRENT
Step 3.5.3 — NOT YET FINALLY RE-CLOSED
Step 3.5A — BLOCKED / NOT STARTED
```

------------------------------------------------------------------------

# 4. REPOSITORY CHECK

Before validation:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -40
```

Expected:

``` text
HEAD = a297932 or legitimate descendant
a297932 reachable
85511ec reachable
e4b38a3 reachable
1a3aa23 reachable
```

Report exact actual values.

Do not reset/reseed DB.

Do not modify production code merely to generate evidence.

------------------------------------------------------------------------

# 5. CLEAN RUNTIME IS MANDATORY

Because the previous failure was caused by stale backend `dist`, runtime
provenance is a mandatory gate.

Before browser validation:

1.  stop relevant backend/frontend processes;
2.  rebuild changed applications using canonical repository commands;
3.  restart them from current checkout;
4.  confirm API/UI are responding;
5.  hard reload browser.

Capture evidence that running backend corresponds to current
source/build.

Do not rely on an old process.

------------------------------------------------------------------------

# 6. CUSTOMER 360 --- FINAL VISUAL AUDIT

Inventory all **actual visible Customer 360 tabs**.

For every tab containing a table/list and selectable/openable records:

1.  open the tab;
2.  inspect visible rows;
3.  open representative records;
4.  inspect the selected-record/detail view;
5.  inspect every related-entity reference already present in that UI.

Check, where applicable:

``` text
Customer/User
Partner
Order
Booking
Payment
Service/Product/Listing
Employee/Owner/Assignee
other actual related entity references
```

Required rule:

``` text
visible label = canonical human-readable business value
href/internal identity = canonical UUID/ID
```

No resolvable UUID may remain as primary visible text.

------------------------------------------------------------------------

# 7. PARTNER 360 --- FINAL VISUAL AUDIT

Perform the same validation for **all actual visible Partner 360 tabs**
containing table/list/selectable records.

Do not assume tab names from the prompt.

First inventory actual runtime tabs, then validate them.

For each applicable tab:

``` text
table/list
→ representative row
→ selected detail
→ related references
→ visible label
→ href
→ click destination
```

------------------------------------------------------------------------

# 8. TABLE ↔ DETAIL PARITY

For each applicable record type verify both:

``` text
TABLE/LIST
and
SELECTED RECORD / DETAIL
```

Examples of FAIL:

``` text
Table = Baku Tours Pro
Detail = aad76dd9-...
```

or:

``` text
Table = Marie Park
Detail = b764c1cc-...
```

Both surfaces must use the same canonical entity identity/display
semantics.

------------------------------------------------------------------------

# 9. KNOWN REGRESSION CASES

If these records still exist, explicitly re-check them:

``` text
Customer:
b764c1cc-8036-463e-1186-1350a6f58cf9

Partner:
aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

Required evidence:

``` text
visible label
href
click target
```

Expected visible labels based on previous runtime evidence:

``` text
Customer → Marie Park
Partner → Baku Tours Pro
```

If canonical data has changed, report actual DB/API value rather than
hardcoding the old display value.

------------------------------------------------------------------------

# 10. BUSINESS OBJECT REFERENCES

Where these references exist in actual UI, verify:

``` text
Order   → ORD-... business code
Booking → BKG-... business code
Payment → PAY-... business code
Service/Product/Listing → canonical title/name
```

UUID may remain internal/href but not primary visible label when a
canonical business value exists.

------------------------------------------------------------------------

# 11. DEEP LINKS

For every related entity type actually encountered, perform
representative click validation.

Required:

``` text
human-readable visible label
→ canonical href
→ click
→ correct target entity/detail/360 page
```

Correct label + wrong target = FAIL.

------------------------------------------------------------------------

# 12. RU / AZ / EN

Run visual validation in:

``` text
RU
AZ
EN
```

At minimum, ensure affected CRM 360 surfaces do not contain:

``` text
raw i18n keys
raw enums
mixed-locale UI labels
UUIDs as resolvable primary labels
```

Business names/codes are canonical content and are not translated merely
to match UI locale.

------------------------------------------------------------------------

# 13. PARTNER PAYMENTS RECONCILIATION

Confirm once more the actual runtime topology.

Previous Round 2E.2R.2 reported that:

``` text
Partner 360 itself has no Payments tab;
the Payments tab observed by the user belonged to a Partner-related Customer detail panel.
```

Verify actual routes/components/tabs and record the result.

Do not create a new Payments tab.

If Partner 360 Payments is truly absent:

``` text
Partner 360 Payments = N/A by actual product topology
```

------------------------------------------------------------------------

# 14. FILTER / I18N REGRESSION

Smoke-check preservation of prior fixes:

``` text
Customer Orders status
Customer Bookings status
Customer Payments status
Partner Orders status
Partner Bookings status
Partner Users status
crm.col.partner
```

Required:

``` text
no duplicate filters
localized labels/options
existing filter functionality preserved
```

This is regression verification, not redesign.

------------------------------------------------------------------------

# 15. ACTIVITY / NOTES REGRESSION

Smoke-check:

``` text
Customer Activity
Partner Activity
Customer Notes
Partner Notes
```

Required:

``` text
Activity opens
Notes opens
no raw keys
no obvious authorization/runtime regression
```

History must remain removed.

------------------------------------------------------------------------

# 16. EVIDENCE MATRIX --- REQUIRED

Fill completely for every actual in-scope tab.

  -------------------------------------------------------------------------------------------------------
  Context    Tab     Table/list   Record   Related      UUID Deep-link        RU      AZ      EN Result
                        checked   opened    labels   leakage result                              
                                           checked                                               
  ---------- ----- ------------ -------- --------- --------- ----------- ------- ------- ------- --------
  Customer   ...                                                                                 
  360                                                                                            

  Partner    ...                                                                                 
  360                                                                                            
  -------------------------------------------------------------------------------------------------------

Do not leave actual in-scope tabs unreported.

For non-selectable/non-related tabs, mark the precise reason as `N/A`.

------------------------------------------------------------------------

# 17. RELATED-ENTITY MATRIX --- REQUIRED

  --------------------------------------------------------------------------------------------
  Context    Tab      Related entity  Visible   Internal/href        Click       UUID Result
                      type            value     ID                  target visible as 
                                                                   correct     label? 
  ---------- -------- --------------- --------- --------------- ---------- ---------- --------
  Customer   ...      Customer/User                                                   
  360                                                                                 

  Customer   ...      Partner                                                         
  360                                                                                 

  Partner    ...      Customer/User                                                   
  360                                                                                 

  Partner    ...      Partner                                                         
  360                                                                                 
  --------------------------------------------------------------------------------------------

Continue for Order, Booking, Payment, Service/Product/Listing and every
other actual related entity type encountered.

------------------------------------------------------------------------

# 18. NO NEW CODE UNLESS A REAL DEFECT IS FOUND

Default expected result:

``` text
production code changes = 0
schema changes = 0
migration changes = 0
```

If validation discovers a real remaining defect:

**STOP the evidence-only closure.**

Do not silently fix it inside this round.

Report:

``` text
VERDICT B
exact surface
exact record
expected
actual
API evidence
browser evidence
suspected layer
```

A separate remediation round will then be required.

------------------------------------------------------------------------

# 19. TEST POLICY

Because this is evidence-only:

Do not rerun expensive full suites merely to reproduce already-recorded
`a297932` test evidence unless repository state changed or runtime
validation indicates regression.

At minimum verify the existing recorded baseline and run targeted
smoke/validation necessary for runtime confidence.

If any code is changed unexpectedly, full qualification becomes
mandatory and this round is no longer evidence-only.

Recorded baseline to preserve:

``` text
Backend 1236/1236 PASS
Frontend 243/243 PASS
Skipped 0
TSC PASS
Build PASS
```

------------------------------------------------------------------------

# 20. ROADMAP / REPORT

If all visual/runtime gates PASS:

update documentation additively only.

Record:

``` text
Round 2E.2R.1 — superseded / invalidated by runtime
Round 2E.2R.2 — implementation completed at a297932
Round 2E.2R.2A — final visual runtime evidence closure PASS
Step 3.5.3 — RE-CLOSED
```

Preserve Workforce Step 3.50 and all previous history.

Do not renumber stages.

------------------------------------------------------------------------

# 21. REPORT FILE

Create:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_POST_CLOSURE_ROUND_2E_2R_2A_FINAL_VISUAL_RUNTIME_EVIDENCE_CLOSURE_REPORT.md
```

Report in Russian.

------------------------------------------------------------------------

# 22. GIT DISCIPLINE

If only report/roadmap documentation changes are required:

stage exact documentation files only.

Before staging:

``` bash
git diff --check
git status --short
git diff
```

Forbidden:

``` bash
git add .
git add -A
git push --force
```

After commit/push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Required:

``` text
HEAD == origin/master
```

If no repository changes are necessary under actual project conventions,
explicitly report that and do not create a meaningless commit.

------------------------------------------------------------------------

# 23. VERDICT A GATES

VERDICT A is allowed only if:

1.  repository baseline captured;
2.  `a297932` preserved/reachable;
3.  runtime rebuilt/restarted from current checkout;
4.  stale backend process excluded;
5.  actual Customer 360 tabs inventoried;
6.  actual Partner 360 tabs inventoried;
7.  every actual table/list/selectable CRM 360 surface classified;
8.  representative records opened on every applicable tab;
9.  table labels checked;
10. selected-detail labels checked;
11. table/detail parity PASS;
12. known Customer regression case PASS;
13. known Partner regression case PASS;
14. Customer/User visible labels PASS;
15. Partner visible labels PASS;
16. Order business-code labels PASS where applicable;
17. Booking business-code labels PASS where applicable;
18. Payment business-code labels PASS where applicable;
19. Service/Product/Listing labels PASS where applicable;
20. resolvable UUID visible-label leakage = 0;
21. deep links PASS;
22. RU PASS;
23. AZ PASS;
24. EN PASS;
25. raw i18n keys = 0 on affected surfaces;
26. raw enums = 0 on affected surfaces;
27. mixed-locale UI = 0 on affected surfaces;
28. Partner Payments topology reconciled;
29. previous status filters preserved;
30. `crm.col.partner` preserved;
31. Customer Activity smoke PASS;
32. Partner Activity smoke PASS;
33. Customer Notes smoke PASS;
34. Partner Notes smoke PASS;
35. History remains removed;
36. no new production defect discovered;
37. production code changes = 0;
38. schema changes = 0;
39. migration changes = 0;
40. evidence matrix complete;
41. related-entity matrix complete;
42. report created;
43. roadmap/history updated additively if required;
44. Workforce history preserved;
45. P0 = 0;
46. P1 = 0;
47. unresolved in-scope P2 = 0;
48. HEAD == origin/master if documentation commit created;
49. Step 3.5A not started.

------------------------------------------------------------------------

# 24. VERDICT RULE

Success:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R.2A /
FINAL VISUAL RUNTIME EVIDENCE CLOSURE /
CUSTOMER 360 + PARTNER 360 /
GLOBAL RELATED-ENTITY DISPLAY INTEGRITY /
FULLY CLOSED

ROUND 2E.2R.2 — VERIFIED
STEP 3.5.3 — RE-CLOSED
```

Failure:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
POST-CLOSURE ROUND 2E.2R.2A /
FINAL VISUAL RUNTIME EVIDENCE CLOSURE /
RUNTIME DEFECT REMAINS

STEP 3.5.3 — OPEN
STEP 3.5A — BLOCKED
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 25. REQUIRED FINAL RESPONSE

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Validation HEAD:
origin/master:
a297932 preserved:
HEAD == origin/master:
Worktree:

RUNTIME PROVENANCE
Backend rebuild:
Backend restart:
Frontend state/restart:
Hard reload:
Stale process excluded:

CUSTOMER 360 INVENTORY
Tabs:
Selectable/detail surfaces:

PARTNER 360 INVENTORY
Tabs:
Selectable/detail surfaces:

KNOWN REGRESSION CASES
Customer UUID:
Visible label:
Href:
Click result:

Partner UUID:
Visible label:
Href:
Click result:

VISUAL EVIDENCE MATRIX
[complete matrix]

RELATED-ENTITY MATRIX
[complete matrix]

TABLE ↔ DETAIL PARITY
Customer 360:
Partner 360:

UUID / TECHNICAL-ID AUDIT
Resolvable UUID visible labels:
Order UUID labels:
Booking UUID labels:
Payment UUID labels:
Service/Product UUID labels:
Other:

DEEP LINKS
Customer/User:
Partner:
Order:
Booking:
Payment:
Service/Product:
Other:

LOCALIZATION
RU:
AZ:
EN:
Raw keys:
Raw enums:
Mixed locale:

PARTNER PAYMENTS RECONCILIATION
Result:
Evidence:

FILTER/I18N REGRESSION
Customer Orders:
Customer Bookings:
Customer Payments:
Partner Orders:
Partner Bookings:
Partner Users:
crm.col.partner:

ACTIVITY / NOTES
Customer Activity:
Partner Activity:
Customer Notes:
Partner Notes:
History:

TEST BASELINE
Backend:
Frontend:
TSC:
Build:
Skipped:

PRODUCTION CODE CHANGES:
SCHEMA:
MIGRATION:

P0:
P1:
P2:

REPORT:
ROADMAP:
DOCUMENTATION COMMIT:
Final HEAD:
origin/master:
HEAD == origin/master:

STEP 3.5.3:
EXACT NEXT:
```

------------------------------------------------------------------------

# 26. STOP

If all gates PASS:

``` text
Round 2E.2R.2A — FULLY CLOSED
Step 3.5.3 — RE-CLOSED
```

Then determine exact NEXT from canonical roadmap.

Expected, if unchanged:

``` text
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION
```

**STOP. Do not start Step 3.5A without a separate instruction.**
