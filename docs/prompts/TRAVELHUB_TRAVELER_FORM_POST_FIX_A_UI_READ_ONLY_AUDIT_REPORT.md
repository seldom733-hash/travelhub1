# TRAVELHUB — TRAVELER FORM POST-FIX-A UI READ-ONLY AUDIT — FINAL REPORT

**Verdict: `UI FAIL — DATA/API`**

Scope: strict read-only browser/UI audit. No code, config, permission, schema, migration, test or data
changes were made. FIX B was NOT executed.

---

## 1. Order and route

| Item | Value |
|---|---|
| UI route | `http://localhost:3000/app/orders/36e031c0-8a66-498b-9dac-b7ba89122076` |
| Frontend page | `frontend/app/app/orders/[id]/page.tsx` → `TravelerCollectionPanel` |
| Order id | `36e031c0-8a66-498b-9dac-b7ba89122076` |
| Display code / number | `MKT-ORD-00000402` / `ORD-00000001` / **`TH-2026-000101`** |
| Order status | `IN_PROCESSING` |
| Source | Linked request `MKT-REQ-00000402`; history: "Заказ создан из принятой заявки (Request conversion, D3 Request Flow)" at `06.10.2026 23:53:24` |
| availableActions | `markWaitingData \| cancel \| problem \| suspend \| returnToRequest` (all 5 rendered as buttons) |

The page opened successfully and rendered every section: Обзор, Финансы, Позиции заказа,
**Данные туристов**, Хронология, Детали, Связанные сущности, Примечания, История изменений,
Финансовая история.

## 2. User role

- Login: `admin` / `admin123` via `POST /api/v1/auth/login` → HTTP 200.
- Session (`GET /api/v1/auth/session`, 200): `role = ADMIN`, `roleTitle = Administrator`,
  **179 permissions**, **`order.edit_noncritical` present (`true`)**.
- Sidebar rendered as "Administrator / ADMIN".

## 3. GET endpoint / status

- **`GET /api/v1/orders/36e031c0-8a66-498b-9dac-b7ba89122076/travelers` → `200 OK`**
  (called twice during a single page load; captured from browser network via HAR).
- Full page load: 38 requests, **all HTTP 200** (incl. `/auth/session`, `/orders/{id}`,
  `/orders/{id}/history`, `/orders/{id}/financial-history`, `/operational-notes/...`).
- Response `Content-Type: application/json`, body length 886 bytes.

## 4. Actual `pinnedRequirements`

Offer-shaped — **14 keys, none of them a traveler identity field**:

```json
{"meal":"ABF","room":"Deluxe Pool View / Double",
 "hotel":"SUGAR MARINA RESORT NAUTICAL KATA BEACH 3* (Kata)",
 "adults":2,"nights":7,"country":"Таиланд","children":0,"childAges":[],
 "supplierCode":"KAZUNION","departureCity":"Baku","departureDate":"2026-10-24",
 "externalOfferId":"37844-4105-20261024-529-53","hotelExternalId":"4105"}
```

Expected canonical TOUR shape:

```json
{"firstName":"REQUIRED","lastName":"REQUIRED","birthDate":"OPTIONAL",
 "citizenship":"NOT_REQUESTED","gender":"NOT_REQUESTED",
 "passportNumber":"NOT_REQUESTED","passportExpiry":"NOT_REQUESTED"}
```

**Intersection: empty.** Per the audit prompt this is an API/data-path discrepancy.

## 5. Travelers

```json
{"termsAcceptedAt":"2026-10-06T19:47:06.780Z",
 "travelerDataCompletedAt":null,"finalConfirmedAt":null,"travelerCount":2,
 "travelers":[
   {"id":"0c3efdde-...","firstName":"","lastName":"","birthDate":null,
    "citizenship":null,"gender":null,"passportNumber":null,
    "passportExpiry":null,"dataCompleteness":"INCOMPLETE"},
   {"id":"f80c02bd-...","firstName":"","lastName":"","birthDate":null,
    "citizenship":null,"gender":null,"passportNumber":null,
    "passportExpiry":null,"dataCompleteness":"INCOMPLETE"}]}
```

- `travelers.length = 2`, both `INCOMPLETE`, all identity fields empty/null.
- UI badges: "Турист 1 из 2 — Не заполнено", "Турист 2 из 2 — Не заполнено".
- Milestones rendered: Условия приняты `06.10.2026, 23:47:06`; Данные собраны `—`;
  Подтверждено финально `—`.

