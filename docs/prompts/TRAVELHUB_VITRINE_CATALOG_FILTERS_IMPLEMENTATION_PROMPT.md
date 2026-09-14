Ты работаешь как Staff/Principal Full-Stack Engineer + Payments/FinTech Architect + Enterprise SaaS Architect + Security Engineer + QA/Release Engineer.

# TRAVELHUB — CANONICAL ВИТРИНА
## PRODUCT CATALOG + COMMON/SERVICE-SPECIFIC FILTERS + HOME CONSTRUCTOR SEARCH-BLOCK REMOVAL
### Final Implementation Prompt

---

# 1. ЦЕЛЬ

Реализовать в текущем TravelHub одну canonical публичную **Витрину / Product Catalog** с единым Catalog Search/Filter UI и динамическими service-specific фильтрами.

Одновременно окончательно убрать Search/Filter Block как настраиваемый блок Home из Constructor.

Архитектурная модель:

```text
                         TRAVELHUB
                             |
             +---------------+---------------+
             |               |               |
          Header          Home blocks    Global Search
          Витрина         Показать все       |
             |               |               |
             +---------------+---------------+
                             |
                    CANONICAL ВИТРИНА
                    Product Catalog
                             |
                    Catalog Search/Filters
                             |
                         Results
```

Главный принцип:

> В TravelHub существует одна canonical публичная Витрина. Разные точки входа только передают initial filter/search context и никогда не создают отдельный каталог.

---

# 2. ОБЯЗАТЕЛЬНЫЙ LOCAL ↔ GITHUB SYNC GATE

Перед любой работой:

1. Найти локальную папку проекта.
2. Проверить, что это правильный Git repository.
3. Проверить `origin`.
4. Проверить текущую ветку.
5. Проверить local HEAD.
6. Проверить remote `origin/master` HEAD.
7. Проверить последние commits.
8. Проверить:
   - staged;
   - unstaged;
   - untracked;
   - ahead/behind;
   - working tree.
9. Изучить фактическое содержимое локального проекта.
10. Сопоставить local state и GitHub state.
11. Если local содержит легитимные изменения/коммиты, которых нет в GitHub, безопасно синхронизировать их.
12. Если GitHub новее — безопасно синхронизировать local.
13. Если local и remote расходятся — сначала безопасно определить происхождение изменений и reconciliate.
14. Запрещены:
   - `git reset --hard`;
   - force push;
   - destructive overwrite;
   - silent deletion;
   - fake commit/push.
15. После синхронизации повторно проверить local HEAD, remote HEAD, ahead/behind и working tree.

После Sync Gate именно актуальный synchronized repository является source of truth.

---

# 3. ОБЯЗАТЕЛЬНО ИЗУЧИТЬ ТЕКУЩУЮ РЕАЛИЗАЦИЮ

До изменения кода найти и изучить существующие:

- Marketplace Home;
- Product Catalog;
- Product/ProductPublication;
- ProductType;
- PublicationChannel;
- Search;
- Catalog Search;
- filters;
- service-specific filters;
- geography;
- Country/City/Resort;
- Master Geography;
- Constructor;
- Block Registry;
- ConstructorPage/version/config;
- Structure;
- Content;
- Draft/Published configuration;
- Global Search;
- routes;
- API/DTOs;
- i18n;
- existing tests;
- existing design tokens/components;
- existing mobile responsive patterns.

Особенно проверить, что уже существует.

Не создавать вторую реализацию Catalog/Search/Constructor, если необходимая инфраструктура уже есть.

---

# 4. CANONICAL PRODUCT MODEL

## 4.1 Header

В Header должен существовать один основной catalog entry:

```text
Витрина
```

Не создавать:

```text
Направления
Предложения
Каталог
Витрина submenu
```

как отдельные параллельные entry points.

`Направления` — это географическая концепция/фильтрация.

`Предложения` — содержимое Витрины.

`Storefront` не использовать как название публичной Витрины, поскольку Storefront в архитектуре TravelHub относится к partner channel.

---

# 5. ENTRY POINTS В ОДНУ ВИТРИНУ

