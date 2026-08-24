# PHASE 3 — GMV DISPLAY ROUNDING & RECONCILIATION REMEDIATION
## ОТЧЁТ ОБ ИСПРАВЛЕНИИ DISPLAY ROUNDING RECONCILIATION

**Дата:** 2026-08-24  
**Статус:** VERDICT A — GMV DISPLAY ROUNDING RECONCILED / STAGE E READY

---

## 1. EXECUTIVE SUMMARY

Исправлен display rounding inconsistency: Executive cards GMV/Collected/Outstanding визуально противоречили собственной формуле `Outstanding = GMV - Collected` из-за независимого округления каждого card до целого AZN.

**Корневая причина:** DISPLAY_ROUNDING_INCONSISTENCY — backend formula корректна, но KpiCard независимо округляет каждое значение до целого, создавая визуальное несоответствие.

**Решение:** OPTION B — RECONCILED INTEGER PRESENTATION. Outstanding card использует `displayCurrent = round(GMV) - round(Collected)` вместо `round(exact Outstanding)`. Авторитетные exact values сохранены для analytics/comparison/Stage E.

---

## 2. ROOT CAUSE ANALYSIS

### Exact Values (MONTH/August 2026)

| Metric | Exact DB/API | Rounded Independent | Reconciled |
|---|---|---|---|
| GMV | 11,513.53 | 11,514 | 11,514 |
| Collected GMV | 10,838.46 | 10,838 | 10,838 |
| Outstanding | 675.07 | 675 | **676** |

**Before fix:** 11,514 - 10,838 = 676 ≠ 675 ❌
**After fix:** 11,514 - 10,838 = 676 = 676 ✓

### Classification

```
Classification: DISPLAY_ROUNDING_INCONSISTENCY
Root cause: KpiCard rounds each monetary value independently via Intl.NumberFormat(maximumFractionDigits:0)
File/function: frontend/components/command-center/KpiCard.tsx → formatValue()
Rounding method: Intl.NumberFormat("ru-RU", { style: "decimal", maximumFractionDigits: 0 })
Why UI showed 675: Math.round(675.07) = 675, while Math.round(11513.53) - Math.round(10838.46) = 676
```

---

## 3. EXACT ARITHMETIC PROOF

```
11,513.53 - 10,838.46 = 675.07  ← exact formula CORRECT ✓
MAX(0, 675.07) = 675.07          ← no negative ✓

Independent rounding:
  round(11,513.53) = 11,514
  round(10,838.46) = 10,838
  round(675.07) = 675
  11,514 - 10,838 = 676 ≠ 675   ← DISPLAY INCONSISTENCY

Reconciled display:
  displayedOutstanding = round(GMV) - round(Collected)
  displayedOutstanding = 11,514 - 10,838 = 676  ← CONSISTENT ✓
```

---

## 4. DB → API → UI TRACE

| Metric | DB exact | API exact | API displayCurrent | UI displayed |
|---|---:|---:|---:|---:|
| GMV | 11,513.53 | 11,513.53 | — (KpiCard rounds) | 11 514 ₼ |
| Collected GMV | 10,838.46 | 10,838.46 | — (KpiCard rounds) | 10 838 ₼ |
| Outstanding | 675.07 | 675.07 | **676** | **676 ₼** |

---

## 5. SELECTED POLICY

```
Selected display policy: OPTION B — RECONCILED INTEGER PRESENTATION
Why: Minimal change, preserves exact authoritative values, fixes visual consistency
Authoritative values affected: NO (exact current unchanged)
Comparison affected: NO (deltas use exact values)
Stage E inputs affected: NO (receives exact current/previous)
```

### Implementation

Added `displayCurrent` field to `KpiValue`:
- Backend `dashboard.service.ts`: computes `displayCurrent = Math.max(0, Math.round(qualifiedGmv) - Math.round(collectedGmv))` for outstanding card
- Frontend `KpiCard.tsx`: uses `value.displayCurrent ?? value.current` for display
- Authoritative `current` remains exact for analytics/comparison

---

## 6. BEFORE / AFTER

### BEFORE

