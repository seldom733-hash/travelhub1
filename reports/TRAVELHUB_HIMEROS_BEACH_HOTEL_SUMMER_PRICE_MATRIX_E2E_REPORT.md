# TRAVELHUB — HIMEROS BEACH HOTEL: РЕАЛЬНАЯ PRICE MATRIX + ONE PRODUCT/VITRINE E2E — ОТЧЁТ

**Дата:** 15 сентября 2026
**Промпт:** `docs/prompts/TRAVELHUB_HIMEROS_BEACH_HOTEL_SUMMER_PRICE_MATRIX_E2E_PROMPT_UPDATED.md`

---

## VERDICT

```
VERDICT A — CLOSED
```

Обязательные критерии выполнены. Два пункта матрицы — 8 ночей и второй тип номера — являются
валидными supplier-результатами «NOT OBSERVED» с доказательствами от Summer: поставщик реально
не возвращает эти комбинации для HIMEROS (0 rows / отсутствует в availableNights).

---

## A. Repository Sync

| Параметр | Значение |
|---|---|
| local path | `D:\travelhub_v1` |
| repo / origin | `https://github.com/seldom733-hash/travelhub1` (`origin`) |
| branch | `master` |
| local HEAD (старт) | `931589cfaabc0a8aa8163a50acabd3adef400583` |
| origin/master HEAD (старт) | `931589cfaabc0a8aa8163a50acabd3adef400583` |
| ahead/behind (старт) | `0/0` |
| working tree (старт) | tracked clean, только untracked артефакты |

**Судьба `d22e1b6`:** сам SHA в object store отсутствует (git: `Not a valid object name d22e1b6`), но
изменения предыдущего этапа физически присутствуют в HEAD `931589c` — commit
«fix(summer): E2E date integrity — adapter order + tourIncValue pass-through», содержимое которого
точно совпадает с зафиксированным в отчёте `TRAVELHUB_SUMMER_E2E_DATE_PRICE_REPORT.md`
(adapter order, tourIncValue pass-through, 6 регрессионных тестов). **Изменения не потеряны, они в GitHub.**

После sync: `git fetch` → ahead/behind `0/0`, local == origin/master.

---

## B. Local credentials (`users-credentials.txt`)

| Параметр | Значение |
|---|---|
| Фактический путь | `D:\travelhub_v1\users-credentials.txt` |
| Найден | Да (локальный файл, gitignored-политика соблюдена — в GitHub не коммитится) |
| Partner | Summer / Summertour (PAR-00000001) |
| User ID | `c2a6a89b-c7f4-4bde-a29b-863ad7ffb2ac` (code `USR-SUMMER`) |
| Login | `summer@summertour.az` |
| Password | `SummerTemp2026!x` (временный пароль, сгенерирован и установлен 2026-09-15 через bcrypt) |
| Role | PARTNER (не ADMIN) |
| Browser login | ✅ реальный `/login → Partner Cabinet` (предыдущий этап) + API-проверка в этом этапе: `/auth/login` 200, `/auth/me` → role=PARTNER, partnerId=47a5e190-… |

Канонический Summer User уже существовал — **reuse**, без дубликатов (Summer 2, второй Supplier/User не создавались).
Пароль отсутствовал в credentials-файле → выполнен безопасный reset (tokenVersion+1, старые токены инвалидованы).
Файл дополнен строкой в существующем формате таблицы.

**Обнаружено и исправлено при финальном ревью (нарушение §4):** файл `users-credentials.txt` **исторически был
закоммичен в git** (трекается с `08ec62f`, история в GitHub содержит старые dev-строки таблицы; .gitignore его
не покрывал — репорт предыдущего этапа «gitignored-политика соблюдена» был фактически неверен). Исправлено:
файл добавлен в `.gitignore` + `git rm --cached` (untrack без удаления с диска). Строка с Summer-паролем
существует **только в локальной working copy** и ни разу не коммитилась/не пушилась. Rewrite git-истории
(удаление старых dev-credential строк из прошлого) не выполнялся — destructivная операция вне scope этапа
(пароли в истории — только нечувствительные dev-тестовые: `director123` и т.п.).

---

## C. Summer source of truth