## 5.1 Header → Витрина

Открывает canonical Product Catalog:

```text
Услуга = Все
Страна = unset
Город = unset
Курорт = unset
Дата начала = unset
Дата окончания = unset
Туристы = unset
Сортировка = Новые поступления
```

---

## 5.2 Home block → Показать все

Любой service-specific Home block с действием:

```text
Показать все
```

открывает тот же canonical route Витрины.

Пример:

```text
Отели → Показать все
```

передаёт:

```text
service = HOTEL
sort = publishedAt DESC
```

Туры:

```text
service = TOUR
```

Санатории:

```text
service = SANATORIUM
```

и т.д.

Не создавать отдельные catalog pages.

Initial state — только состояние входа. После загрузки Витрина работает как единый Catalog Search.

---

## 5.3 Global Search → Витрина

Global Search сохраняется.

Если результат требует полноценного каталога, Global Search передаёт:

- query;
- service;
- geography;
- dates;
- travelers;
- другие подтверждённые параметры.

После перехода используется тот же canonical Catalog Search.

---

# 6. HOME SEARCH/FILTER BLOCK — УДАЛИТЬ

Search/Filter Block больше не является блоком Home.

Удалить его из:

```text
Constructor → Structure
Constructor → Content
active Draft
active Published configuration
```

Не использовать CSS hide.

Не оставлять мёртвый block registry entry, если он больше не нужен текущей active architecture.

При этом НЕ удалять:

```text
Global Search
Catalog Search infrastructure
Search APIs
filter APIs
service-specific filter architecture
Master Geography
future Catalog Search UI
```

Исторические immutable Constructor versions не изменять и не переписывать.

После remediation active configuration должна быть чистой.

---

# 7. CANONICAL ВИТРИНА — РАСПОЛОЖЕНИЕ

Фильтры находятся непосредственно **над результатами каталога**.

Desktop:

```text
HEADER
  ↓
ВИТРИНА
  ↓
Catalog Search / Filters
  ↓
Results count + Sorting
  ↓
Product Cards
```

Mobile:

```text
ВИТРИНА
  ↓
[ Фильтры ]
  ↓
[ Сортировка ]
  ↓
Product Cards
```

На mobile полный filter UI открывается через drawer/sheet.

---

# 8. ОБЩИЕ ФИЛЬТРЫ

Общая модель:

```text
Услуга
Страна
Город
Курорт
Дата начала услуги
Дата окончания услуги — когда применимо
Туристы
    ├── Взрослые
    └── Дети
          └── Возраст каждого ребёнка
```

## 8.1 Geography

Использовать Master Geography:

```text
Country → City → Resort
```

с canonical IDs.

Зависимости:

```text
Страна
   ↓
Город
   ↓
Курорт
```

При изменении Country очищать несовместимый City/Resort.

При изменении City очищать несовместимый Resort.

Если City сам является resort (`isResort=true`), не создавать искусственный duplicate:

```text
Antalya → Antalya
```

---

# 9. SERVICE-SPECIFIC FILTERS

После выбора услуги показывать только соответствующие фильтры.

## 9.1 Туры

Основные:

- тип тура;
- дата окончания;
- продолжительность / количество ночей;
- тип номера;
- тип питания;
- категория отеля.

Расширенные:

- цена;
- партнёр;
- дополнительные реальные структурированные параметры.

Если существующий функционал позволяет выбирать конкретный отель внутри тура — использовать canonical `hotelId`, а не текстовое название.

---

## 9.2 Отели

Основные:

- дата заезда;
- дата выезда;
- тип номера;
- тип питания;
- категория.

Расширенные:

- цена;
- удобства;
- тип размещения;
- рейтинг;
- другие реальные structured attributes.

---

## 9.3 Санатории

Основные:

- дата заезда;
- дата выезда;
- тип номера;
- тип питания;
- категория;
- лечение.

Дополнительные:

- лечебный профиль;
- программа лечения;
- продолжительность;
- цена;
- другие реальные медицинские/санаторные structured attributes.

---

## 9.4 Авиабилеты

Не пытаться применять hotel/tour date model механически.

