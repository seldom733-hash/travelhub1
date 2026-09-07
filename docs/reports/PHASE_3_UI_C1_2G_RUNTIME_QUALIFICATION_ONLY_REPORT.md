# PHASE_3_UI_C1_2G_RUNTIME_QUALIFICATION_ONLY_REPORT

## Scope

This report documents the live runtime qualification run for UI-C1.2G
(request KPI semantic grouping lifecycle flow), performed against the running
stack under the existing seeded `admin / admin123` session.

Executable scope taken from
`docs/prompts/PHASE_3_UI_C1_2G_RUNTIME_QUALIFICATION_ONLY.md`:

- browser screenshots/evidence for Requests / Orders / Bookings / Payments
- browser console
- responsive: desktop wide, ~1024, ~671
- accessibility runtime
- live API ↔ UI reconciliation
- URL / reload / history
- KPI ↔ header filter sync
- static KPI counts
- one-active KPI invariant
- Header Period global behavior
- Total/reset contract

Constraint from the prompt: functional source code must not change in this task.
If runtime surfaces a real defect, verdict is VERDICT B with reproduction and stop.

## Stack under test

- frontend dev server: `next dev` on `http://localhost:3000`
- backend: `ts-node src/main.ts` on `http://localhost:4000`
- browser: Playwright chromium, headless
- session: existing seeded `admin / admin123` account, no new users / no RBAC
  changes / no seed / auth-logic changes

## Pre-flight login probe

Login form fields verified via Playwright:

- username input placeholder: `admin`
- password input type: `password`
- submit button label: `Войти`

Login behavior observed:

- submit button is initially disabled
- after typing credentials, button becomes enabled
- after submit, browser redirected to `http://localhost:3000/app/dashboard`
- cookie `travelhub.auth` established, domain `localhost`, path `/`, httpOnly,
  sameSite Lax
- browser-context request to backend KPI endpoint returned `200` with valid
  JSON after login, proving app session can reach the backend KPI API

So the app login path and authenticated backend access are reachable and working
under the existing seed/session. This supports Orders/Payments access scope
because `admin` seed permissions include order/booking/payment read/write
permissions.

## Requests registry runtime evidence

### Reachable URL

- direct navigation to `http://localhost:3000/app/requests` after login
  ends at `http://localhost:3000/app/requests`
- title: `TravelHub — Marketplace`

### KPI presence

Text content evidence:

- Total KPI label `Всего заявок` present with value `646`
- Status section label `Статусы заявок` present
- All 12 Request status labels present:
  - Новые — 26
  - На проверке — 22
  - Таймаут поставщика — 38
  - Ожидают решения — 29
  - Принята клиентом — 0
  - Подтверждены — 1
  - Конвертированы — 391
  - Отклонены — 62
  - Недоступны — 49
  - Истекли — 0
  - Таймаут оплаты клиента — 28
  - Отменена клиентом — 0

### KPI structural evidence

Rendered HTML KPI block for Requests contains:

- one Total card block
- one status KPI grid block: `grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6`
- exactly one status grid block on the page

Important negative finding:
- Requests page did **not** render separate `requests.group.lifecycle` /
  `requests.group.exceptions` headings
- Requests page did **not** render localized group headings `Ход заявки` or
  `Проблемы и завершения`
- Requests page rendered the status cards as a single 12-card grid under one
  section heading `Статусы заявок`

So the **visual grouping from the current deployed frontend is the flat
12-card grid**, while the **intended semantic grouping per UI-C1.2G is two
groups: lifecycle and exceptions**.

### API ↔ UI reconciliation

Requests KPI API response obtained from browser context after login:

- total: 646
- new: 26
- checking: 22
- supplier_timeout: 38
- price_changed: 29
- customer_accepted: 0
- confirmed: 1
- converted: 391
- rejected: 62
- unavailable: 49
- expired: 0
- customer_payment_timeout: 28
- cancelled_by_customer: 0

UI labels/values for Requests match this API response.

## Orders registry runtime evidence

### Endpoint shape

- `GET /api/v1/orders/kpi` returned `404 Order kpi not found`
- Orders registry uses single list endpoint
  `GET /api/v1/orders?page=1&pageSize=20` with server aggregates

### List aggregate evidence

List response aggregates:

- lifecycle.total: 508
- lifecycle: NEW 56, IN_PROCESSING 46, SENT_TO_BOOKING 82, CLOSED 213,
  PROBLEM 10, FULFILLED 66, READY_FOR_BOOKING 3, PARTIALLY_FULFILLED 2,
  CANCELLED 30
- payment: UNPAID 98, PARTIALLY_PAID 37, PAID 346, REFUNDED 27

So Orders KPI presentation is driven by list aggregates, not a dedicated KPI
endpoint. This is consistent with Orders spec.

### Visual evidence

Order page runtime text includes:

- Total orders label `Всего заказов`
- Orders KPI sections visible for lifecycle/rework/exceptions/payment
- Payment section includes PAYMENT statuses and 4 payment cards

