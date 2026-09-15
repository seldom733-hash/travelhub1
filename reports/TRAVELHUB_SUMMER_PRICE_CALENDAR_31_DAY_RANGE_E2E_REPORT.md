# TravelHub — Summer Price Calendar: 31-Day Range → Full Date Prices → Absence Reasons

**Дата:** 15 сентября 2026  
**Статус:** ✅ VERDICT A — COMPLETE / PASS

---

## 1. Sync Gate

| Параметр | Значение |
|----------|----------|
| local HEAD | fac09a7 |
| origin/master | fac09a7 |
| ahead | 0 |
| behind | 0 |
| working tree | clean (untracked artifacts only) |

---

## 2. Root Cause

**Исходная проблема:** Price Calendar показывал только те даты, на которые Summer вернул предложения. Даты без предложений просто отсутствовали в календаре.

**Корневая причина:** В `summertour.adapter.ts` (строки 694-743) метод `getPriceCalendar()` строил `entries` только из `dateMap`, который содержал только даты с реальными предложениями Summer. Даты без предложений не попадали в `dateMap` → не создавались `PriceCalendarEntry` → не отображались в календаре.

**Исправление:** Генерация полного набора дат от `dateFrom` до `dateTo` (inclusive) сопоставлением результатов Summer. Даты без предложений получают `absenceCode` + `absenceText`.

---

## 3. Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `backend/src/modules/supplier/supplier.types.ts` | Добавлены `absenceCode`, `absenceText` в `PriceCalendarEntry` |
| `backend/src/modules/supplier/summertour/summertour.adapter.ts` | Генерация полного набора дат + absence reasons |
| `frontend/components/public/PriceConfigurator.tsx` | 31-day max validation, UI hint, day counter |
| `frontend/components/public/PriceCalendar.tsx` | ✕ absence indicator, absenceText tooltip, legend |
| `frontend/lib/public-api.ts` | Добавлены `absenceCode`, `absenceText` в frontend тип |
| `frontend/lib/i18n.tsx` | Новые ключи: max_31_hint, max_31_days, invalid_range, no_price, absence_title |
| `frontend/next.config.ts` | Proxy timeout 300s |
| `backend/src/modules/supplier/price-calendar.spec.ts` | 8 новых тестов (45 total) |

---

## 4. Date-Range Contract (§4)

- **Supplier capability:** Summer принимает максимум 31 календарный день
- **UX validation:** `DateTo` автоматически clamping если >31 день от `DateFrom`
- **Backend safety:** Каждый запрос разбивается на окна ≤31 день
- **Hint:** "Максимум 31 день (ограничение поставщика Summer)"
- **Day counter:** Показывает количество дней (например "11 дн.")

---

## 5. E2E Scenario A — 15.09 → 25.09 (11 dates)

### UI Evidence

- DateFrom: **15.09.2026** ✓
- DateTo: **25.09.2026** ✓
- Hint: **"Максимум 31 день (ограничение поставщика Summer)"** ✓
- Counter: **"11 дн."** ✓

### Network Evidence

```json
{
  "dateFrom": "2026-09-15",
  "dateTo": "2026-09-25",
  "hotel": "HIMEROS BEACH HOTEL 3* (Кемер)",
  "hotelExternalId": "2807",
  "nights": 7,
  "adults": 2,
  "tourIncValues": ["229", "254"]
}
```

### Backend Response

```
entries: 11 dates (all 15-25 present)
totalOffersScanned: 2
```

### Calendar — ALL 11 DATES

| Дата | Summer result | Цена | Статус | Причина |
|------|--------------|-----:|--------|---------|
| 15.09 | offer | $823.16 | PRICE | — |
| 16.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 17.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 18.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 19.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 20.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 21.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 22.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 23.09 | offer | $1,376.90 | PRICE | — |
| 24.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |
| 25.09 | no result | — | NO_PRICE | SUPPLIER_NO_RESULT |

**Итого: 2 даты с ценой, 9 дат с absence reason. Все 11 дат присутствуют.**

---

## 6. >31 Day Negative Test

| Параметр | Результат |
|----------|-----------|
| Ввод: DateFrom=15.09, DateTo=17.10 (33 дня) | ✓ |
| clamp: DateTo → 15.10 (31 день) | ✓ |
| Hint "Максимум 31 день" | ✓ |
| Counter "31 дн." | ✓ |
| Supplier request не отправлен >31 | ✓ |

---

## 7. Second Range Test — 20.09 → 29.09 (10 dates)

| Параметр | Результат |
|----------|-----------|
| DateFrom: 20.09.2026 | ✓ |
| DateTo: 29.09.2026 | ✓ |
| Counter: "10 дн." | ✓ |
| Calendar: все 10 дат (20-29) | ✓ |
| Sep 23: $829.98 (price) | ✓ |
| Остальные: ✕ (absence) | ✓ |
| Старые данные (15-19) не показываются | ✓ |

---

## 8. Parameter Invalidation (§14)

- **Механизм:** contextHash включает dateFrom, dateTo, nights, room, meal, adults, children
- **onConfigDirty:** Сигнал родителю при изменении любого параметра
- **isConfigChanged:** Предупреждение "Параметры изменены. Нажмите «Уточнить цену»"
- **Тест:** N/A для nights (HIMEROS поддерживает только 7 ночей), но механизм реализован и проверен через contextHash сравнение

---

## 9. Tests

```
45/45 tests passed (price-calendar.spec.ts)
```

Добавлены тесты для:
- Complete date-set generation (5 тестов): 11 дат, непрерывность, single-day, 31-day, merge
- Absence reasons (3 тесты): absenceCode/absenceText, no absence for priced dates, all reason codes

---

## 10. Security

- ✅ Supplier credentials не попали во frontend
- ✅ Diagnostic report не содержит production secrets
- ✅ Summer credentials не логируются plaintext
- ✅ Supplier endpoints используют auth/authorization contract
- ✅ Ошибки supplier не раскрывают секретные headers/cookies/tokens

---

## 11. Git Status

| Параметр | Значение |
|----------|----------|
| HEAD | fac09a7 |
| origin/master | fac09a7 |
| ahead | 0 |
| behind | 0 |
| working tree | clean |

---

## 12. Final Verdict

**VERDICT A — COMPLETE / PASS**

Доказан полный пользовательский сценарий:

```
Tour Card
→ DateFrom/DateTo (max 31 day)
→ Уточнить цену
→ full range request
→ Summer
→ result for every requested date
→ price OR diagnosed absence reason
→ frontend state
→ Calendar DOM
```

Для диапазона 15.09–25.09 доказано наличие всех 11 date slots:
- 2 даты с реальной ценой Summer
- 9 дат с диагностированной причиной отсутствия (SUPPLIER_NO_RESULT)

Ни одна дата не исчезает из Calendar без результата/причины.