Использовать:

- откуда;
- куда;
- дата вылета;
- `Туда-обратно`;
- дата возвращения — только при enabled return;
- взрослые;
- дети;
- младенцы;
- класс обслуживания;
- авиакомпания;
- прямой рейс;
- багаж;
- количество пересадок;
- время вылета;
- длительность;
- цена.

Дата возвращения не может быть раньше даты вылета.

При unchecked return поле return date не показывается и не отправляется.

`Багаж` означает baggage included, если это поддерживается реальными данными.

Не создавать фиктивный весовой filter, если backend не имеет нормализованного baggage allowance.

---

## 9.5 Экскурсии

- тип/тематика;
- продолжительность;
- язык;
- формат;
- возрастные ограничения;
- трансфер;
- место встречи;
- цена;
- другие реальные structured attributes.

---

## 9.6 Гиды

- язык;
- специализация;
- тематика;
- формат;
- продолжительность;
- цена;
- рейтинг;
- транспорт/автомобиль;
- размер группы;
- другие реальные structured attributes.

---

## 9.7 Трансферы

- откуда;
- куда;
- тип трансфера;
- тип/класс автомобиля;
- пассажиры;
- багаж;
- детское кресло;
- встреча в аэропорту;
- время подачи;
- цена.

---

## 9.8 Аренда автомобиля

- класс;
- тип кузова;
- коробка передач;
- тип топлива;
- количество мест;
- количество дверей;
- привод;
- кондиционер;
- место получения;
- место возврата;
- пробег;
- возраст водителя;
- дополнительный водитель;
- страховка;
- цена.

---

## 9.9 Железнодорожные билеты

- откуда;
- куда;
- дата отправления;
- дата возвращения / туда-обратно;
- тип поезда;
- класс;
- тип вагона;
- пересадки;
- время отправления;
- цена;
- перевозчик.

---

## 9.10 Круизы

- круизная компания;
- маршрут;
- порт отправления;
- порт прибытия;
- продолжительность;
- тип каюты;
- категория каюты;
- питание;
- палуба;
- цена;
- пакет услуг;
- другие реальные structured attributes.

---

# 10. ТРИ УРОВНЯ FILTER UX

## Level 1 — Common primary

Всегда доступны:

```text
Услуга
Страна
Город
Курорт
Дата начала
Дата окончания — если применимо
Туристы
```

## Level 2 — Service primary

Появляются после выбора услуги.

Пример:

```text
Отели:
Тип номера | Питание | Категория
```

```text
Санатории:
Тип номера | Питание | Категория | Лечение
```

```text
Авиабилеты:
Откуда | Куда | Даты | Класс | Пересадки
```

## Level 3 — Advanced

Открывается:

```text
Все фильтры
```

Здесь:

- цена;
- рейтинг;
- удобства;
- дополнительные параметры.

Не перегружать initial viewport.

---

# 11. REAL-DATA RULE

Нельзя реализовывать filter только потому, что он есть в архитектурной матрице.

Перед добавлением каждого фильтра проверить:

1. canonical source of data;
2. backend DTO/API;
3. database model или external normalized contract;
4. query implementation;
5. filtering semantics;
6. i18n;
7. tests.

Если backend не поддерживает параметр:

```text
НЕ СОЗДАВАТЬ FAKE UI
```

Можно оставить его как архитектурно предусмотренный будущий capability, но не показывать пользователю.

Не использовать hardcoded fake cities, hotels, airlines, meal plans, medical programs и т.п.

---

# 12. DATE SEMANTICS

Не использовать одно универсальное имя backend field, если семантика услуги различается.

UI:

```text
Дата начала услуги
Дата окончания услуги
```

может отображаться service-aware:

```text
Отели:
Заезд / Выезд

Туры:
Дата начала / Дата окончания

Санатории:
Заезд / Выезд

Авиабилеты:
Дата вылета / Дата возвращения
```

Внутренний normalized search contract должен явно различать значения.

---

# 13. TRAVELERS

Для обычных туристических услуг:

```text
Взрослые
Дети
```

При `Дети > 0`:

