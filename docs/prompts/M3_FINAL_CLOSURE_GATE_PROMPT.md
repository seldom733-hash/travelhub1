# M3 FINAL CLOSURE / GATE PROMPT

## TravelHUB — WhatsApp M3

### OBJECTIVE

Perform the final M3 regression, quality, integration and browser verification and close M3 only if the complete M3 contract is demonstrably satisfied.

This is a **closure gate**, not an M4 implementation.

Final result must be exactly one of:

- `M3 FINAL PASS`
- `M3 FAIL`

Do not declare PASS based only on unit tests.

---

## 1. HARD SCOPE BOUNDARY

Do NOT implement M4.

Do NOT add:

- universal Customer Resolver across all channels;
- guest web checkout onboarding;
- new web registration flow;
- WhatsApp customer onboarding forms;
- commerce notification orchestration;
- Request/Order/Booking status notifications;
- Facebook/Instagram/TikTok adapters;
- new CRM identity architecture;
- unrelated refactors.

If something belongs to M4, record it under `Deferred to M4` and do not implement it.

Only fix defects genuinely required to close the existing M3 contract.

---

## 2. REPOSITORY DISCOVERY FIRST

Before changing anything inspect:

1. `git status`
2. current branch and HEAD
3. M3 implementation
4. Prisma schema and migrations
5. WhatsApp module
6. communication module
7. security/RBAC
8. Outbox/Event infrastructure
9. backend tests
10. frontend tests
11. M3 E2E
12. current M3 reports
13. supplied M3 browser-smoke evidence
14. `m3-outbox-shutdown-postfix.txt`

Do not recreate existing entities/services or replace working M3 architecture.

---

## 3. M3 FUNCTIONAL GATES

### Inbound

Verify:

- inbound message persistence;
- conversation create/reuse;
- canonical phone;
- unread state;
- processing status;
- sequential duplicate protection;
- concurrent duplicate protection;
- correct `fromMe` handling.

### Identity Matching

Verify:

```text
MATCHED
AMBIGUOUS
UNMATCHED
```

For `MATCHED`:
- customer linked;
- customer visible;
- subsequent timeline/send retains the relationship.

For `AMBIGUOUS`:
- no automatic link;
- candidates exposed;
- candidate search/filter works;
- explicit operator link works;
- conversation becomes `MATCHED`;
- linking is audited.

For `UNMATCHED`:
- conversation preserved;
- no invented customer;
- existing operator workflow remains usable.

### Customer Search

Verify:
- RBAC;
- phone search;
- text/name search;
- empty/invalid search;
- correct candidates;
- unauthorized access denied.

Do not turn this into the M4 global Customer Resolver.

### Outbound

Verify:
- manual send;
- conversation association;
- communication history;
- `Idempotency-Key`;
- duplicate protection;
- provider message ID persistence;
- monotonic lifecycle:

```text
SENT → DELIVERED → READ
```

Verify outbound `fromMe` behavior according to M3.

### Communication Continuity

There must be one continuous communication history.

Verify:
- inbound + outbound appear in one history;
- linking does not create a second history;
- send does not create a second stream;
- conversation identity remains stable.

### STOP / Suppression

Verify:
- STOP;
- suppression state;
- blocked outbound;
- correct API response;
- operator-visible state;
- required audit.

### Media

Verify the defined M3 behavior for unsupported media:

```text
SKIPPED
```

Do not expand M3 into full media support.

---

## 4. RBAC GATE

Verify relevant M3 permissions.

At minimum:

- unauthorized read → `401/403`;
- authorized read → success;
- send limited to allowed roles;
- customer link/manage protected by required permission;
- admin-only operations protected.

Do not weaken authorization to make tests pass.

---

## 5. AUDIT GATE

Verify audit coverage for relevant M3 actions, including where applicable:

- WhatsApp connection;
- outbound send;
- customer link;
- suppression/admin/recovery actions.

Verify system-originated audit records correctly handle nullable/no-human actor cases.

Do not invent fake users merely to satisfy the audit foreign key.

---

## 6. OUTBOX / WORKER SHUTDOWN — MANDATORY

Inspect `m3-outbox-shutdown-postfix.txt`.

Determine:

1. original failure;
2. whether it was M3-related;
3. whether it still reproduces;
4. whether worker shutdown is deterministic;
5. whether DB/provider resources close correctly;
6. whether tests leave open handles;
7. whether application start/stop is clean.

Run focused regression tests.

If an M3-scoped fix is necessary, make the smallest fix and add/update a regression test.

Do not perform unrelated worker refactoring.

---

## 7. BACKEND TEST GATE

Run:

- repository TypeScript/typecheck;
- all WhatsApp/M3 focused suites;
- full backend unit suite;
- relevant integration tests.

Record exact:

- suites;
- tests;
- passed;
- failed;
- skipped;
- duration.

Do not use approximate counts.

---

## 8. E2E GATE

Run M3 E2E, RBAC parity relevant to M3, existing WhatsApp E2E and relevant regression E2E.

Required M3 scenarios:

1. RBAC customer search;
2. provider wiring;
3. sequential duplicate;
4. concurrent duplicate;
5. MATCHED;
6. AMBIGUOUS with candidates;
7. customer search;
8. manual link;
9. echo/no duplicate;
10. `fromMe` outside TravelHUB;
11. media `SKIPPED`;
12. timeline/send/404/422;
13. communication continuity;
14. STOP → blocked send.