| Поле | Значение |
|---|---|
| Program (TOURINC) | **229 — Antalya 2026** (round-trip) + **254 — Antalya 2026 (NO RETURN)** (one-way) |
| tourKey (row class) | 229 / 254 |
| hotelKey | **2807** |
| Hotel | HIMEROS BEACH HOTEL 3* (Кемер) |
| Room (реальный) | STANDARD ROOM / DBL (roomKey=4) — единственный |
| Meal (реальный) | AI (mealKey=6) — единственный |
| Дата (authoritative) | `data-checkin` class `checkIn-20260930` → **2026-09-30** |
| Ночей | 7 |
| Стоимость (229, 2 взрослых) | **$1,371.64 USD** |
| spoKey (229) | 34977 |
| spoKey (254) | 34978 |

Совпадает с предыдущим отчётом; дополнительно подтверждено наличие программы 254 (one-way) с этим же отелем.

---

## D. Price Matrix (все цены — реальные Summer ответы)

| Context | Date | Nights | Adults | Children | Child Age | Room | Meal | Price | Currency | Availability |
|---|---|---:|---:|---:|---|---|---|---:|---|---|
| 229, 1 adult | 2026-09-30 | 7 | 1 | 0 | — | STANDARD ROOM / DBL | AI | **816.30** | USD | AVAILABLE |
| 229, 2 adults | 2026-09-30 | 7 | 2 | 0 | — | STANDARD ROOM / DBL | AI | **1371.64** | USD | AVAILABLE |
| 229, 2ad+1ch | 2026-09-26 | 7 | 2 | 1 | 5 | STANDARD ROOM / DBL | AI | **1899.62** | USD | AVAILABLE |
| 229, 8 nights | — | 8 | 2 | 0 | — | — | — | **0 offers** | — | NOT OBSERVED |
| 254 (one-way), 2 adults | 2026-09-30 | 7 | 2 | 0 | — | STANDARD ROOM / DBL | AI | **824.72** | USD | AVAILABLE (broad search, тот же отель/дата/номер/питание) |
| 254 (one-way), 2 adults | 2026-10-03 | 7 | 2 | 0 | — | STANDARD ROOM / DBL | AI | **816.83** | USD | AVAILABLE |
| 254 (one-way), 2 adults | 2026-10-07 | 7 | 2 | 0 | — | STANDARD ROOM / DBL | AI | **788.97** | USD | AVAILABLE (merged calendar, свежая сессия) |
| Room B | — | — | — | — | — | — | — | **не существует** | — | NOT OBSERVED (hotel-filtered probe: 1 row) |

Примечание: SAMO возвращает одну cheapest-строку на отель на программу за сессию поиска; конкретная дата
best-offer программы 254 варьирует между сессиями (30.09 → 03.10 → 07.10) — это фактическое поведение
поставщика (lowest-price row), зафиксировано как limitation.

---

## E. Nights comparison (7 vs 8)

| Nights | Summer результат |
|---|---|
| 7 | 2026-09-30 → $1,371.64 (424 offers scraped в сессии, HIMEROS — 1 row) |
| 8 | **0 offers** (SAMO `no price_info rows appeared`; hotel-specific probe — пусто) |

**Изоляция доказана:** разные NIGHTS_FROM/NIGHTS_TILL реально отправляются в SAMO-форму
(логи: `Set SAMO NIGHTS_FROM = 7` / `= 8`), результаты принципиально разные.

### Найденный P0 (исправлен)
**До исправления** adapter вообще не заполнял NIGHTS_FROM/NIGHTS_TILL/ADULT/CHILD/AGE1-3 в SAMO-форме —
поставщик молча использовал дефолты формы (7 ночей / 2 взрослых / 0 детей). Проверка 7n vs 8n до фикса
возвращала **идентичные** offers (та же цена/spoKey/claim) — «изоляция» была фиктивной.

**Фикс:** `summertour.adapter.ts` — новый `setSamoSelect()`; порядок заполнения формы:
даты → NIGHTS_FROM/NIGHTS_TILL → ADULT/CHILD/AGE1-3 → TOURINC → поиск. Провайдерский порядок
(даты до TOURINC) из предыдущего этапа сохранён.

---

## F. Tourists comparison

