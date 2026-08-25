# PHASE 3 — DECISION QUEUE CARD INFORMATION HIERARCHY REMEDIATION REPORT

## VERDICT: VERDICT A — DECISION QUEUE CARD INFORMATION HIERARCHY / DUPLICATION / SEMANTIC LABELS RECONCILED

---

## Signal types audited:
- BOOKING_CONFIRMATION_DELAY
- FAILED_PAYMENTS
- RECENT_CANCELLATIONS
- PENDING_REFUNDS
- UPCOMING_BOOKINGS
- SERVICES_WITHOUT_SALES

(6 of 6 total signals — full inventory)

---

## Root cause

Three-layer architecture (Description subtitle + Evidence section + IMPACT section) independently derived from the same evidence array, producing identical metrics under different labels. Each layer added no distinct information beyond re-packaging.

Additionally, `failureCodeGroups` evidence key in FAILED_PAYMENTS detector contained payment method data (grouped by `paymentMethod` field) but was named and labeled as "error code groups" — a semantic labeling defect causing WHY attribution to display "Доминирующий код ошибки" (dominant error code) when the data was actually payment methods.

---

## Shared renderer changes

1. **DecisionQueue.tsx** — Removed `affectedCount`/`observationCount` from card header. Removed entire IMPACT section rendering (all dimensions duplicated evidence). Removed unused `formatDuration`/`formatMoney` imports.

2. **signal-evidence.presenter.ts** — For all 6 signals, removed the primary count metric from evidence display (already shown in description subtitle). Renamed `failureCodeGroups` → `paymentMethodGroups` in FAILED_PAYMENTS presenter.

3. **i18n.tsx** — Renamed `cc.evidence.failureCodeGroups` → `cc.evidence.paymentMethodGroups`. Renamed `cc.why.payment_failure.driver_dominant_code` → `cc.why.payment_failure.driver_dominant_method`. Renamed `cc.why.payment_failure.factor_other_codes` → `cc.why.payment_failure.factor_other_methods`.

---

## FAILED_PAYMENTS

**Before:**
- Description: "4 неуспешных платежей" (count in subtitle)
- Header: "Объектов: 4" (duplicate of count) + "Наблюдений: N" (telemetry)
- Evidence: "Неуспешных платежей: 4" (duplicate count) + "Самый старый сбой: 2 дн 4 ч" + "Сумма неуспешных: 321 ₼" + "Группы ошибок: UNKNOWN: 4" (wrong label)
- WHY: "Доминирующий код ошибки: 4 из 4 — UNKNOWN" (wrong semantic label)
- IMPACT: "Неуспешных платежей: 4" + "Сумма неуспешных попыток: 321 ₼" + "Способы оплаты: UNKNOWN: 4" + "Самый старый сбой: 2 дн 4 ч" (all duplicates of evidence)

**After:**
- Description: "4 неуспешных платежей" (count in subtitle — kept)
- Header: clean (no Объектов/Наблюдений)
- Evidence: "Самый старый сбой: 2 дн 4 ч" + "Сумма неуспешных: 321 ₼" + "Способы оплаты: UNKNOWN: 4" (correct label, distinct metrics only)
- WHY: "Доминирующий способ оплаты: 4 из 4 — UNKNOWN" (correct semantic label)
- IMPACT: hidden (all dimensions duplicated evidence)

**Semantic fixes:** `failureCodeGroups` → `paymentMethodGroups`. WHY label "error code" → "payment method". Evidence label "Группы ошибок" → "Способы оплаты".

---

## SERVICES_WITHOUT_SALES

**Before:**
- Description: "31 опубликованных услуг без заказов"
- Header: "Объектов: 31" + "Наблюдений: N"
- Evidence: "Услуг без заказов: 31" + availability + names + publication stats
- IMPACT: "Услуг без продаж: 31" + availability + publication (all duplicates)

