# TRAVELHUB — FIX B — LIVE DATA REPAIR (pre-FIX-A traveler requirements)

**Status:** DONE — 4/4 records repaired, verified (DB + API + browser + tests)
**Prompt:** `TRAVELHUB_FIX_B_LIVE_DATA_REPAIR_PROMPT.md`
**Date:** 2026-10-07
**Git:** commit NO / push NO

---

## A. Target verification

| ID | exists | eligible | reason if skipped |
|---|---|---|---|
| `MKT-REQ-00000301` | YES | YES | — |
| `MKT-REQ-00000401` | YES | YES | — |
| `MKT-REQ-00000402` | YES | YES | — |
| Order `TH-2026-000101` (`36e031c0-8a66-498b-9dac-b7ba89122076`) | YES | YES | — |

Pre-repair eligibility facts (read-only, `fixb-backup.txt`): all three Requests product-less (`productId IS NULL`), `pinnedRequirements` offer-shaped, `productSnapshot.offer` **absent** for 0 rows… i.e. offer facts lived **only** inside `pinnedRequirements`. Order: `IN_PROCESSING`, `travelerCount=2`, `finalConfirmedAt=NULL`, offer-shaped pin.

No record was skipped. No record hit a STOP condition.

## B. Repairs

**Records repaired:** 4 (3 Request + 1 Order) — no bulk backfill (proof: `RequestHistory.action='pin_data_repair'` = **3**, `OrderHistory` repair entries = **1**).

**Fields changed**

| Table | Column | Before | After |
|---|---|---|---|
| `order.Request` ×3 | `pinnedRequirements` | offer-shaped snapshot (13 keys: `meal,room,hotel,adults,nights,country,children,childAges,supplierCode,departureCity,departureDate,externalOfferId,hotelExternalId`) | canonical TOUR map (7 keys) |
| `order.Request` ×3 | `productSnapshot` | no `offer` key | `offer` = **verbatim copy of the old pin** (13 keys preserved 1:1) |
| `order.Order` ×1 | `pinnedRequirements` | offer-shaped snapshot | canonical TOUR map |
| `order.Request` ×3 | (insert) | — | `RequestHistory` row, `action='pin_data_repair'`, old pin JSON stored in `comment` |
| `order.Order` ×1 | (insert) | — | `OrderHistory` row, `action='update_order_fields'`, `fields={"pinnedRequirements": <old pin>}`, `source='SYSTEM'` |

**Canonical shape written (exact):**
```json
{"firstName":"REQUIRED","lastName":"REQUIRED","birthDate":"OPTIONAL","citizenship":"NOT_REQUESTED","gender":"NOT_REQUESTED","passportNumber":"NOT_REQUESTED","passportExpiry":"NOT_REQUESTED"}
```

**Execution model:** one SQL script per record, each a single atomic `DO` block → eligibility re-check → update → history insert → in-block post-verification (NOTICE). Requests repaired **before** the Order (§7). All four runs exited `0`.

**Commercial/offer data preserved — confirmed:** `productSnapshot.offer` for `MKT-REQ-00000301` = exactly the 13 pre-repair pin keys, byte-for-byte including `externalOfferId=34960-1144-20261023-11886-4`, `hotel`, `supplierCode=SUMMERTOUR`, `nights=7`, `departureDate=2026-10-23`. `commercialSnapshot` (priceSource/publicPrice/supplierPrice/customerFinalPrice/discount…) untouched on all 4 records.

## C. Safety

| Check | Result |
|---|---|
| Statuses unchanged | ✅ `CUSTOMER_ACCEPTED`, `CUSTOMER_ACCEPTED`, `CONVERTED`, `IN_PROCESSING` (identical to pre-repair) |
| Customer id unchanged | ✅ `4c14fd87-ed8e-4bcc-b8cb-d5dda784c686` on all 4 |
| Traveler count / quantity unchanged | ✅ Requests `quantity=1, travelerCount=2`; Order `travelerCount=2` |
| Customer / traveler PII unchanged | ✅ `OrderTraveler` = 2 rows, `firstName`/`lastName` empty — never written by this repair |
| No Booking created | ✅ `booking."Booking"` rows for this order = **0** |
| No lifecycle transition executed | ✅ `finalConfirmedAt=NULL`, `travelerDataCompletedAt=NULL`, `termsAcceptedAt=2026-10-06 19:47:06.78` (unchanged) |
| No schema / migration changes | ✅ no migration files added or edited; no backend/frontend source touched by FIX B |
| No final-confirm / payment / supplier edits | ✅ not executed |

