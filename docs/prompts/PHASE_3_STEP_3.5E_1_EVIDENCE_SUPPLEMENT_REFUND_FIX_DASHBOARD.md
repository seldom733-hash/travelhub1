# STEP 3.5E.1 — ДОПОЛНИТЕЛЬНЫЙ EVIDENCE: REFUND FIX + DASHBOARD404

## Базовый SHA

```
7e4fe8c — fix(crm-activity): RefundAdapter — customerId attribution (MANDATORY BASELINE)
```

## 1. Dashboard 404 — Runtime/Auth/Cache Issue

**Причина:** HttpOnly cookie `travelhub.auth` не была установлена в браузере.
Предыдущие попытки логина через `curl` с `Authorization: Bearer` header
работали для API, но НЕ ставили HttpOnly cookie в браузер.

После логина через UI login form → cookie установлена → proxy pass →
но stale `.next` кэш вызывал 404 на `/app/*` маршрутах.

**Resolution:**
1. `rm -rf .next` (очистка Turbopack кэша)
2. Перезапуск `npx next dev --port 3000`
3. Логин через UI (`admin` / `admin123`)
4. Cookie установлена корректно → все `/app/*` маршруты работают

**Классификация:** Runtime/auth/cache issue, НЕ code regression.
Откат 7e4fe8c не требуется.

**Evidence:**
- `/app/dashboard` → 200 ✅
- `/app/crm` → 200, 242 customers ✅
- `/app/crm/customers/[id]` → Customer 360 ✅
- Sidebar navigation → все links работают ✅

## 2. Refund Activity — Browser Runtime Proof

**Customer:** Sophie Wang (CRM-00000159, `3c85743c-8fab-48fe-85d-ea8c03aa314a`)

**DB canonical:**
- ORDER: 6
- BOOKING: 5
- PAYMENT: 6
- REFUND: 6

**CrmActivity:**
- ORDER: 6 ✅
- BOOKING: 5 ✅
- PAYMENT: 6 ✅
- REFUND: 6 ✅ (BEFORE fix: 6 with null customerId)

**Activity tab (browser):**
- First page: 20 items rendered
- REFUND items visible: 5 (RFD-00009012, RFD-8084A26EFEF8, RFD-00009025, RFD-FEEAA7664E19, RFD-EE58B73BE9BE)
- 6th refund on next page (cursor pagination)
- All source labels localized: "Возврат", "Возврат создан"
- All deep links: ↩️ icon, source type, event, code, date

## 3. Hard Regression Gates

| Gate | Before Fix | After Fix | Status |
|---|---|---|---|
| REFUND customerId = null | 334 (100%) | 0 (0%) | ✅ FIXED |
| Cross-customer leakage | 0 | 0 | ✅ PASS |
| Missing Payment Activity | 0 | 0 | ✅ PASS |
| Missing Refund Activity | 0 | 0 | ✅ PASS |
| Customer 360 Refund Activity | Not visible | 6 items visible | ✅ PASS |
| Activity API REFUND filter | Error/empty | Returns items | ✅ PASS |
| REFUND cross-customer mismatch | 0 | 0 | ✅ PASS |

## 4. Sophie Wang — Corrected Counts

| Source | DB Canonical | CrmActivity | Sidebar KPI | Activity Tab (full) |
|---|---|---|---|---|
| ORDER | 6 | 6 | 6 | 6 |
| BOOKING | 5 | 5 | 5 | 5 |
| PAYMENT | 6 | 6 | 6 | 6 |
| REFUND | 6 | 6 | 6 | 6 (5 on page 1, 1 on page 2) |

**Противоречие resolved:** "5 возвратов" в предыдущем тексте было ошибкой.
Canonical count: **6** (5 visible на первой странице Activity из-за лимита 20).

## 5. Backend TSC / Tests

```
Backend TSC: PASS (после 7e4fe8c)
Backend build: PASS
Frontend TSC: PASS
Frontend tests: 243/243 PASS
```

## 6. Git State

```
HEAD: 7e4fe8c (MANDATORY BASELINE)
origin/master: 7e4fe8c
HEAD == origin/master: YES
Worktree: clean (untracked prompt files only)
```
