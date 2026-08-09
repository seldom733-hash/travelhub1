# PHASE 1 — STEP 1.7: PUBLIC MARKETPLACE UI — HOME, SEARCH, CATEGORY, PRODUCT DETAIL

## Статус входа

Steps 1.0–1.6 — APPROVED.

Public backend и routing foundation уже готовы:

- `/` = Public Marketplace;
- `/search`;
- `/products/:slug`;
- `/categories/:slug`;
- `/app/*` = internal application;
- anonymous public Catalog API;
- published-version isolation;
- stable public media delivery;
- category-specific filters;
- PublicProductCard / PublicProductDetail contracts.

Начни только **PHASE 1 — STEP 1.7: Public Marketplace UI**.

Не начинай checkout/payment, Sales, OrderRequested, Booking changes, Partner Cabinet full, Buyer Cabinet full, Reviews/Ratings backend, AI recommendations или SEO hardening beyond minimal technical readiness.

---

## 1. Цель

Сделать первую полноценную публичную витрину TravelHub, где Buyer может:

```text
Marketplace Home
   ↓
Search / Category
   ↓
Product Card
   ↓
Product Detail Page
```

Главная страница TravelHub для anonymous пользователя — витрина туристических услуг, а не Dashboard/Login.

---

## 2. Не переписывай frontend с нуля

Сначала покажи:

- текущий PublicLayout;
- существующий design system/components;
- public routes Step 1.6;
- public API client;
- loading/error/empty states;
- CSS/Tailwind/component library;
- текущие responsive patterns;
- current fonts/icons;
- доступные реальные media из Step 1.5.

Переиспользуй существующие компоненты там, где это разумно.

---

## 3. Marketplace Home `/`

Структура минимум:

```text
Public Header
Hero / Search
Service Categories
Featured / Popular published products
Recommended/Curated section only if authoritative source exists
Popular destinations only if actual data exists
Marketplace trust/value section
Footer
```

Не выдумывай fake recommendations, ratings, discounts или destinations.

Если curated/popular logic ещё отсутствует — используй нейтральный блок published/newest или не показывай секцию.

---

## 4. Public Header

Минимум:

- TravelHub logo/brand;
- search entry;
- categories entry;
- locale selector;
- login;
- account state для authenticated external user;
- переход в internal workspace только для internal roles.

Не показывай internal sidebar/actions.

---

## 5. Hero / Search

Главный поиск должен быть универсальным для marketplace всех туристических услуг.

Минимальный UX:

```text
Что / куда
Категория (опционально)
Даты — только если применимо
Путешественники — только если применимо
[Найти]
```

Не делай Hotel-only search.

После выбора категории frontend может показывать category-specific filters.

Search state должен сериализоваться в URL `/search?...`.

---

## 6. Service Categories

Отобразить канонические категории из public Category API.

Не хардкодить названия как единственный источник истины.

Минимальный список поддерживается backend Master/Baseline:

- Tours
- Accommodation
- Excursions
- Activities & Entertainment
- Flights
- Rail
- Bus / Ground Transport
- Transfers
- Car Rental
- Other Vehicle Rental
- Guides
- Cruises
- Tickets & Events
- Food & Gastronomy
- Wellness & SPA
- Travel Insurance
- Visa Services
- Travel Ancillary Services

UI может группировать/сокращать показ на главной, но все категории должны быть доступны.

---

## 7. Product Card

Создай reusable `ProductCard`, использующий только `PublicProductCard`.

Минимум:

- primary image;
- category;
- title;
- short description;
- location/destination where available;
- duration where available;
- public provider name where allowed;
- priceFrom;
- currency;
- pricingUnit;
- availability summary where real data exists;
- CTA «Подробнее» / equivalent.

Не показывай internal status, partnerId, storage keys, moderation info.

Card должна корректно работать при:
- отсутствии image;
- отсутствии price;
- отсутствии location;
- длинном title;
- отсутствующем availability summary.

---

## 8. Price UX

Если цена есть:

```text
от 120 AZN
```

или эквивалент согласно locale/currency formatting.

Если цены нет:

```text
Цена по запросу
```

