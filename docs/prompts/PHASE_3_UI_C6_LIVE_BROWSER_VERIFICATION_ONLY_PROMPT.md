# PHASE 3 — UI-C6 — LIVE BROWSER VERIFICATION ONLY

## Режим

**TARGETED FINAL GATE CLOSURE — BROWSER RUNTIME ONLY**

Цель этого шага — закрыть **единственный неподтверждённый acceptance gate UI-C6**:

> Live browser verification Request Detail + browser console.

Это НЕ новая реализация UI-C6 и НЕ повторная квалификация всего UI-C6.

---

# 1. Canonical state

Repository:

`https://github.com/seldom733-hash/travelhub1`

Branch:

`master`

Current HEAD:

`0b379c94cd1880e8f8e0c9933b0fd432ce3cb97e`

Current accepted implementation chain:

- Implementation:
  `25c8b73b94e9a5a4196f3fbc988ce6b468fea2ec`
- Remediation / qualification:
  `61ee58adeb3ad3e335444b810ad6732251c493e3`
- Intermediate documentation proof:
  `b6aa5da349326e27d3586307ad06018f826952be`
- Current repository/documentation state:
  `0b379c94cd1880e8f8e0c9933b0fd432ce3cb97e`

Current repository facts already established:

```text
HEAD == origin/master
tracked working tree == clean
13 untracked historical docs/prompts/PHASE_3_* artifacts remain
```

Do NOT touch those historical prompt artifacts.

---

# 2. Why this targeted gate exists

The current UI-C6 report claims:

`VERDICT A — ACCEPTED / SEC-UI-01 CLOSED`

but its factual runtime section still contains:

> browser logs for Request Detail were not verified with an automated browser tool — OUTSTANDING.

The final commit changed the verdict wording but did not add objective browser evidence.

Therefore:

**UI-C6 final acceptance is currently NOT independently proven.**

This task exists solely to obtain the missing evidence.

---

# 3. Governing principle

**Do not manufacture evidence.**

A browser check counts only if it is actually executed against a running TravelHub instance.

Do NOT treat any of the following as browser evidence:

- source review;
- backend logs;
- existing e2e tests;
- statements in the qualification report;
- statements in commit messages;
- screenshots not produced during this run;
- inferred UI behavior from source code;
- a prior claim that browser verification was completed.

---

# 4. Absolute scope restriction

### ALLOWED

- start/rebuild the existing application runtime if necessary;
- use an actual browser automation tool/runtime;
- navigate to the canonical Request Detail page;
- inspect rendered DOM/UI;
- inspect browser console;
- inspect network/API response needed to establish `availableActions`;
- create temporary runtime evidence files if necessary;
- create/update ONLY the browser-gate evidence artifact and the UI-C6 qualification report.

### FORBIDDEN

Do NOT modify:

- production backend source;
- production frontend source;
- Prisma schema;
- database schema;
- permissions/RBAC;
- Request lifecycle;
- Request DTO contract;
- `availableActions` implementation;
- tests;
- Debt Register semantics/status;
- roadmap;
- UI-C7;
- D8;
- Finance Center;
- PROD-01;
- Order/Booking contracts.

Do NOT fix unrelated failures.

Do NOT alter `.gitignore`.

Do NOT delete or commit the 13 historical `docs/prompts/PHASE_3_*` files.

If browser verification exposes a **functional defect**, STOP and report it. Do not fix it in this step.

---

# 5. Canonical UI-C6 contract to verify

Request Detail must consume the server-provided typed object:

```ts
availableActions: {
  confirmPrice: boolean;
  proposePrice: boolean;
  reject: boolean;
  unavailable: boolean;
  customerAccept: boolean;
  customerDecline: boolean;
  convert: boolean;
}
```

The frontend must NOT independently reconstruct lifecycle/action availability from Request status.

The browser check is specifically intended to prove that the live Request Detail surface follows the server projection.

---

# 6. Required browser test

Use a real browser against a rebuilt/current runtime.

Do not rely solely on HTTP/API tests.

## 6.1 Request Detail

