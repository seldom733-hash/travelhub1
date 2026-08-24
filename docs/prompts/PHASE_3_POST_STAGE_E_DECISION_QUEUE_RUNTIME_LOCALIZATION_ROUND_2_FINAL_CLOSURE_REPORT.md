# PHASE 3 — ROUND 2 FINAL CLOSURE
## DECISION QUEUE RUNTIME LOCALIZATION
## ОТЧЁТ

**VERDICT A — ROUND 2 FINAL CLOSURE COMPLETE / RUNTIME LOCALIZATION VERIFIED / STAGE F TECHNICALLY READY**

---

## PART A — Negative Duration Semantic Closure

### Temporal RCA

| Проверка | Результат |
|---|---|
| **Timestamp authority** | `Order.createdAt` |
| **Runtime/reference time** | `Date.now()` (2026-08-24T12:00:00Z) |
| **Timezone** | UTC (DB/server) |
| **Old query window** | `createdAt > (now - 7 days)` — без верхней границы |
| **Future record behavior** | Допускал future-dated records (Aug 26+ при now=Aug 24) |
| **Old age formula** | `(Date.now() - createdAt) / 60000` — давал отрицательное для future |
| **Root cause** | `QUERY_WINDOW_DEFECT` — отсутствует `lte: now` |
| **Correct query** | `createdAt > (now - 7 days) AND createdAt <= now` |
| **Correct calculation** | `(Date.now() - createdAt) / 60000` — без `Math.abs()` |
| **Math.abs removed?** | ДА — маскировка устранена |
| **Regression test** | 6 тестов в `recent-cancellations.detector.spec.ts` |

### Temporal Regression Tests

```
✓ excludes future-dated cancellations from the result
✓ produces non-negative oldestMinutes for past records
✓ returns empty when no cancellations in window
✓ handles cancellation exactly at now() — zero age
✓ query window is (cutoff, now] — past records only
✓ future cancellation does NOT become past age
```

---

## PART B — AZ Browser DOM Evidence (6 signals)

### 1. SERVICES_WITHOUT_SALES (AZ)
```
Title: Satışı olmayan xidmətlər
Desc: 31 dərc olunmuş xidmət sifariş olmadan
Entities: 31 | Obs: 96
Evidence:
  Satışı olmayan xidmətlər: 31
  Xidmət nümunələri: Baku Night Market Experience, ...
  Mövcudluqla: 0
  Mövcudluq olmadan: 31
  Yeni nəşr olunub: 31
  Uzun müddət satılmayıb: 0
WHY: [Əsas müşahidə olunan amil] Tənzimlənmiş əlçatanlıq olmadan dərc olunub
IMPACT:
  Satışı olmayan xidmətlər: 31
  31 mövcudluq olmadan, 0 mövcudluqla: 31/0
  31 yaxınlarda dərc olunub, 0 uzun müddət satılmayıb: 31
```

### 2. UPCOMING_BOOKINGS (AZ)
```
Title: Gələcək bronlar
Desc: 51 bron, ən yaxın 0 gün sonra
Entities: 50 | Obs: 92
Evidence:
  Gələcək bronlar: 51
  Ən yaxına qədər: 0 gün
  Gələcək həcm: 5.792 ₼
WHY: Səbəbi müəyyən etmək üçün kifayət qədər məlumat yoxdur
IMPACT:
  Gələcək bronlar: 51
  Gələcək həcm: 5.792 ₼
```

### 3. PENDING_REFUNDS (AZ)
```
Title: Geri qaytarma gözləyir
Desc: 20 geri qaytarma həll gözləyir
Entities: 20 | Obs: 92
Evidence:
  Geri qaytarma gözləyir: 20
  Ən uzun gözləmə: 170 gün 1 saat
  Geri qaytarma məbləği: 1.564 ₼
WHY: Səbəbi müəyyən etmək üçün kifayət qədər məlumat yoxdur
IMPACT:
  Geri qaytarma sorğuları: 20
  Sorğu məbləği: 1.564 ₼
  Ən uzun sorğu: 170 gün 1 saat
```

### 4. FAILED_PAYMENTS (AZ)
```
Title: Uğursuz ödənişlər
Desc: 8 uğursuz ödəniş
Entities: 8 | Obs: 92
Evidence:
  Uğursuz ödənişlər: 8
  Ən köhnə uğursuzluq: 205 gün 5 saat
  Uğursuzların məbləği: 1.135 ₼
  Xəta qrupları: Bank köçürməsi: 3, Kart: 3, Mobil ödəniş: 2
WHY: [Əsas müşahidə olunan amil] Dominant xəta kodu
IMPACT:
  Uğursuz ödənişlər: 8
  Uğursuz cəhdlərin məbləği: 1.135 ₼
  Ödəniş üsulları: Bank köçürməsi: 3, Kart: 3, Mobil ödəniş: 2
  Ən köhnə uğursuzluq: 205 gün 5 saat
```