или approved localized equivalent.

Не показывать `0`.

Payment/commission/PSP fee на витрине в Step 1.7 не рассчитывать.

---

## 9. Search Results `/search`

Реализовать полноценную страницу результатов:

- search summary;
- category selector;
- category-specific filters;
- sorting;
- pagination;
- Product Card grid/list;
- empty state;
- loading/error states;
- shareable URL.

Использовать public API Step 1.5.

Не фильтровать полный dataset только на клиенте.

---

## 10. Category-specific filters

Frontend получает filter metadata из:

```text
GET /api/v1/public/categories/:slug/filters
```

И динамически строит controls по типам:

```text
string/text
number/integer
boolean
date
time
enum
currency
```

Не создавать отдельный hardcoded filter implementation для каждой категории, если metadata достаточно.

При этом UX-компоненты могут быть специализированными.

---

## 11. Category page `/categories/:slug`

Страница должна иметь:

- category title;
- short category context/description only if authoritative data exists;
- category-specific filters;
- sorting;
- product count;
- Product Card results;
- pagination;
- empty/error states.

Не показывать internal CategorySchema JSON.

---

## 12. Product Detail Page `/products/:slug`

Полноценный публичный PDP.

Минимальная структура:

```text
Breadcrumbs
Title
Category
Provider public info
Media gallery
Price / tariff summary
Primary CTA
Full description
Category-specific attributes
Tariffs / options
Availability
Included / Excluded
Itinerary / program where applicable
Conditions
Cancellation policy where modeled
Location / meeting point where applicable
Related/similar products only if real query exists
```

Не выдумывать отсутствующие sections.

---

## 13. Media Gallery

Использовать stable public media URLs Step 1.5.

Поддержать:

- primary image;
- thumbnails;
- responsive gallery;
- keyboard-accessible navigation;
- lazy loading;
- graceful fallback.

Не использовать moderation signed preview URLs.

---

## 14. Tariffs / Options

Если `PublicProductDetail` содержит tariffs/options:

- показать название;
- цену;
- валюту;
- условия/option details;
- availability context where supported.

Не создавать checkout.

CTA пока может вести к будущему booking/checkout state или показывать controlled «Продолжить» placeholder только если это согласовано UX.

Не создавать Order/Booking напрямую.

---

## 15. Availability UX

Показывать только Catalog discovery availability.

Не обещать реальную резервацию.

Например:

```text
Доступно на выбранные даты
Ограниченное количество мест
Нет данных о доступности
```

только если backend действительно предоставляет соответствующую информацию.

---

## 16. Provider public block

Показывать только public-safe fields.

Минимум:

- brand/display name;
- public profile link only if route exists;
- optional public logo if modeled.

Не показывать CRM/internal data.

---

## 17. Localization — обязательный gap closure

Step 1.6 выявил, что полноценной i18n-инфраструктуры frontend сейчас нет.

На Step 1.7 нужно заложить минимально корректную RU/AZ/EN localization architecture.

Требования:

- UI labels минимум RU/AZ/EN;
- locale selector;
- выбранный locale сохраняется предсказуемо;
- технические slug/code не локализуются;
- currency/date/number formatting через locale-aware APIs;
- Product content отображается в локализованной версии, если backend её предоставляет;
- если перевода Product нет — использовать documented fallback, не машинный перевод «на лету» без отдельного сервиса.

Если выбор URL-prefix `/ru`, `/az`, `/en` меняет уже утверждённую routing architecture — сначала `ARCHITECTURE DECISION REQUIRED`.

Можно реализовать locale state/cookie без изменения URL, если это лучше текущему проекту.

---

## 18. Responsive design

Обязательные breakpoints/behaviour:

- mobile;
- tablet;
- desktop.

Проверить:
- header;
- search;
- category navigation;
- filters drawer/sidebar;
- Product Card grid;
- PDP gallery;
- tariffs;
- long localized text.

---

## 19. Accessibility

Минимум:

- semantic headings;
- alt text;
- keyboard navigation;
- focus states;
- form labels;
- accessible filter controls;
- contrast;
- buttons/links semantics;
- image gallery keyboard support.