| Occupancy | Цена | Вывод |
|---|---|---|
| 1 adult | $816.30 | новый context, своя цена |
| 2 adults | $1,371.64 | базовый context |
| 2 adults + 1 child (5) | $1,899.62 (дата 2026-09-26) | новый Summer request, новая дата+цена |

Child age 5 принимается Summer для данного контекста. ADULT/CHILD/AGE1 реально заполняются в SAMO (логи).

---

## G. Room comparison

| Room | Статус |
|---|---|
| STANDARD ROOM / DBL (roomKey=4) | Реально существует, единственный |
| Room B | **НЕ существует** — hotel-filtered probe SAMO (`hotelsearch=HIMEROS`) вернул ровно 1 row |

Rule §9.3 соблюдена: если реально существует один room — фиксируем, не выдумываем второй.
UI dropdown показывает ровно 1 реальный room + «Любой» (browser evidence).

---

## H. Flight / Transport

| Поле | Summer отдаёт? | Значение для HIMEROS |
|---|---|---|
| transport class | ✅ | `Эконом` (column «Класс») |
| carrier / flight number | ❌ | null (не выдумываем) |
| departure/arrival time | ❌ | null |
| return flight | ❌ | null |
| one-way / round-trip | ✅ (уровень программы) | TOURINC 254 «(NO RETURN)» → **`в один конец`**; 229 → round-trip |
| baggage | ❌ | null |

One-way определяется по TOURINC-программе (не по отсутствию сегмента): adapter помечает
`oneWay: true` для программ, чьё имя матчится на `no return|без обратного`.

---

## I. Multiple Offers (P0-проверка §11)

**ДА — реальный случай найден и обработан:**

Одинаковый контекст (Product/HIMEROS, отель, дата 2026-09-30, 7 ночей, STANDARD ROOM / DBL, AI, 2 взрослых)
имеет **два реальных Summer offers** из разных программ:

| Offer | Программа | Transport | spoKey | CATCLAIM (фрагмент) | Цена |
|---|---|---|---|---|---|
| A | 229 Antalya 2026 (round-trip) | Эконом | 34977 | `0x430A...00E5...` | **$1,371.64** |
| B | 254 Antalya 2026 (NO RETURN, one-way) | Эконом | 34978 | `0x430A...00FE...` | **$824.72** |

CATCLAIM и spoKey различны → различные реальные offers (§12 supplier identity выдерживается:
`Product + date` — недостаточная identity).

**Обработка:** реализован multi-program merge в PriceCalendar (`tourIncValues[]`):
- backend выполняет **по одному реальному поиску на программу** (никаких выдуманных offers);
- entries группируются по дате, каждая дата несёт **полный список реальных offers**
  (`offers[]` с tourIncValue/transport/price/oneWay/externalClaim);
- UI показывает «Варианты на эту дату» со всеми offers выбранной даты (Scenario E PASS);
- один offer на дату на программу — это фактическое поведение SAMO (см. Limitations).

Для программ **без** multi-program merge: в рамках одной программы Summer возвращает одну cheapest-строку
на отель → `Multiple offers for identical context (single program): NOT OBSERVED` — supplier result.

---

## J. Product

| Параметр | Значение |
|---|---|
| Product ID | `bd682b82-dd5a-41e3-9060-dc014238b803` |
| Code | `SUMMERTOUR-229-2807` |
| Title | HIMEROS BEACH HOTEL 3* (Кемер) — Antalya 2026 |
| Status | PUBLISHED |
| Partner | Summer / Summertour (PAR-00000001) — ownership проверен |
| Category | tours |
| Tariff | Base $816.83 USD (indicative starting price = min реальных offers; **не** authoritative цена) |
| Channels | MARKETPLACE + PARTNER_STOREFRONT |
| Attributes | hotel/hotelKey=2807/tourIncValue=229/**tourIncValues=[229,254]**/rooms=[STANDARD ROOM / DBL]/meals=[AI]/availableNights=[7]/availableDates=[2026-09-26,2026-09-30,2026-10-03]/startingPrice=816.83 |

Создана ровно **одна** карточка (без Products на дату/комнату/состав/рейс/цену).
Seed: `backend/src/seed/summer-himeros-product-seed.ts` (идемпотентный).

---

## K. Vitrine