```
GMV             11 514 ₼
Оплачено по GMV 10 838 ₼
Остаток к оплате  675 ₼

11 514 - 10 838 = 676 ≠ 675  ❌
```

### AFTER

```
GMV             11 514 ₼
Оплачено по GMV 10 838 ₼
Остаток к оплате  676 ₼

11 514 - 10 838 = 676 = 676  ✓
```

---

## 7. COMPARISON NON-REGRESSION

| Metric | Exact delta | Reconciled delta | Match |
|---|---|---|---|
| GMV | uses exact | — | ✓ unchanged |
| Collected | uses exact | — | ✓ unchanged |
| Outstanding | exact delta | reconciled delta | ✓ consistent |

Comparison deltas continue to use exact authoritative values. Only display reconciliation changed.

---

## 8. PERIOD VALIDATION

| Period | GMV | Collected | Outstanding displayCurrent | Equation |
|---|---|---|---|---|
| YEAR 2026 | 76,577 | 72,323 | 4,254 | 76,577 - 72,323 = 4,254 ✓ |
| MONTH Aug | 11,514 | 10,838 | 676 | 11,514 - 10,838 = 676 ✓ |
| LAST_7_DAYS | 2,297 | 2,135 | 162 | 2,297 - 2,135 = 162 ✓ |

---

## 9. TEST RESULTS

```
New regression tests:       6 (command-center.spec.tsx)
Command Center tests:       26/26 passed
i18n tests:                 9/9 passed
Frontend Vitest:            223/223 passed (26 suites)
Frontend TSC:               clean
Backend tests:              998/998 passed (unchanged)
Backend TSC:                clean
Backend build:              clean

Raw cc.kpi.* count:         0
Unexpected $/USD count:     0
AZN (₼) preserved:          YES
```

---

## 10. FILES CHANGED

```
Total files changed: 5

Backend:
  1. backend/src/modules/dashboard/dashboard.service.ts — Added displayCurrent to KpiValue + reconciled outstanding

Frontend:
  2. frontend/lib/dashboard-api.ts — Added displayCurrent to KpiValue type
  3. frontend/components/command-center/KpiCard.tsx — Use displayCurrent for display
  4. frontend/components/command-center/__tests__/command-center.spec.tsx — 6 regression tests

Tests: 1 (command-center.spec.tsx)
Docs: 1 (this report)
Migrations: 0
```

---

## 11. GIT EVIDENCE

```
Starting HEAD: (previous commit)
Final HEAD: (uncommitted changes)
Files changed: 5
Migrations: 0
Commits: pending
Pushed to origin: NO
Working tree clean: NO (changes uncommitted)
```

---

## 12. VERDICT

### VERDICT A — GMV DISPLAY ROUNDING RECONCILED / STAGE E READY

#### Acceptance Criteria

1. ✅ Exact DB/API values obtained (11,513.53 / 10,838.46 / 675.07)
2. ✅ Canonical Outstanding formula verified on exact precision
3. ✅ Root cause classified as DISPLAY_ROUNDING_INCONSISTENCY
4. ✅ Backend formula NOT changed (authoritative values preserved)
5. ✅ Authoritative values not modified
6. ✅ Visible related cards arithmetically consistent (11,514 - 10,838 = 676)
7. ✅ Comparison deltas use exact values (not display-rounded)
8. ✅ Stage E inputs remain exact (displayCurrent only for display)
9. ✅ No premature financial rounding
10. ✅ Regression test reproduces and closes the case
11. ✅ Additional periods verified (YEAR, MONTH, LAST_7_DAYS)
12. ✅ i18n regression absent (0 raw keys)
13. ✅ AZN authority preserved (₼)
14. ✅ Tests/TSC/build green (223 + 998)
15. ✅ Runtime evidence provided
16. ✅ Report на русском
17. ✅ Stage E не запущен автоматически

**Stage E → READY (не запускать автоматически)**

---

## 13. ROADMAP STATUS

```
GMV semantics                       → CLOSED
GMV i18n runtime                    → VERIFIED
GMV display numeric reconciliation  → VERIFIED
Command Center financial trust      → VERIFIED
Stage E                             → READY
```