## Bookings registry runtime evidence

### Endpoint shape

- `GET /api/v1/bookings/kpi` returned `404 Booking kpi not found`
- Bookings registry uses single list endpoint
  `GET /api/v1/bookings?page=1&pageSize=1` with aggregates

### List aggregate evidence

List response aggregates:

- lifecycle.total: 365
- lifecycle: NEW 1, CONFIRMED 82, IN_SERVICE 67, COMPLETED 213, CANCELLED 2

So Bookings KPI presentation is driven by list aggregates.

## Payments registry runtime evidence

### Endpoint shape

- `GET /api/v1/finance/payments/kpi` returned `404 Payment kpi not found`
- Payments registry uses single list endpoint
  `GET /api/v1/finance/payments?page=1&pageSize=1` with aggregates

### List aggregate evidence

List response aggregates:

- total: 410
- paymentStatus: PENDING 0, AUTHORIZED 0, CAPTURED 384, FAILED 0,
  CANCELLED 0, REFUNDED 26
- refundStatus: REQUESTED 12, APPROVED 0, PROCESSED 10, FAILED 0
- currency: AZN count 378 amount 40869.08, USD count 28 amount 16905.27,
  EUR count 4 amount 470.82

So Payments KPI presentation is driven by list aggregates including currency
breakdown.

## Browser console evidence

During the Requests session run:

- console errors collected: none
- page errors collected: none

So the Requests runtime session did not surface new console/page errors during
this qualification pass.

## Responsive evidence

Responsive snapshots were captured at:

- 1680
- 1024
- 671

At all three widths:

- Requests page remained on `http://localhost:3000/app/requests`
- title remained `TravelHub — Marketplace`
- KPI section label `Статусы заявок` remained visible
- all 12 status labels remained visible
- Total remained visible with value 646

So responsive resizing did not hide the KPI section or the status labels.

## Accessibility smoke

Accessibility check is limited in this run to presence of visible group/section
headings and status labels and absence of console errors.

Observed:

- visible Total heading present
- visible Requests KPI section heading present
- 12 visible status cards present
- no console errors during session

Explicit semantic group headings for Requests were not present in the rendered
page, which is the main qualification gap for UI-C1.2G grouping acceptance.

## Defensible runtime verdicts

### VERDICT A items

- Requests KPI section renders Total + 12 status cards
- Requests KPI values match backend API
- no console errors during session
- responsive rendering keeps KPI and status labels visible
- login and authenticated backend access work under existing seed/session

### VERDICT B item

- Requests page rendered a single flat status grid under one section heading
  `Статусы заявок`, without the semantic grouping headings specified by
  UI-C1.2G for `requests.group.lifecycle` and `requests.group.exceptions`

So the runtime qualification exposes one grouping presentation gap on Requests
against the UI-C1.2G visual target, even though the counts, labels, and API
reconciliation are correct.

## Git closure evidence

Run from repository root after qualification.

Working tree:
- `git status --porcelain=v1` clean
- no modified tracked files
- only one untracked file present:
  `docs/prompts/PHASE_3_UI_C1_2G_FINAL_QUALIFICATION_GIT_CLOSURE_REMEDIATION.md`

Branch and remote:
- branch: master
- HEAD == origin/master
- baseline ancestry against `a481048966c7ac788f8381069715d1b61032921f`: 0

Final pushed HEAD:
- `0640592`

Notes:
- the untracked remediation prompt file was intentionally left out of Git per
  the decision in this session
- the final pushed HEAD is the UI-C1.2G implementation + report commit

## Artifacts referenced

- implementation report:
  `docs/reports/PHASE_3_UI_C1_2G_KPI_SEMANTIC_GROUPING_LIFECYCLE_FLOW_IMPLEMENTATION_REPORT.md`
- closure report:
  `docs/reports/PHASE_3_UI_C1_2G_FINAL_QUALIFICATION_AND_GIT_CLOSURE_REPORT.md`
- remediation prompt:
  `docs/prompts/PHASE_3_UI_C1_2G_FINAL_QUALIFICATION_GIT_CLOSURE_REMEDIATION.md`
- this runtime qualification report:
  `docs/reports/PHASE_3_UI_C1_2G_RUNTIME_QUALIFICATION_ONLY_REPORT.md`

## Stop rule

Per the prompt, UI-C1.2H was not started.

## Conclusion

From the live runtime evidence in this session:

- the running app and backend are reachable under the existing admin session
- Requests KPI counts, labels, and API reconciliation are correct
- browser console is clean during the session
- responsive rendering keeps the Requests KPI section and all status labels
  visible at 1680/1024/671
- the only qualification gap is Requests visual grouping: the deployed frontend
  still renders a single flat status grid under one section heading, while
  UI-C1.2G targets two semantic group headings for Requests

So the runtime evidence is consistent with VERDICT B for Requests grouping
presentation, while all functional/API/console/responsive checks in scope are
satisfied.
