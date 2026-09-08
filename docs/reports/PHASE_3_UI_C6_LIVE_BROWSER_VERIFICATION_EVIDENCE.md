# PHASE 3 — UI-C6 — LIVE BROWSER VERIFICATION EVIDENCE

**Gate:** Live browser verification of Request Detail + browser console (the only previously
OUTSTANDING UI-C6 acceptance gate).

**Date/time of run:** 2026-09-08 (local runtime session; backend boot ~19:43, browser verification ~19:45–20:00)

**Repository SHA tested:** `0b379c94cd1880e8f8e0c9933b0fd432ce3cb97e`
(HEAD == origin/master at test time; tracked working tree clean)

**Runtime instance identification:**
- Backend: NestJS via `ts-node src/main.ts`, fresh process on `http://localhost:4000` (log: `/tmp/backend-c6.log`, PID 17572), DB `travelhub1` (PostgreSQL, schemas `order`/`booking`/`finance`/`crm`/`security`)
- Frontend: Next.js dev server on `http://localhost:3000` (PID 9732), API proxy `/api/v1/*` → backend :4000
- Browser: real Chromium-based automation (CDP) via the Freebuff preview tool — live hydrated DOM, console capture, network capture, screenshots

**Tooling note:** API corroboration used `curl`; the UI/console/network gates were executed in the real
browser against the running instance. No source review or backend log was substituted for browser evidence.

---

## 1. Test subject

| Field | Value |
|---|---|
| Request ID (uuid) | `b878f485-2dde-49f1-8fda-53690e19a995` |
| Reference number | `MKT-REQ-00000593` |
| Status | `PRICE_CHANGED` (RU badge «Цена изменена») |
| `customerActionDeadline` | `2026-11-19 19:02:57` (valid window at run time) |
| Canonical detail URL | `/app/requests/b878f485-2dde-49f1-8fda-53690e19a995` |

## 2. Actors

| Actor | Login | Role | `order.edit_noncritical` | How obtained |
|---|---|---|---|---|
| Authorized | `admin` / `admin123` | ADMIN | yes | existing seeded admin |
| Unauthorized | `sm_c6gate_1788882736` / `staffpass123` | SALES_MANAGER | no | provisioned this run via canonical `POST /api/v1/users` (roleCode SALES_MANAGER, `staffpass123` — same provisioning path as the canonical UI-C6 e2e suite); no permission/RBAC model change |

---

## 3. Evidence matrix

| Gate | Expected | Actual (observed) | Evidence | Result |
|---|---|---|---|---|
| Request Detail loads | loads | `h1 = MKT-REQ-00000593`, status badge «Цена изменена» | direct URL navigation in browser | **PASS** |
| API returns `availableActions` | typed 7-field object | `{"confirmPrice":false,"proposePrice":false,"reject":false,"unavailable":false,"customerAccept":true,"customerDecline":true,"convert":false}` (HTTP 200) | in-browser `fetch('/api/v1/requests/<id>', {credentials:'include'})` + Network log `GET /api/v1/requests/<id> → 200 (Fetch)` | **PASS** |
| PRICE_CHANGED Accept | true + rendered | true; button «Клиент принял условия» rendered, enabled (`disabled:false`) | DOM button inventory + screenshot (admin session) | **PASS** |
| PRICE_CHANGED Decline | true + rendered | true; button «Клиент отказался» rendered, enabled (`disabled:false`) | DOM button inventory + screenshot (admin session) | **PASS** |
| PRICE_CHANGED Convert | false + not executable | false; no convert/«Создать заказ» button anywhere; body text scan for «Конвертир»/«Создать заказ» → 0 hits | DOM button inventory + full-body text scan | **PASS** |
| Supplier actions (confirmPrice/proposePrice/reject/unavailable) | all false | all false; no «Подтвердить цену»/«Предложить цену»/«Отклонить»/«Недоступн» text → 0 hits | DOM + full-body text scan | **PASS** |
| Direct URL | loads | direct navigation to `/app/requests/:id` renders detail | browser navigation | **PASS** |
| Refresh | loads after full refresh | `location.reload()` → stays on `/app/requests/:id`; h1, buttons, API projection identical after reload | in-page reload + post-reload DOM/API check | **PASS** |
| Console | no new UI-C6 errors | only standard dev-mode messages (`Download the React DevTools…`, `[HMR] connected`); zero errors/warnings/uncaught across both sessions | browser console capture (admin + SALES_MANAGER sessions) | **PASS** |
| Frontend lifecycle matrix | absent | no frontend status-array authority: for the authorized actor exactly the two buttons from the server projection render; for the unauthorized actor the entire «ДЕЙСТВИЯ» section is absent from the DOM | DOM inspection both sessions; actions-section absence confirmed via heading scan (`actionsSectionExists:false`) | **PASS** |
| Security sanity — authorized actor | actionable `availableActions` rendered | ADMIN sees actionable buttons matching server projection | DOM + API | **PASS** |
| Security sanity — unauthorized actor | no actionable Request actions | SALES_MANAGER: `availableActions` all false (HTTP 200), «ДЕЙСТВИЯ» section not rendered, only unrelated disabled «Добавить примечание» button | in-browser fetch + DOM + screenshot (SALES_MANAGER session) | **PASS** |