`availableActions` before = after: `markWaitingData|cancel|problem|suspend|returnToRequest`.

## D. Verification

### API
- `GET /orders/36e031c0…/travelers` → **200**, `pinnedRequirements` = canonical 7 keys, `travelerCount=2`, `travelers=2`, lock fields unchanged.
- `GET /orders/36e031c0…` → `number=TH-2026-000101`, `status=IN_PROCESSING`, `availableActions` unchanged.
- `GET /requests` → registry columns **intact**: `nights=7`, `adults=2`, `children=0`, `country`, `departureCity`, `requestedServiceDate`, `supplierCode`, `productName` present on all three rows (restored from `productSnapshot.offer`).
- `destination` is empty — **also empty before the repair** (key never existed in the old pin) → not a regression.

> **Operational finding:** during verification the running backend (PID 4728, started 06.10 23:52) was **older than the FIX A source edits (07.10 03:39/03:41)** and therefore still read offer facts from `pinned` only — it transiently showed empty `nights/country/…`. Restarted the dev backend (`ts-node src/main.ts`, new PID 42656); the columns were restored with **no data change**. This was a stale-process artifact, not a data defect.

### Browser
`http://localhost:3000/app/orders/36e031c0-8a66-498b-9dac-b7ba89122076` (session `uiaudit-5ed8e5d58bc3`, admin, no PII entered/saved):
- Order `TH-2026-000101` ✅
- `ДАННЫЕ ТУРИСТОВ` visible ✅
- `Турист 1 из 2` / `Турист 2 из 2` visible ✅
- Actual inputs rendered: **0 → 6** (Имя `*`, Фамилия `*`, Дата рождения `(Опционально)` ×2 travelers) — `fieldsFor=[]` no longer the cause ✅
- Labels 1 → 7; both `Сохранить` buttons present and **enabled**; the only disabled button is `Добавить примечание` (notes, expected) ✅
- `Финальное подтверждение` button rendered and enabled → still governed by existing D3 rules ✅
- No `citizenship`/`gender`/`passport*` fields rendered (correct for `NOT_REQUESTED`) ✅
- Network HAR: 39 requests, **0 non-2xx**; traveler payload canonical ✅
- Console + error list: **empty** ✅
- FIX B history entry visible in `ИСТОРИЯ ИЗМЕНЕНИЙ` with label `Изменение полей заказа` ✅

### Focused tests (§10)
| Test | Result |
|---|---|
| `backend/test/tour-offer-traveler-pin.e2e-spec.ts` | **PASS** 1/1 (exit 0) |
| `frontend/components/order/TravelerCollectionPanel.spec.tsx` | **PASS** 8/8 (exit 0) |
| `backend/src/modules/catalog/traveler-requirements.spec.ts` | **PASS** 44/44 (exit 0) |

No test was modified.

### Typecheck
`npm run typecheck` (`tsc --noEmit`) — **exit 0**, no errors.

## E. Git

- commit: **NO**
- push: **NO**
- working tree: FIX B changed **no repository files** (SQL scripts live in `%LOCALAPPDATA%\Temp\opencode\`). Pre-existing dirty/untracked files from other workstreams were left untouched.

---

## Artifacts (outside the repo)

`%LOCALAPPDATA%\Temp\opencode\` → `fixb-backup.txt` (pre-repair backup), `fixb-repair-request.tmpl.sql`, `fixb-repair-order.sql`, `fixb-req-*.sql/.out`, `fixb-postcheck.sql/.txt`, `fixb-safety.sql/.txt`, `fixb-safety2.sql/.txt`, `fixb-order.har`, `fixb-travelers-resp.json`, `fixb-order-snap.txt`.