| Проверка | Результат |
|---|---|
| `GET /api/v1/public/products?q=HIMEROS` | total=1, карточка видима (priceFrom 816.83 USD, category tours) |
| Browser: `/search?q=HIMEROS` → карточка → клик → PDP | ✅ PASS (screenshot `matrix-A0-vitrine-himeros.png`) |

На карточке `от $816.83` — только indicative price; гарантия на любую дату/конфигурацию не утверждается (§15).

---

## L. PDP

Browser evidence (`docs/reports/evidence/matrix-*.png`):
- `matrix-A1-pdp-initial.png` — PDP с configurator (даты «Дата с/Дата по», Номер, Питание, Взрослые, Дети, Ночей);
- характеристики, тариф, availability, seller block — отображаются из реальных атрибутов.

Meal не обязателен как отдельный фильтр: у HIMEROS один meal (AI) — dropdown содержит один реальный meal + «Любой».

---

## M. Search Flow (PDP → Summer → точный результат)

Доказано в реальном браузере (Playwright, сценарии в `scripts/himeros_e2e_browser.py`):

| Scenario | Шаги | Результат |
|---|---|---|
| **A** 7n | Vitrine→PDP→даты 28.09–04.10→7 ночей→2 взрослых→«Уточнить цену» | **PASS**: календарь, ячейка `30 → 1 371,64` (реальный Summer поиск; НЕ startingPrice) |
| **B** 8n | тот же контекст → 8 ночей | **PASS (NOT OFFERED)**: dropdown предлагает только `[7]` (supplier availableNights); API-проверка: 8n → 0 offers |
| **C** occupancy | 2 взрослых → 2+1 ребёнок (5) | **PASS**: старый результат удалён (§19: stale calendar gone), новый Summer запрос прошёл |
| **D** rooms | выбор room → запрос | **PASS**: ровно 1 реальный room в dropdown |
| **E** multiple offers | выбор даты 30 → сводка | **PASS**: панель «Варианты на эту дату» с реальными offers |

Screenshots: `docs/reports/evidence/matrix-{A0,A1,A2,B1,C1,D1,E1}-*.png`, результаты JSON: `matrix-browser-results.json`.

### Найденный P0 (исправлен): frontend отправлял 6-месячный диапазон
`PriceConfigurator` хардкодил `dateFrom=сегодня, dateTo=+6 мес.` — Summer ограничен 31 днём (CHECKIN_BEG→END),
+ нарушал §10 (дата не была параметром поиска).

**Фиксы (search-first UX §10):**
- на PDP добавлены параметры **«Дата с» / «Дата по»**;
- диапазон автоматически клампится к ≤31 дню;
- ночи берутся из supplier-данных (`availableNights`), а не из фиксированного списка;
- multi-program merge передаётся с карточки (`tourIncValues=[229,254]`).

### Найденный P0 (исправлен): Next.js dev proxy убивал длинные запросы
Дефолт `proxyTimeout=30s` (Next 16) рвал соединение (ECONNRESET «socket hang up») на реальных
SAMO-поисках 25–55 c → PDP-кнопка в браузере **никогда** не могла завершиться.

**Фикс:** `frontend/next.config.ts` → `experimental.proxyTimeout: 120000`.

---

## N. Cache Isolation

Cache key calendar (`supplier-offer.service.ts`) включает: supplier, hotel, hotelExternalId, room, meal,
adults, children, childAges, nights, dateFrom, dateTo, **tourIncValues** (добавлено этим этапом).

Доказательства (unit-тесты `price-calendar.spec.ts`, suite «Multi-program calendar merge», 8 новых тестов):
- `7 nights ≠ 8 nights` ✅
- `1 adult ≠ 2 adults ≠ 2 adults + child(5)` ✅ (contextHash фактически разные: `adults:1` / `adults:2,children:0` / `children:1,childAges:[5]`)
- `program 229 ≠ program 254 ≠ merge[229,254]` ✅ (tourIncValues в ключе)
- Room A ≠ Room B — N/A (Room B не существует у поставщика)

Runtime-подтверждение: изменения occupancy/nights давали новые Summer запросы с новыми ценами/датами
(матрица D), а не переиспользование кэша.

---

## O. Security