For every failure determine whether it is M3-related or pre-existing.

---

## 9. FRONTEND GATE

Verify:

- frontend TypeScript;
- frontend tests;
- WhatsApp inbox;
- filters;
- unread state;
- AMBIGUOUS state;
- candidates;
- manual link;
- MATCHED state;
- customer/context panel;
- timeline;
- outbound composer;
- send permission;
- suppression UI;
- mark-read;
- polling/visibility;
- localization;
- navigation/permission visibility.

Record exact test counts.

---

## 10. FINAL BROWSER SMOKE

Perform the final browser smoke:

```text
Inbox
  ↓
AMBIGUOUS
  ↓
Candidates
  ↓
Manual Link
  ↓
MATCHED
  ↓
Customer / Context
  ↓
Outbound Send
  ↓
Communication History
```

Verify visually and, where useful, through API/DB evidence.

Clearly distinguish:
- previously verified evidence;
- newly verified during final gate;
- not re-run.

---

## 11. REGRESSION GATE

Check that M3 did not break:

- authentication;
- RBAC;
- Customer access;
- communication;
- existing Request/Order/Booking behavior;
- application startup;
- application shutdown;
- migrations;
- Prisma generation;
- existing API contracts.

Do not fix unrelated legacy defects.

---

## 12. FAILURE CLASSIFICATION

Every failure must be classified as exactly one:

```text
M3 REGRESSION
M3 DEFECT
PRE-EXISTING UNRELATED FAILURE
ENVIRONMENT / INFRASTRUCTURE FAILURE
TEST HARNESS FAILURE
```

For each failure record:

- command;
- exact error;
- evidence;
- affected scope;
- classification;
- whether it blocks M3.

Never call a failure pre-existing without evidence.

---

## 13. CHANGE POLICY

If all gates pass:

**make no code changes.**

If a failure is M3-scoped:

1. make the smallest necessary fix;
2. add/update a regression test;
3. rerun affected tests;
4. rerun the relevant M3 gate.

Do not refactor unrelated code.
Do not add M4 behavior.
Do not change public contracts unless strictly necessary.

---

## 14. GIT POLICY

Before work:

```bash
git status
git branch --show-current
git rev-parse HEAD
```

At the end report:

- branch;
- starting HEAD;
- changed files;
- final working tree.

Do NOT:
- commit;
- push;
- create a branch;
- rewrite history.

Only report changes unless explicitly authorized.

---

## 15. FINAL REPORT

Create:

```text
M3-GATE-REPORT.md
```

It must contain:

### A. Executive Result

`M3 FINAL PASS` or `M3 FAIL`

### B. Repository State

- branch;
- HEAD;
- working tree;
- migrations;
- Prisma status.

### C. Scope Verified

Every M3 capability verified.

### D. Backend Tests

Exact results.

### E. E2E Tests

Exact results.

### F. Frontend Tests

Exact results.

### G. Browser Smoke

Exact chain and evidence.

### H. Outbox / Worker Shutdown

Original issue, current behavior, tests and conclusion.

### I. RBAC

Relevant operation/result matrix.

### J. Audit

Verified audit events and results.

### K. Regression

Existing failures and classification.

### L. Changes Made During Closure

If none:

`No code changes were required during final M3 closure.`

Otherwise list each change and why it was required.

### M. Deferred to M4

Anything deliberately not implemented because it belongs to M4.

### N. Final Gate

Use exactly:

```text
M3 FINAL GATE

Backend: PASS/FAIL
Frontend: PASS/FAIL
E2E: PASS/FAIL
RBAC: PASS/FAIL
Audit: PASS/FAIL
Inbound: PASS/FAIL
Identity Matching: PASS/FAIL
Conversations: PASS/FAIL
Outbound: PASS/FAIL
STOP/Suppression: PASS/FAIL
Media: PASS/FAIL
Outbox/Shutdown: PASS/FAIL
Regression: PASS/FAIL
Browser Smoke: PASS/FAIL

FINAL RESULT: M3 FINAL PASS / M3 FAIL
```

`M3 FINAL PASS` is allowed only when every M3 gate is PASS and no unresolved M3 defect remains.

---

## 16. M4 BOUNDARY

Explicitly defer:

- universal Customer Resolver;
- web guest checkout onboarding;
- website account redesign;
- WhatsApp onboarding form;
- automatic Customer/User provisioning across all channels;
- Request/Order/Booking WhatsApp status notifications;
- channel-agnostic commerce Notification Layer implementation;
- Facebook/Instagram/TikTok;
- broader CRM identity work.

Do not implement them during M3 closure.

---

## 17. FINAL RESPONSE TO PROJECT OWNER

After completion report concisely:

1. `M3 FINAL PASS` or `M3 FAIL`;
2. exact test counts;
3. whether code changed;
4. Outbox/Worker shutdown result;
5. pre-existing failures;
6. location/name of `M3-GATE-REPORT.md`;
7. whether M3 is ready for M4.

Do not claim PASS while any M3 gate remains unresolved.

Do not ask the project owner to repeat information already present in the repository or supplied M3 evidence.
