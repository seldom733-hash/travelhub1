# Отчёт: E2E — Единое предложение Summer: дата → цена → смена туристов

**Дата:** 2026-09-15  
**Статус:** ✅ PASSED  
**HEAD:** `d22e1b6` (working copy, uncommitted)

---

## Результат

E2E проверка одного реального предложения Summertour: дата вылета → цена → смена туристов → новый запрос к поставщику.

### Найденное предложение (Summer source of truth)

| Поле | Значение |
|------|----------|
| Гостиница | HIMEROS BEACH HOTEL 3* (Кемер) |
| hotelKey | 2807 |
| tourKey | 229 (Antalya 2026) |
| spoKey | 34977 |
| roomKey | 4 |
| mealKey | 6 |
| Дата вылета (checkIn class) | `20260930` → **2026-09-30** |
| Ночей | 7 |
| Питание | AI |
| Номер | STANDARD ROOM / DBL |
| Цена (USD) | **1 371,64** |

### E2E результаты

| Шаг | Ожидание | Результат | Статус |
|-----|----------|-----------|--------|
| Дата в TravelHub | 2026-09-30 | Календарь: **Сентябрь 30** | ✅ |
| Цена в TravelHub | $1,371.64 | Календарь: **1 371,64** | ✅ |
| tourIncValue передан | "229" | API searchContext.tourIncValue = "229" | ✅ |
| Смена туристов → новый запрос | searchContext с новыми параметрами | adults=2, children=0 → children=1, childAges=[5] | ✅ |
| Обратный тест | Вернуть 2+0 → тот же результат | $1,371.64 USD, 2026-09-30 | ✅ |
| Кэш изоляция | Разные конфигурации = разные ключи | 6 промахов кэша за 3 запроса | ✅ |

---

## Обнаруженные и исправленные ошибки

### 1. Adapter date order (P0)

**Проблема:** Summertour adapter устанавливал TOURINC **до** дат. SAMO сбрасывал даты при смене программы → поиск возвращал 0 результатов.

**Исправление:** Поменял порядок — сначала даты (`fill()`), потом TOURINC.

**Файл:** `backend/src/modules/supplier/summertour/summertour.adapter.ts:112-140`

### 2. Missing tourIncValue in PriceCalendarQuery (P0)

**Проблема:** Frontend PriceCalendarQuery не содержал `tourIncValue`/`tourIncName`. Adapter не знал какую программу TOURINC выбрать → 0 результатов поиска.

**Исправления:**
- `frontend/lib/public-api.ts` — добавлены поля в PriceCalendarQuery
- `frontend/components/public/PriceConfigurator.tsx` — чтение tourIncValue/tourIncName из product attributes + передача в API

**Файлы:**
- `frontend/lib/public-api.ts:285-298`
- `frontend/components/public/PriceConfigurator.tsx:66-76, 130-145, 159`

---

## Тесты

```
Tests:       19 passed, 19 total
Test Suites: 1 passed, 1 total
```

6 новых тестов:
- tourIncValue pass-through (3 теста)
- Date integrity — checkIn parsing (3 теста)

**Build:** clean (`tsc --noEmit` pass)

---

## Артефакты

- `docs/reports/evidence/e2e-pdp-initial.png` — PDP страница до запроса цены
- `docs/reports/evidence/e2e-price-calendar-sep30.png` — Календарь цен: Sep 30 = $1,371.64
- `docs/reports/evidence/e2e-date-selected-sep30.png` — Выбранная дата

---

## Вывод

**Невероятно.** Единый E2E поток работает:
1. Summer ADMOO показывает checkIn-20260930 → $1371.64
2. TravelHub отображает Сентябрь 30 → 1 371,64
3. Смена туристов → новый запрос к Summer → новая цена
4. Обратный тест → стабильный результат

**Исправлено 2 P0-ошибки**, добавлены 6 регрессионных тестов. Готово к масс-синхронизации.