## 6. `canEdit`

**`true`.** Evidence (three independent sources):

1. Session permissions contain `order.edit_noncritical`.
2. DOM contains **no** permission notice (`rounded-lg bg-amber-50 px-3 py-2 ... text-amber-700`
   absent; the only `.bg-amber-50` blocks are the two "Не заполнено" badges and unrelated chips).
3. Both `Сохранить` buttons and `Финальное подтверждение` are rendered **enabled**
   (`11 buttons, only 1 disabled` — the operational-notes "Добавить примечание").

## 7. `locked`

**`false`.** `finalConfirmedAt = null` in the API response; `TravelerCollectionPanel` computes
`locked = Boolean(view?.finalConfirmedAt)` → `false`; no locked banner in DOM.

## 8. `fieldsFor`

**`[]`** (empty).

```ts
FIELD_ORDER.filter((f) => (pinned[f] ?? "NOT_REQUESTED") !== "NOT_REQUESTED")
// FIELD_ORDER = ["firstName","lastName","birthDate","citizenship","gender",
//                "passportNumber","passportExpiry"]
// pinned contains none of these keys → every lookup defaults to NOT_REQUESTED → []
```

## 9. DOM inputs

Measured with `document.querySelectorAll` on the live Order page:

| Metric | Value |
|---|---|
| `input` elements (entire page) | **0** |
| `textarea` | 1 (operational notes "Текст примечания" — unrelated) |
| `select` | 0 |
| `label` elements | 1 (notes only — **0 labels inside traveler cards**) |
| `button` | 11 (1 disabled: "Добавить примечание") |
| Section heading "Данные туристов" | present |
| Traveler field inputs | **0** |

Accessibility snapshot of the section shows exactly: 3 milestone cards → 2 traveler cards
(header + "Не заполнено" badge + enabled `Сохранить`) → final-confirmation block with enabled
`Финальное подтверждение`. **No form field of any kind.**

- `console`: only React DevTools/HMR messages. **No warnings, no errors.**
- `errors` (page errors): **empty**.

## 10. Exact root cause

**Classification: `A. wrong pinnedRequirements shape`.** (Exactly one primary cause.)

Broken chain, boundary by boundary:

```
Request.pinnedRequirements (MKT-REQ-00000402)  ← offer snapshot, written BEFORE FIX A
        │  order.service.ts:705  pinnedRequirements: (r.pinnedRequirements ?? {})
        ▼
Order.pinnedRequirements  =  offer-shaped  ✗
        │  GET /orders/:id/travelers → 200, serves persisted value unchanged
        ▼
TravelerCollectionPanel.pinned = offer-shaped
        │  fieldsFor = FIELD_ORDER.filter(...) = []
        ▼
fieldsFor.map(...) renders nothing  →  0 <input> in DOM  →  operator sees no form
```

**The first broken boundary is the data/API layer**: `GET /orders/:id/travelers` returns a
`pinnedRequirements` shape different from the canonical TOUR requirements.

Ruling out the other classifications:

- **B** — the shape is not correct, so it is not "correct shape but `fieldsFor=[]`".
- **C** — `fieldsFor` is empty; React correctly renders nothing.
- **D** — there are zero field nodes in the DOM (not zero *visible* nodes).
- **E** — `locked = false` (`finalConfirmedAt = null`).
- **F** — `canEdit = true`, `order.edit_noncritical` granted, save buttons enabled.
- **G** — correct Order/tenant: id, `MKT-ORD-00000402`, `TH-2026-000101`, 2 travelers, 200.
- **H** — not stale frontend cache: a hard reload (`open`) re-fetched and reproduced the same
  200 body; HAR confirms the response itself is offer-shaped.
- **I** — no runtime/frontend errors in console or page-error channel.
- **J** — not needed.

Why the data is wrong (staleness, not a live code bug):

- FIX A source edits are dated **07.10.2026 03:39–03:41**
  (`tour-request.service.ts`, `request.service.ts`), while this Order was created
  **06.10.2026 23:53:24** — the row predates FIX A.
- Current code writes the canonical pin at creation for product-less tour offers
  (`tour-request.service.ts:223` → `getEffectiveTravelerRequirements("TOUR", productTravelerRequirements)`,
  offer facts moved to `productSnapshot.offer`).
- Product-less requests (`productId = null`) are deliberately **never re-pinned** at acceptance
  (`request.service.ts:786-807` and the `...(product ? {...} : {})` no-op at `:856-858`), so the
  pre-FIX-A offer-shaped value persists indefinitely and propagates to the Order.