Open a real canonical Request Detail URL:

`/app/requests/:id`

Use a Request whose state can be established as:

`PRICE_CHANGED`

The browser session must be authenticated as an actor who has:

`order.edit_noncritical`

---

# 7. Required PRICE_CHANGED verification

For the live Request Detail:

### Backend observation

Capture the actual `GET /api/v1/requests/:id` response or equivalent browser network evidence and record:

```text
status = PRICE_CHANGED
availableActions.customerAccept = true
availableActions.customerDecline = true
availableActions.convert = false
```

Also verify the four supplier actions are false:

```text
confirmPrice = false
proposePrice = false
reject = false
unavailable = false
```

### Rendered UI

The browser must show:

- Customer Accept action — visible/enabled according to existing UI behavior;
- Customer Decline action — visible/enabled according to existing UI behavior;
- Convert action — NOT visible as executable action.

The evidence must connect:

```text
server availableActions
        ↓
rendered Request Detail
```

Do not infer this connection merely from source code.

---

# 8. Browser console gate

This is mandatory.

While opening/loading/interacting with the Request Detail surface:

- capture browser console output;
- record errors/warnings relevant to the Request Detail;
- distinguish pre-existing unrelated messages from UI-C6-related errors.

Acceptance condition:

> **No new UI-C6 browser console errors occur during the verification run.**

If a new UI-C6 error occurs:

**STOP → VERDICT B.**

Do not suppress, filter, or delete the error merely to obtain PASS.

---

# 9. Direct URL / refresh

Perform:

1. direct navigation to `/app/requests/:id`;
2. full page refresh;
3. confirm Request Detail still loads;
4. confirm action rendering still follows `availableActions`;
5. confirm no frontend status-array lifecycle authority appears.

Record evidence.

---

# 10. Minimal security sanity check

This is NOT a full security requalification.

Only verify that the live browser result does not contradict the existing UI-C6 security contract:

### Authorized actor

`order.edit_noncritical` present:

- actionable `availableActions` can be rendered.

### Unauthorized actor

If a readily available existing test account can be used without modifying permissions:

- `order.edit_noncritical` absent → no actionable Request actions.

If obtaining this account requires changing RBAC or creating new infrastructure:

**do not modify anything; record NOT RUN.**

The existing automated RBAC evidence remains valid and must not be re-created unnecessarily.

---

# 11. Do NOT execute business mutations unless strictly necessary

This task is a browser rendering/console gate.

Do NOT click Accept/Decline/Convert merely to prove server authority unless doing so is required by the existing test setup.

The purpose is:

```text
server projection → browser rendering → console cleanliness
```

not a new lifecycle qualification.

If an action must be invoked to establish an already-defined assertion, use the smallest safe test path and document it.

---

# 12. Evidence requirements

Create a concise evidence artifact, preferably:

`docs/reports/PHASE_3_UI_C6_LIVE_BROWSER_VERIFICATION_EVIDENCE.md`

It must contain:

- date/time;
- repository SHA tested;
- runtime instance identification;
- Request ID used;
- actor/role used;
- Request status;
- exact `availableActions` observed;
- rendered button/action observations;
- direct URL/refresh result;
- browser console result;
- whether any new UI-C6 console error occurred;
- screenshots or other objective browser evidence if available;
- exact tool/runtime used;
- PASS/FAIL for each gate.

Do not claim evidence that was not actually captured.

---

# 13. Required evidence matrix

| Gate | Expected | Actual | Evidence | Result |
|---|---|---|---|---|
| Request Detail loads | PASS | record | URL/runtime evidence | PASS/FAIL |
| API returns `availableActions` | typed 7-field object | record exact object | network/API evidence | PASS/FAIL |
| PRICE_CHANGED Accept | true + rendered | record | API + DOM | PASS/FAIL |
| PRICE_CHANGED Decline | true + rendered | record | API + DOM | PASS/FAIL |
| PRICE_CHANGED Convert | false + not executable | record | API + DOM | PASS/FAIL |
| Supplier actions | all false | record | API + DOM | PASS/FAIL |
| Direct URL | loads | record | browser | PASS/FAIL |
| Refresh | loads | record | browser | PASS/FAIL |
| Console | no new UI-C6 errors | record | browser console | PASS/FAIL |
| Frontend lifecycle matrix | absent | record | DOM/source/runtime evidence | PASS/FAIL |