### Exact `availableActions` observed (from the browser origin, same-origin fetch)

Authorized (ADMIN):
```json
{"confirmPrice":false,"proposePrice":false,"reject":false,"unavailable":false,
 "customerAccept":true,"customerDecline":true,"convert":false}
```

Unauthorized (SALES_MANAGER):
```json
{"confirmPrice":false,"proposePrice":false,"reject":false,"unavailable":false,
 "customerAccept":false,"customerDecline":false,"convert":false}
```

### Rendered action observations

- Authorized session (screenshot 1): card «ДЕЙСТВИЯ» → «КЛИЕНТ — РЕШЕНИЕ» → green button
  «Клиент принял условия» + red button «Клиент отказался». No other action buttons. No Convert.
- Unauthorized session (screenshot 2): no «ДЕЙСТВИЯ» card at all; the page renders ОБЗОР →
  ПОСТАВЩИК directly. Sidebar avatar shows the SALES_MANAGER session («S»).

### Browser console result

```
[info] Download the React DevTools for a better development experience: https://react.dev/link/react-devtools
[log] [HMR] connected
```
(repeated across page loads; both sessions). No errors, no warnings, no uncaught exceptions,
no Router render warnings. **New UI-C6 console error: NONE.**

### Browser network result (relevant entries)

```
GET /api/v1/auth/session → 200 (Fetch)
GET /api/v1/requests/<id>            → 200 (Fetch)   ← detail + availableActions
GET /api/v1/requests/<id>/history    → 200 (Fetch)
GET /api/v1/operational-notes/Request/<id>?page=1&pageSize=10 → 200 (Fetch)
```

### Screenshots

Two screenshots captured during this run (in the verification session's preview thread):
1. Authorized (ADMIN) Request Detail — actions card with the two customer buttons.
2. Unauthorized (SALES_MANAGER) Request Detail — no actions card.

Screenshots are intentionally not committed to the repository (evidence policy §17 of the
verification prompt); the DOM/API/console/network records above are the durable evidence.

---

## 4. Direct URL / refresh record

1. Direct navigation to `/app/requests/b878f485-2dde-49f1-8fda-53690e19a995` — loads (h1, badge, buttons). PASS.
2. `location.reload()` (full page refresh) — page stays on the detail URL; after reload the h1,
   the two customer buttons, and the API projection are unchanged. PASS.
3. No frontend status-array lifecycle authority appears in the rendered surface (buttons derive
   solely from the server `availableActions` object; unauthorized actor gets no actions section).

## 5. No mutations executed

No Accept/Decline/Convert click was performed. This was a rendering/console gate
(server projection → browser rendering → console cleanliness); Request state was not mutated.

## 6. Conclusion

All mandatory browser gates PASS. The previously OUTSTANDING gate
("browser logs for Request Detail not verified with an automated browser tool")
is now closed with objective, inspectable runtime evidence produced by this run.

```text
UI-C6 browser gate = PASS
```