No alternative Order could be used: all 60 databases were scanned read-only
(`"order"."Order"`, column `"pinnedRequirements"`):

- `travelhub1` (the DB the app uses): **1 Order total, 1 offer-shaped pin, 0 canonical**.
- Every other database: **0 Orders with `pinnedRequirements ? 'firstName'`**
  (test DBs with orders: `travelhub1_fc9o9k_20528_test` 13, `travelhub1_l9xor7_7960_test` 29 —
  both with `pinnedRequirements IS NULL` for all rows).

Therefore **no Order with canonical traveler requirements exists anywhere**, and creating or
mutating one is explicitly forbidden — so a `UI PASS` demonstration on correct data is
impossible within this audit's constraints.

## 11. E2E coverage classification

`backend/test/tour-offer-traveler-pin.e2e-spec.ts` imports `supertest` and asserts against
`app.getHttpServer()`; it contains no Playwright/Puppeteer/Selenium/DOM interaction.

**E2E proves backend/API lifecycle but does not prove real browser UI usability.**

Browser-level traveller-form coverage exists only as a unit test
(`frontend/components/order/TravelerCollectionPanel.spec.tsx`, 8/8), which renders the component
with a canonical pin — it never exercises the real Order page with real API data.

## 12. Smallest safe fix (identified, NOT implemented)

**No code change is required.** The creation path already writes the canonical shape and is
covered by unit tests (TravelerCollectionPanel 8/8; targeted units 81/81; full backend unit run
154/154 suites, 2460/2460) and by `tour-offer-traveler-pin.e2e-spec.ts` (1/1).

The only remaining gap is **persisted pre-FIX-A rows**:

> Backfill `pinnedRequirements` on the affected pre-FIX-A `Request` rows (and the
> `Order.pinnedRequirements` values copied from them) with the canonical TOUR shape returned by
> `getEffectiveTravelerRequirements("TOUR", product.travelerRequirements)`, leaving
> `productSnapshot.offer` (the offer facts) untouched.

This is exactly **FIX B**, which remains **HOLD** pending this UI answer.

Not recommended: adding a tolerant/fallback `fieldsFor` in `TravelerCollectionPanel` — traveler
requirements are server-owned, and a frontend fallback would silently mask bad persisted data.

The "Required TOUR UI" check (`firstName`/`lastName` visible, `birthDate` visible,
`citizenship`/`gender`/`passportNumber`/`passportExpiry` absent) **could not be verified on a
live Order**, because no Order with canonical pin exists (see §10). It is currently proven only
by the component unit test.

## 13. Data-safety confirmation

- live UPDATE/INSERT/DELETE: **NO** (only `SELECT` reads; all scans used `-tA -f` read-only SQL)
- FIX B: **NOT EXECUTED**
- Booking / final-confirm / confirm / send: **NO**
- commit/push: **NO** (HEAD `75c6bea`, staged = 0)
- frontend/backend/schema/migration/test/permission/config changes: **NO**
- Save interaction: **NOT EXECUTED** (no disposable environment; saving into the live Order is
  forbidden). Source path traced only: `input → drafts state →
  PATCH /orders/:id/travelers/:travelerId → refetch` (`TravelerCollectionPanel.tsx:122-144`).

---

## Answer to the primary question

> **After FIX A, can a real human operator actually see and use the traveler input form in the
> Order UI?**

**No.** The Order page loads, is fully authorized and error-free, and the "Данные туристов"
section renders — but with `fieldsFor = []` it contains **zero input fields**, so the operator
cannot see, edit, save or persist anything. The first broken boundary is the persisted
`pinnedRequirements` served by `GET /orders/:id/travelers` (offer-shaped pre-FIX-A data), i.e.
classification **A**, verdict **`UI FAIL — DATA/API`**.

**FIX B remains HOLD** until the owner decides on the data backfill described in §12.

## Environment note

`agent-browser`'s auto-launch was failing on this host (`Chrome exited early ... without writing
DevToolsActivePort`) after the process table filled with orphaned Chrome instances. The audit was
performed by starting Chrome manually on a private profile with `--headless=new
--remote-debugging-port=9223` and using `agent-browser connect 9223`. All temporary diagnostics
(HAR, snapshots, screenshots, SQL scripts) were written **outside the repository** to
`%LOCALAPPDATA%\Temp\opencode\`. No repository files were modified by this audit other than this
report.