**After:**
- Description: "31 опубликованных услуг без заказов" (kept)
- Header: clean
- Evidence: availability breakdown + product names + publication stats (distinct metrics only)
- IMPACT: hidden

---

## BOOKING_CONFIRMATION_DELAY

**Before:**
- Description: "5 бронирований ожидают подтверждения"
- Header: "Объектов: 5" + "Наблюдений: N"
- Evidence: "Ожидают подтверждения: 5" + oldest + GMV + SLA
- IMPACT: "Заблокированных бронирований: 5" + GMV + SLA (all duplicates)

**After:**
- Description: "5 бронирований ожидают подтверждения" (kept)
- Header: clean
- Evidence: oldest wait + GMV + SLA threshold (distinct metrics only)
- IMPACT: hidden

---

## RECENT_CANCELLATIONS

**Before:**
- Description: "3 отмен за последние 7 дней"
- Header: "Объектов: 3" + "Наблюдений: N"
- Evidence: "Отмен: 3" + oldest + GMV + period
- IMPACT: "Отменённых заказов: 3" + GMV + period + oldest (all duplicates)

**After:**
- Description: "3 отмен за последние 7 дней" (kept)
- Header: clean
- Evidence: oldest cancellation + GMV + period (distinct metrics only)
- IMPACT: hidden

---

## PENDING_REFUNDS

**Before:**
- Description: "20 возвратов ожидают обработки"
- Header: "Объектов: 20" + "Наблюдений: N"
- Evidence: "Ожидают возврата: 20" + oldest + amount
- IMPACT: "Запросов на возврат: 20" + amount + oldest (all duplicates)

**After:**
- Description: "20 возвратов ожидают обработки" (kept)
- Header: clean
- Evidence: oldest request + refund amount (distinct metrics only)
- IMPACT: hidden

---

## UPCOMING_BOOKINGS

**Before:**
- Description: "8 бронирований, ближайшее через 3 дн."
- Header: "Объектов: 8" + "Наблюдений: N"
- Evidence: "Предстоящих бронирований: 8" + days until nearest + GMV
- IMPACT: "Предстоящих бронирований: 8" + GMV (all duplicates)

**After:**
- Description: "8 бронирований, ближайшее через 3 дн." (kept)
- Header: clean
- Evidence: days until nearest + upcoming GMV (distinct metrics only)
- IMPACT: hidden

---

## Other signals:
No additional signal types discovered. Full inventory = 6 signals.

---

## Objects / Observations

- **Objects (`affectedCount`)**: Removed from UI for all signals. For every signal, `affectedCount` equals the primary count metric already shown in description subtitle (e.g., FAILED_PAYMENTS: `affectedCount` = `failedCount` = 4). No distinct business meaning.
- **Observations (`observationCount`)**: Removed from UI for all signals. This is internal detector telemetry (how many times the detector has run), not a decision-useful business metric.

---

## Reason (WHY)

- WHY section retained for all signals.
- FAILED_PAYMENTS WHY: Fixed semantic label from "Доминирующий код ошибки" (error code) → "Доминирующий способ оплаты" (payment method) to match actual data source.
- All WHY sections use correct "observed factor" phrasing (not causal claims).

---

## Impact

- IMPACT section hidden for all 6 signals. Every IMPACT dimension for every signal duplicated an evidence field exactly:
  - Count → duplicated description subtitle
  - Money → duplicated evidence money metric
  - Time → duplicated evidence time metric
  - Distribution → duplicated evidence grouping
- No signal had a distinct canonical impact dimension not already covered by evidence.
- Evidence section is the authoritative metrics layer.

---

## Semantic label audit