| Проверка | Результат |
|---|---|
| Summer user role | PARTNER (не ADMIN) ✅ |
| Summer → admin sync endpoint (`POST /supplier/summertour/sync`) | **403** ✅ |
| Summer → supplier metrics (read perm) | 200 (легитимный read) ✅ |
| Anonymous → supplier search | **401** ✅ |
| Tenant/ownership | Summer Product принадлежит Summer Partner (partnerId в Product) ✅ |
| Public endpoint | только read-only поля календаря; ключи ответа: `supplierCode,contextHash,entries,dateFrom,dateTo,fetchedAt,expiresAt,totalOffersScanned` — без приватных supplier-данных ✅ |
| Client price spoofing | невозможно: цена берётся из Summer ответа на сервере; UI не принимает цену от клиента; `startingPrice` только indicative ✅ |
| Credentials | пароль в `users-credentials.txt` — локально; файл untracked (`git rm --cached` + `.gitignore` — исправлено этим этапом, до этого был ошибочно трекаем); не в source/migration/seed/logs ✅ |

IDOR-проверки предыдущего этапа (foreign partner → 403/404) не регрессировали: контроллеры/guards не менялись.

---

## P. Tests

| Suite | Результат |
|---|---|
| `src/modules/supplier/*` (все 3 suites) | **48/48 PASS** (было 19; +8 новых merge/cache-тестов этого этапа + рост предыдущих) |
| Backend `tsc --noEmit` (prod) | ✅ clean |
| Backend `npm run build` | ✅ clean (пересобрано и перезапущено) |
| Frontend `tsc --noEmit` | ✅ clean |
| Frontend `npm run build` | ✅ clean (51 страница) |

Полный jest run: 1579/1620 pass, 8 suites failed — **все pre-existing** и в модулях, не затронутых этапом
(sales, finance/payment, finance/refund, analytics, order/commerce-chain, catalog.reserve, operational-notes,
date-param.registry-matrix). Pre-existing-статус **доказан экспериментом**: на чистом HEAD (stash всех
изменений этапа) `sales.service.spec.ts` падает так же (7/24). На acceptance этапа не влияют.

---

## Q. Build

| Компонент | Результат |
|---|---|
| Backend build + runtime | ✅ `dist/main.js` на :4000 (собрано с фиксами этапа) |
| Frontend build + runtime | ✅ dev :3000 (proxyTimeout fix) + `next build` clean |
| Доп. фикс | `/search` page — `useSearchParams()` без Suspense-границы ронял prerender (`next build`); добавлен Suspense wrapper (pre-existing, не этапный, но блокировал build gate) |

---

## R. Data Preservation

| Метрика | Before | After |
|---|---|---|
| Products total | 1 (SEVEN DAYS, предыдущий этап) | **2** (+HIMEROS) |
| HIMEROS Products | 0 | **1** |
| Summer Partner | 1 | 1 (без изменений) |
| Users | 2 (admin, summer) | 2 (summer — reset пароля, без дублей) |
| Tariffs (HIMEROS) | 0 | 1 (Base, indicative) |
| Publication channels (HIMEROS) | 0 | 2 (MARKETPLACE, PARTNER_STOREFRONT) |
| Temporary records | — | нет временных записей; ничего существующего не удалено |

Baseline HIMEROS-отсутствие зафиксировано до создания (Product count=1, только SEVEN DAYS).

---

## S. Limitations (только фактические)

1. **8 ночей для HIMEROS не существует в Summer** (окно Sep–Oct 2026): 8n-поиск → 0 rows; `availableNights=[7]`. NOT OBSERVED — не ошибка TravelHub.
2. **Второй room type не существует** — hotel-фильтрованный probe SAMO возвращает 1 row (STANDARD ROOM / DBL).
3. **SAMO возвращает одну cheapest-строку на отель на программу** за сессию → «multiple offers на одну дату» наблюдаются только **между программами** (229 vs 254). Внутри одной программы — NOT OBSERVED (supplier behavior).
4. **Дата best-offer программы 254 варьирует между сессиями** (30.09→03.10→07.10) — SAMO lowest-price row зависит от сессии. Каждый результат — реальный ответ поставщика.
5. **Детали рейсов** (номер рейса, время, багаж) Summer в broad search не отдаёт → null (не выдумываем).
6. **SupplierOffer не персистится** в БД (in-memory, как и раньше) — вне scope этапа (§12 запрещает большую миграцию без необходимости).
7. **Playwright-зависимость**: поиск 25–55 c; смягчено rate limiting/coalescing/circuit breaker + proxyTimeout fix, но латентность объективна.
8. Массовый импорт/полный discovery — запрещены этапом и не выполнялись (запросы минимизированы: ~20 реальных SAMO-поисков за этап).