```text
Возраст ребёнка 1
Возраст ребёнка 2
...
```

Для авиабилетов дополнительно:

```text
Младенцы
```

Не смешивать infant semantics с child semantics.

Backend/client validation должны быть согласованы.

---

# 14. DEFAULT SORTING

Default:

```text
Новые поступления
```

Canonical sorting:

```text
publishedAt DESC
```

Применяется для:

- Header → Витрина;
- Home → Показать все;
- Global Search → Витрина;
- Витрина без выбранной сортировки.

Не использовать `createdAt`, если canonical publication timestamp — `publishedAt`.

Initial service filter не должен менять default sorting.

---

# 15. CATALOG RESULT BEHAVIOR

Результаты должны использовать существующую Product Catalog infrastructure.

Учитывать:

- только подходящие publication channels;
- только реально published products;
- существующую pagination;
- существующий status model;
- существующую authorization/public access model;
- существующие media;
- existing ProductType.

Не создавать второй Product model или второй catalog API.

---

# 16. EMPTY STATE

Если фильтрованного результата нет:

Показывать честный empty state.

Например:

```text
По вашему запросу ничего не найдено.
Измените параметры поиска или сбросьте фильтры.
```

Если в текущем продукте уже существует `Помочь найти`, использовать существующий механизм Travel Request.

Не создавать fake offers для заполнения каталога.

---

# 17. FILTER STATE

Filter state должен быть URL/shareable, если текущая архитектура route допускает это.

Предпочтительно:

```text
/vitrine?service=HOTEL&country=...&city=...&...
```

Но не ломать существующий canonical routing.

Initial state от Home должен быть отделён от persistent user changes.

После перехода:

```text
Home → Отели → Показать все
```

initial:

```text
service=HOTEL
```

После изменения пользователем фильтров URL/state должен отражать фактическое состояние.

---

# 18. CONSTRUCTOR INTEGRATION

Constructor должен управлять Home presentation.

Constructor НЕ должен управлять Catalog Search как отдельным Home block.

После реализации проверить:

### Structure

```text
Search Block = absent
```

### Content

```text
Search Block = absent
```

### Active Draft

```text
Search Block = absent
```

### Active Published

```text
Search Block = absent
```

Historical immutable versions:

```text
preserved
```

Не удалять исторические версии ради косметической очистки.

---

# 19. HEADER

Header должен содержать:

```text
Витрина
```

как основной catalog navigation entry.

Если сейчас присутствуют:

```text
Направления
Предложения
```

как отдельные catalog/navigation entries, провести аккуратную миграцию к canonical `Витрина`.

Не ломать unrelated Header functionality.

---

# 20. GLOBAL SEARCH

Global Search:

- остаётся;
- не превращается в Home Search Block;
- доступен в Header;
- использует shared search infrastructure;
- может передавать query/context в Витрину.

Не удалять Global Search при удалении Home Search Block.

---

# 21. DESIGN / UX

Использовать существующие TravelHub dark-luxury design tokens.

Витрина должна визуально соответствовать:

- premium;
- dark luxury;
- clean;
- cinematic;
- restrained;
- responsive.

Не использовать:

- emoji;
- случайные icon packs;
- generic Bootstrap/Material/FontAwesome mix;
- дешёвые декоративные элементы.

Использовать существующий approved icon system.

---

# 22. PERFORMANCE

Не загружать весь каталог в browser только ради client-side filtering, если backend уже способен фильтровать.

Предпочтительно:

```text
UI filters
   ↓
normalized query
   ↓
backend API
   ↓
filtered/paginated results
```

Не выполнять N+1 запросы на каждый filter.

Cascading geography lookup должен быть эффективным.

Не делать полный Country/City/Resort dataset частью каждого product response.

---

# 23. ACCESSIBILITY

Проверить:

- keyboard navigation;
- labels;
- focus states;
- semantic controls;
- screen-reader names;
- date inputs;
- dropdowns;
- filter drawer;
- reset/apply controls;
- mobile accessibility.

Не полагаться только на placeholder как label.

---

# 24. I18N

Поддержать существующие языки проекта.

Не хардкодить RU-only labels.