| Dimension | Before | After | Status |
|---|---|---|---|
| Error code / Payment method | `failureCodeGroups` key named as "error groups", WHY said "error code", IMPACT said "payment methods" | `paymentMethodGroups` key, all labels say "payment methods" | FIXED |
| Unknown semantic collision | "Группы ошибок: UNKNOWN" + "Доминирующий код ошибки: UNKNOWN" + "Способы оплаты: UNKNOWN" — 3 labels for 1 data | "Способы оплаты: UNKNOWN: 4" — 1 label | FIXED |
| Refund/order distinction | N/A (no many-to-one signal in current dataset) | N/A | OK |
| Error code | N/A (no error code data in current detectors) | N/A | OK |

---

## Duplication matrix

| Signal | Duplicate facts before | Duplicate facts after | Semantic label defects |
|---|---:|---:|---:|
| FAILED_PAYMENTS | 6 (count×3, amount×2, time×2, UNKNOWN×3 labels) | 0 | 1 (payment method as error code) → FIXED |
| BOOKING_CONFIRMATION_DELAY | 4 (count×3, GMV×2, time×2, SLA×1) | 0 | 0 |
| RECENT_CANCELLATIONS | 5 (count×3, GMV×2, time×2, period×2) | 0 | 0 |
| PENDING_REFUNDS | 4 (count×3, amount×2, time×2) | 0 | 0 |
| UPCOMING_BOOKINGS | 3 (count×3, GMV×2, time×1) | 0 | 0 |
| SERVICES_WITHOUT_SALES | 4 (count×3, availability×2, publication×2) | 0 | 0 |
| **TOTAL** | **26** | **0** | **1 → 0** |

---

## Active:
PASS — all active signals render correctly with no duplicate facts.

## History:
PASS — same renderer used for resolved/dismissed signals; IMPACT hidden, evidence clean.

---

## i18n:
- RU: All labels correct. "Способы оплаты" replaces "Группы ошибок".
- AZ: "Ödəniş üsulları" replaces "Xəta qrupları".
- EN: "Payment methods" replaces "Error groups".
- Raw keys = 0.

---

## Accessibility:
- Semantic labels remain understandable.
- Buttons retain accessible names.
- No information conveyed only by color.
- IMPACT section hidden, no empty headings/separators left behind.

---

## Tests:
- Frontend: 243/243 PASS
- Backend WHY/IMPACT: 59/59 PASS
- Backend decision-signal/dashboard: 50/50 PASS

---

## TSC:
- Frontend: PASS (tsc --noEmit exit 0)
- Backend: PASS (tsc --noEmit exit 0)

---

## Build:
- Frontend: PASS (next build success)

---

## Production code changed:
- `backend/src/modules/dashboard/detectors/failed-payments.detector.ts` — renamed evidence key
- `backend/src/modules/dashboard/why-attribution.service.ts` — updated key references + labels
- `backend/src/modules/dashboard/impact-attribution.service.ts` — updated key reference
- `backend/src/modules/dashboard/why-attribution.types.ts` — updated interface field name
- `frontend/components/command-center/DecisionQueue.tsx` — removed header duplicates, hidden IMPACT
- `frontend/components/command-center/signal-evidence.presenter.ts` — removed count metrics, fixed FAILED_PAYMENTS key
- `frontend/lib/i18n.tsx` — renamed semantic keys
- `frontend/components/command-center/__tests__/signal-evidence.presenter.spec.ts` — updated assertions
- `frontend/components/command-center/__tests__/decision-queue.localization.spec.ts` — updated key name
- `backend/src/modules/dashboard/why-attribution.service.spec.ts` — updated key references
- `backend/src/modules/dashboard/impact-attribution.service.spec.ts` — updated key references

---

## Files changed: 11

---

## Remaining findings:
- Backend IMPACT service still contains dimension computation for all signals. Since frontend hides IMPACT, these are dead code but harmless. Could be cleaned in future phase if IMPACT is never re-enabled.
- `cc.queue.observations` and `cc.queue.entities` i18n keys still exist but are no longer rendered. Could be removed in cleanup.
- No additional signal types discovered beyond the 6 audited.

---

## Next canonical stage:
STOP — awaiting review before proceeding to next Phase 3 stage.