### 5. BOOKING_CONFIRMATION_DELAY (AZ)
```
Title: Bron təsdiqi gecikməsi
Desc: 5 bron təsdiqi gözləyir
Entities: 5 | Obs: 92
Evidence:
  Təsdiq gözləyir: 5
  Ən uzun gözləmə: 1 gün 4 saat
  Təsir olunan həcm: 1.320 ₼
  SLA həddi: 4 saat
WHY: [Əsas müşahidə olunan amil] Bronlar SLA-dan çox gözləyir
IMPACT:
  Bloklanmış bronlar: 5
  Təsir olunan sifarişlərin GMV-si: 1.320 ₼
  5 SLA-nı keçdi: 1 gün 4 saat
```

### 6. RECENT_CANCELLATIONS (AZ)
```
Title: Son ləğvetmələr
Desc: 25 son 7 gündə ləğv edilmə
Entities: 25 | Obs: 78
Evidence:
  Ləğv edilmələr: 25
  Ən köhnə ləğv: 1 gün 20 saat
  Təsir olunan həcm: 2.980 ₼
  Dövr ərzində: 7 gün
WHY: Səbəbi müəyyən etmək üçün kifayət qədər məlumat yoxdur
IMPACT:
  Ləğv edilmiş sifarişlər: 25
  Ləğv edilmiş sifarişlərin dəyəri: 2.980 ₼
  Dövr: 7 gün
  Ən köhnə ləğv: 1 gün 20 saat
```

---

## PART C — Runtime Counts

```
AZ:
  Russian system fragments    = 0 ✅
  Raw EN units                = 0 ✅ (formatted via formatDuration/formatMoney)
  Raw EN relative time        = 0 ✅ (AZ: "indi", "dəq. əvvəl", "saat əvvəl", "gün əvvəl")
  Raw enums                   = 0 ✅ (payment methods localized)
  Raw i18n keys               = 0 ✅
  Raw AZN presentation        = 0 ✅ (all use ₼)
  Negative durations          = 0 ✅ (temporal predicate fixed)
  Duplicated raw durations    = 0 ✅ (labels no longer embed units)

RU:
  CJK fragments               = 0 ✅
  AZ system fragments         = 0 ✅
  Raw EN units                = 0 ✅

EN:
  RU system fragments         = 0 ✅
  AZ system fragments         = 0 ✅
  Raw enums                   = 0 ✅
  Raw i18n keys               = 0 ✅
```

---

## PART D — Semantic Reconciliation

### ServicesWithoutSales
```
unsold:                   31
without availability:     31
with availability:        0
recently published:       31
long-term unsold:         0
mapping correct:          YES ✅
```

### UpcomingBookings
```
booking count:            51
affected entities:        50
entity types:             BOOKING
difference explained:     affectedEntities capped at 50 for performance (slice(0, 50))
correct by design:        YES ✅
```

---

## PART E — Tests

```
New temporal regression tests:  6
Backend tests:               1027/1027 ✅
Frontend tests:                243/243 ✅
Backend TSC:                   clean ✅
Frontend TSC:                  clean ✅
Backend build:                 clean ✅
Browser AZ 6/6:                verified ✅
Browser RU:                    verified ✅
Browser EN:                    verified ✅
```

---

## PART F — Files / Git

```
Starting HEAD:    (round 2 final start)
Final HEAD:       (this session)
Files changed:    7
  backend/src/modules/dashboard/detectors/recent-cancellations.detector.ts
  backend/src/modules/dashboard/detectors/recent-cancellations.detector.spec.ts (NEW)
  backend/src/modules/dashboard/impact-attribution.types.ts
  backend/src/modules/dashboard/impact-attribution.service.ts
  backend/src/modules/dashboard/impact-attribution.service.spec.ts
  frontend/components/command-center/DecisionQueue.tsx
  frontend/lib/i18n.tsx
New files:        1 (detector spec)
Migrations:       0
```

---

## Roadmap

```
Post-Stage-E Localization Round 1      → PASS rejected by runtime evidence
Post-Stage-E Localization Round 2      → VERDICT A
Stage F                                → TECHNICALLY READY (not auto-started)
AI Decision Feed Semantic Reconciliation → SEPARATE GATE (not started)
```

---

**VERDICT A — ROUND 2 FINAL CLOSURE COMPLETE / RUNTIME LOCALIZATION VERIFIED / STAGE F TECHNICALLY READY**

Stage F автоматически НЕ запускать. Следующий gate — AI Decision Feed Semantic & Localization Reconciliation.