Добавить/обновить:

- filter labels;
- service labels;
- empty states;
- sorting;
- accessibility labels;
- validation messages.

Сохранить существующий i18n architecture.

---

# 25. TESTING

Обязательно проверить:

## Routing

```text
Header → Витрина
```

PASS.

```text
Hotels → Показать все
```

→ same canonical Vitrine.

PASS.

```text
Tours → Показать все
```

→ same canonical Vitrine.

PASS.

Global Search → Vitrine context PASS.

## Common filters

Проверить:

- Country;
- City;
- Resort;
- dates;
- adults;
- children;
- child ages.

## Service filters

Минимум проверить все поддерживаемые service types.

## Dependency behavior

```text
Country change
→ incompatible City reset

City change
→ incompatible Resort reset
```

## Dates

```text
return < departure
```

должно быть невозможно/invalid.

## No fake data

Проверить, что отсутствующие backend capabilities не отображаются как реальные filters.

## Constructor

Проверить:

- Structure;
- Content;
- active Draft;
- active Published.

Search Block отсутствует.

## Responsive

Проверить desktop + mobile.

## Regression

Запустить релевантные:

- backend TypeScript;
- frontend TypeScript;
- backend tests;
- frontend tests;
- Constructor tests;
- Catalog/Search tests;
- build;
- browser E2E.

Pre-existing failures отделить от новых.

---

# 26. BROWSER ACCEPTANCE — ОБЯЗАТЕЛЬНО

Не ограничиваться unit/API tests.

Реально открыть браузер и проверить:

### Scenario A

```text
Header → Витрина
```

Убедиться:

- canonical catalog route;
- filters над results;
- Service=All;
- newest sorting;
- no Home Search Block.

### Scenario B

```text
Home → Отели → Показать все
```

Убедиться:

- same canonical route;
- Service=Отели;
- correct hotel filters;
- newest sorting.

### Scenario C

```text
Home → Туры → Показать все
```

Убедиться:

- same route;
- Service=Туры;
- correct tour filters.

### Scenario D

Выбрать:

```text
Санатории
```

Убедиться, что появляется:

```text
Лечение
```

и другие supported sanatorium filters.

### Scenario E

Выбрать:

```text
Авиабилеты
```

Убедиться, что UI переключается на flight-specific filter set.

### Scenario F

Mobile:

```text
Витрина
→ Фильтры
→ drawer/sheet
```

PASS.

### Scenario G

Constructor:

```text
Structure
Content
```

Search Block отсутствует.

Проверить active Draft/Published, а не только UI picker.

### Browser evidence

В final report указать:

- URLs/routes;
- фактические filter states;
- screenshots/evidence если доступно;
- Console status;
- Network/API status;
- отсутствие hydration/runtime errors.

---

# 27. НЕ ДЕЛАТЬ

Запрещено:

- создавать вторую Витрину;
- создавать отдельные страницы Offers/Directions;
- создавать отдельный search engine для каждой услуги;
- возвращать Search Block на Home;
- скрывать Search Block через CSS;
- удалять Global Search;
- удалять Catalog Search infrastructure;
- создавать fake filters;
- создавать fake catalog data;
- hardcode service dictionaries в UI, если существует canonical backend source;
- переписывать historical Constructor versions;
- ломать Partner Storefront;
- использовать Storefront как название Marketplace Vitrine;
- делать destructive Git operations.

---

# 28. IMPLEMENTATION BOUNDARY

В этом run разрешены:

- необходимые frontend изменения;
- необходимые backend/API изменения;
- необходимые DTO/query changes;
- необходимые filter contracts;
- необходимые tests;
- Constructor active configuration remediation;
- i18n;
- responsive UI;
- документация и report.

Если обнаружится, что определённый filter требует отдельного domain capability, которого нет, не изобретать его.

В таком случае:

1. документировать gap;
2. реализовать только то, что current system truth поддерживает;
3. явно указать deferred capability в report.

---

# 29. FINAL REPORT — ОБЯЗАТЕЛЬНО

Финальный отчёт должен быть физически создан в:

```text
/reports/TRAVELHUB_VITRINE_CATALOG_FILTERS_IMPLEMENTATION_REPORT.md
```

Отчёт обязательно на русском языке.

В отчёте:

1. Verdict.
2. Repository baseline.
3. Local↔GitHub Sync Gate.
4. Local HEAD.
5. Remote HEAD.
6. Branch.
7. Ahead/behind.
8. Working tree.
9. Existing architecture inspected.
10. Canonical Vitrine implementation.
11. Header → Витрина.
12. Home → Показать все.
13. Global Search integration.
14. Common filters.
15. Service-specific filter matrix.
16. Real-data/capability matrix.
17. Date/traveler semantics.
18. Default sorting.
19. Constructor Search Block removal.
20. Active Draft verification.
21. Active Published verification.
22. Historical versions handling.
23. Backend/API changes.
24. Frontend changes.
25. i18n.
26. Responsive/mobile.
27. Browser acceptance.
28. Tests and exact results.
29. Build results.
30. Console/Network findings.
31. Known pre-existing failures.
32. Deferred gaps, if any.
33. Files changed.
34. Git final state.
35. Commit SHA.
36. Push status.

Не писать фиктивные test counts, SHA или browser evidence.

---

# 30. HARD COMPLETION GATE

Работа считается завершённой только если:

### Repository

- Local↔GitHub Sync выполнен.
- final local/remote state проверен.
- рабочее дерево описано.

### Vitrine

- существует одна canonical Витрина;
- Header содержит `Витрина`;
- Home `Показать все` ведёт туда же;
- Global Search может передавать context;
- filters находятся над catalog results;
- common filters реализованы согласно capabilities;
- service-specific filters реализованы согласно capabilities;
- default = `Новые поступления / publishedAt DESC`.

### Constructor

- Search Block отсутствует в Structure;
- Search Block отсутствует в Content;
- active Draft не содержит Search Block;
- active Published не содержит Search Block;
- historical immutable versions не повреждены.

### Quality

- TypeScript проверен;
- relevant tests проверены;
- build проверен;
- browser acceptance выполнен;
- desktop/mobile проверены;
- Console/Network проверены;
- no new regression introduced.

### Artifact

Файл существует:

```text
/reports/TRAVELHUB_VITRINE_CATALOG_FILTERS_IMPLEMENTATION_REPORT.md
```

Нельзя заявлять `COMPLETE`, если report физически отсутствует.

---

# 31. GIT COMPLETION

После реализации:

1. проверить diff;
2. проверить отсутствие unrelated changes;
3. проверить tests/build;
4. проверить report;
5. commit changes;
6. push to `origin/master`, если repository workflow это допускает;
7. re-fetch;
8. проверить:

```text
local HEAD == origin/master
ahead = 0
behind = 0
```

если это достижимо в текущем workflow.

Не использовать force push.

Если commit/push невозможен, честно указать причину и фактический state.

---

# 32. FINAL VERDICT

При полном успехе:

```text
TRAVELHUB VITRINE CATALOG IMPLEMENTATION COMPLETED — CANONICAL VITRINE + SERVICE-AWARE FILTERS + HOME SEARCH BLOCK REMOVED
```

При частичной реализации из-за отсутствующих backend capabilities:

```text
TRAVELHUB VITRINE CATALOG IMPLEMENTATION PARTIALLY COMPLETED — SUPPORTED FILTERS IMPLEMENTED, UNSUPPORTED CAPABILITIES DOCUMENTED
```

При блокирующей проблеме:

```text
TRAVELHUB VITRINE CATALOG IMPLEMENTATION BLOCKED — <EXACT BLOCKER>
```

---

# 33. FINAL RESPONSE

После завершения дать краткий финальный ответ на русском языке.

Обязательно указать:

- verdict;
- что реализовано;
- что удалено из Constructor;
- report path;
- branch;
- final HEAD;
- origin/master;
- commit SHA;
- push status;
- worktree status;
- tests/build;
- browser acceptance;
- deferred gaps, если есть.

Не задавать пользователю вопрос «продолжать ли».

После завершения этого implementation run — STOP.