---

## 20. Loading / Error / Empty states

Для Home, Search, Category, PDP:

- skeleton/loading;
- API error;
- empty results;
- not found;
- image fallback.

Не показывать raw backend error/stack.

---

## 21. Public/internal isolation

Даже после login Marketplace продолжает использовать public API.

Нельзя:

```text
logged-in user on /
→ internal Catalog API
```

Внутренний `/app/*` остаётся отдельным контуром.

---

## 22. Analytics hooks readiness

Можно добавить нейтральные event hooks/interfaces:

```text
marketplace.product_impression
marketplace.product_open
marketplace.search
marketplace.filter_applied
```

Но не подключать конкретного analytics vendor без отдельного решения.

Не хранить sensitive data в event payload.

---

## 23. Performance

Проверить:

- Next image strategy or equivalent;
- lazy loading;
- no oversized original image in cards;
- use thumb for cards, large for PDP;
- avoid duplicate public API calls;
- no internal bundle leakage;
- pagination;
- layout shift.

Не вводить premature global cache complexity.

---

## 24. Security

Проверить:

- XSS from Product text;
- unsafe HTML rendering;
- untrusted media URL;
- query parameter injection;
- open redirects;
- internal data leakage;
- public/internal API separation.

Не использовать `dangerouslySetInnerHTML` для partner content без sanitization.

---

## 25. Tests

Минимально доказать:

1. `/` рендерит Marketplace, не Dashboard;
2. categories загружаются public API;
3. Product cards используют только public DTO;
4. card без price показывает корректный fallback;
5. card без image не ломается;
6. search state отражается в URL;
7. category-specific filters строятся из metadata;
8. filter changes вызывают public API;
9. sorting работает;
10. pagination работает;
11. category page работает;
12. PDP рендерит published Product;
13. unpublished PDP → 404;
14. gallery использует stable public media routes;
15. staged media не отображается;
16. tariffs/options отображаются;
17. availability не создаёт Booking;
18. public provider block не содержит private fields;
19. RU UI работает;
20. AZ UI работает;
21. EN UI работает;
22. locale switch сохраняется;
23. currency/date formatting locale-aware;
24. mobile layout smoke test;
25. keyboard navigation smoke test;
26. public pages не вызывают internal Catalog API;
27. anonymous/internal role routing Step 1.6 не сломан;
28. frontend build/typecheck/tests зелёные;
29. backend regression Step 1.5 остаётся зелёным.

---

## 26. Не делать в Step 1.7

Не реализовывать:

```text
checkout
cart
Payment
PSP
split payment
Sales
OrderRequested
Booking creation
Buyer Cabinet full
Partner Cabinet full
Reviews/Ratings backend
AI recommendations
advanced SEO
sitemap
marketing CMS
```

---

## 27. Definition of Done

Step 1.7 завершён только если:

- полноценная Public Marketplace Home существует;
- Search UI работает;
- Category UI работает;
- reusable ProductCard готов;
- полноценный PDP готов;
- published media gallery работает;
- tariffs/options/availability отображаются;
- public/internal API isolation сохранена;
- responsive UX есть;
- RU/AZ/EN UI localization foundation реализована;
- accessibility baseline выполнен;
- frontend tests/typecheck/build зелёные;
- backend regression не сломан.

---

## 28. После выполнения

Предоставь:

1. список изменённых файлов;
2. Marketplace Home structure;
3. ProductCard;
4. Search UI;
5. Category page;
6. PDP structure;
7. media gallery;
8. tariffs/options UX;
9. availability UX;
10. localization architecture RU/AZ/EN;
11. responsive behaviour;
12. accessibility;
13. public/internal API isolation;
14. frontend tests;
15. Playwright/browser tests;
16. build/typecheck;
17. backend regression;
18. screenshots/route verification summary if available;
19. git diff summary;
20. найденные проблемы;
21. `ARCHITECTURE DECISION REQUIRED`, если есть.

Не переходи к Step 1.8 автоматически.

Финальная строка строго:

```text
PHASE 1 STEP 1.7 COMPLETED — WAITING FOR REVIEW
```