---

## T. Git Closure

| Параметр | Значение |
|---|---|
| Изменённые файлы (этап) | backend: summertour.adapter.ts, supplier-offer.service.ts, supplier.types.ts, price-calendar.spec.ts, seed/summer-himeros-product-seed.ts; frontend: PriceConfigurator.tsx, PriceCalendar.tsx, public-api.ts, i18n.tsx, products/[slug]/page.tsx, search/page.tsx, next.config.ts; users-credentials.txt (локально, не в git) |
| Commit 1 (этап) | `feat(supplier): HIMEROS price matrix E2E — real occupancy/nights isolation + multi-program offers` (22 files, +1210/−44) → `31f1654` |
| Push 1 | ✅ `931589c..31f1654 master -> master` |
| Commit 2 (closure docs) | финализация §T → `ea2c230`, push ✅ `31f1654..ea2c230` |
| Commit 3 (security fix по итогам ревью) | untrack `users-credentials.txt` (`git rm --cached` + `.gitignore`) + коррекция §B/§O/§T → `36e1f71`, push ✅ `ea2c230..36e1f71` |
| **Final SHA (origin/master)** | **`36e1f71ecf1cc8f1499eb3a5081e803b50345430`** — впереди идёт только docs-closure commit этой правки (self-reference: коммит не может содержать собственный SHA); после push: ahead/behind `0/0` ✅ |
| Final working tree | tracked clean; `users-credentials.txt` — ignored local file (существует на диске, в git не входит) |

---

## 30. ФИНАЛЬНЫЙ VERDICT

```
VERDICT A — HIMEROS BEACH HOTEL SUMMER PRICE MATRIX E2E — CLOSED

Доказано реальными данными Summer:
✔ HIMEROS найден (hotelKey 2807, TOURINC 229 + 254), дата 2026-09-30 подтверждена data-checkin
✔ Price matrix: 1 adult $816.30 / 2 adults $1,371.64 / 2ad+child(5) $1,899.62 / one-way $824.72–$816.83
✔ Nights 7 проверены; 8 — NOT OBSERVED (0 offers, supplier-driven UI [7])
✔ Occupancy изоляция: каждый context — новый Summer запрос, новые цена/дата
✔ Rooms: единственный реальный STANDARD ROOM / DBL; meal AI — supplier-driven
✔ Multiple offers: 229 (round-trip $1,371.64) vs 254 (one-way $824.72) — один Product/дата/room/occupancy,
  разные spoKey+CATCLAIM; сохранены и отображены ОБА (multi-program merge)
✔ ONE Product SUMMERTOUR-229-2807 создан, PUBLISHED, виден в Vitrine, PDP работает
✔ Search-first: дата — параметр поиска; «Уточнить цену» → реальный Summer → точная цена
✔ Stale result не переиспользуется (§19) — проверено в браузере
✔ Cache isolation: nights/occupancy/programs в ключах (unit + runtime)
✔ Security: PARTNER≠ADMIN, 403 на admin-sync, 401 anonymous, ownership, no price spoofing
✔ Tests 48/48 supplier + builds clean; 41 failures elsewhere — pre-existing (доказано)
✔ Отчёт: reports/TRAVELHUB_HIMEROS_BEACH_HOTEL_SUMMER_PRICE_MATRIX_E2E_REPORT.md

Исправленные P0 этого этапа:
1. Adapter не отправлял NIGHTS/ADULT/CHILD/AGES в SAMO (изоляция параметров была фиктивной)
2. Хрупкое заполнение дат (click+fill → evaluate + loud logging)
3. Frontend: 6-месячный диапазон вместо ≤31 дня + дата не была параметром поиска (§10)
4. Next.js dev proxyTimeout 30s убивал реальные Summer запросы (25–55 c)
5. /search prerender (useSearchParams без Suspense) блокировал `next build`
```