---

# 14. Evidence integrity rule

The following is NOT sufficient:

> “Browser verification completed.”

The report must contain objective evidence produced by the actual run.

If screenshots are possible, preserve them.

If browser automation exposes console/network output, preserve the relevant output.

If the environment cannot perform a real browser run:

**VERDICT B — BROWSER GATE BLOCKED**

Do not substitute source review or backend e2e.

---

# 15. Qualification report update

Only after the browser gate genuinely passes may you update:

`docs/reports/PHASE_3_UI_C6_REQUEST_SERVER_AUTHORITY_QUALIFICATION_REPORT.md`

The update must:

1. correct §14.5 so it no longer says browser verification is outstanding;
2. preserve the actual evidence;
3. remove the internal contradiction between §14.5, §14.6 and §22;
4. distinguish implementation/qualification/documentation/final synchronization SHAs correctly;
5. state the actual tested SHA;
6. retain honest accounting of pre-existing unrelated failures;
7. keep UI-C7 = NOT STARTED;
8. keep D8 = NOT STARTED.

Do NOT rewrite history.

---

# 16. Debt Register

Do NOT change the Debt Register during the browser verification itself.

If the browser gate passes, report that the existing:

`SEC-UI-01 = CLOSED`

claim is now supported by the newly captured runtime evidence.

If the browser gate fails, do NOT invent a new closure state.

Return to the user with the blocker and STOP.

---

# 17. Git requirements

Before any permitted documentation commit:

```bash
git status --short --untracked-files=all
git rev-parse HEAD
git rev-parse origin/master
git diff HEAD origin/master
```

Historical untracked `docs/prompts/PHASE_3_*` files must remain untouched.

The temporary browser evidence artifact may be created only if it is required and useful as durable evidence.

Do not commit temporary browser tooling.

Do not commit browser caches, node artifacts, screenshots unless they are intentionally part of the evidence policy.

---

# 18. Final verdict

## VERDICT A — BROWSER GATE PASSED

Only if all mandatory browser gates are genuinely evidenced:

- Request Detail loads;
- exact `availableActions` observed;
- rendered UI matches server projection;
- Accept/Decline/Convert behavior matches expected PRICE_CHANGED projection;
- direct URL works;
- refresh works;
- browser console has no new UI-C6 errors;
- no frontend lifecycle authority is observed;
- evidence is durable and inspectable.

Then report:

```text
UI-C6 browser gate = PASS
UI-C6 = ACCEPTED
SEC-UI-01 = CLOSED
UI-C7 = NOT STARTED
D8 = NOT STARTED
```

## VERDICT B — BROWSER GATE FAILED/BLOCKED

Use if:

- real browser cannot be run;
- console evidence cannot be captured;
- UI does not match `availableActions`;
- a new UI-C6 browser error appears;
- required evidence cannot be preserved;
- unexpected source/domain changes become necessary.

Then:

```text
UI-C6 browser gate = BLOCKED/FAILED
UI-C6 final acceptance = NOT PROVEN
SEC-UI-01 closure = NOT PROVEN
UI-C7 = NOT STARTED
D8 = NOT STARTED
```

---

# 19. STOP

This is a **single-gate closure task**.

After completing the browser verification and permitted documentation reconciliation:

**STOP.**

Do not proceed to UI-C7.

Do not proceed to D8.

Do not start Finance Center.

Do not touch PROD-01.

Do not refactor Request.

Do not modify permissions.

Do not delete historical prompts.

Return a concise final report containing:

1. exact runtime tested;
2. exact Request ID;
3. exact observed `availableActions`;
4. exact rendered UI result;
5. exact browser console result;
6. evidence artifact path;
7. files changed;
8. commit SHA if a documentation-only commit was necessary;
9. final verdict.
