# Builder v2 — что реализовано

Дата: 2026-10-26.

## Общий BuilderWorkspace

`frontend/components/constructor/BuilderWorkspace.tsx` используется обоими
редакторами:

- `/app/page-builder` — marketplace, с сохранением вкладок Header / Hero /
  Search / Content / Footer / Design;
- `/partner/storefront/builder` — tenant-scoped Storefront.

## Реализовано

### 1. Drag-and-drop
Структура блоков использует `@dnd-kit`; блок можно перетаскивать, также
сохранены кнопки «выше/ниже».

### 2. Undo / Redo
История на 50 шагов для добавления, удаления, скрытия, изменения порядка,
настроек и применения шаблона. Undo/redo работают через
`onReplaceSections`, который подключён и к marketplace, и к Storefront.

### 3. Live iframe
Кнопка **Canvas** открывает iframe предпросмотра. Для marketplace добавлен
`/app/page-builder/preview`, который рендерит **draft** через
`MarketplaceRenderer pageOverride`; для Storefront используется
`/partner/storefront/preview`.

### 4. Шаблоны
Партнёрские шаблоны: «Турагентство», «Туроператор», «Минимальный».
Marketplace: «Marketplace + контент». Применение заменяет структуру и
участвует в undo/redo.

### 5. SEO-редактор Storefront
`PUT /api/v1/partner/storefront/builder/seo` + модальное окно SEO.
SEO сохраняется в page.seo и в текущий published snapshot, поэтому сразу
используется в `generateMetadata` публичной страницы.

### 6. Общие контентные блоки
`content-about`, `content-cta`, `content-faq`, `content-gallery` доступны
в обоих контекстах. FAQ поддерживает `|`, `—`, `–`, `-`, `:`; пустые блоки
не публикуются, в инспекторе есть предупреждение и «Вставить пример вопросов».

### 7. Медиатека галереи
`StorefrontMedia` поддерживает `GALLERY` (до 24 изображений, ordering, alt),
загрузку/удаление в `/partner/storefront`; в галерейном блоке builder можно
выбирать изображения из медиатеки (хранятся как `media:<id>`).

### 8. Форма заявки
Блок `content-form` + публичный `POST /api/v1/public/storefronts/:slug/request`.
Создаёт `sales.Lead` + `LeadHistory` с provenance Storefront; consent
обязателен, honeypot отсекает ботов.

### 9. Brand kit
Акцентный цвет и шрифт хранятся в `designConfig`, публикуются в текущий
snapshot и применяются в публичном Storefront renderer. Управление — кнопка
«Бренд» в builder.

### 10. Multi-page + меню
`GET/POST /partner/storefront/builder/pages`, страницы в `ConstructorPage`
(tenant-scoped), page selector и создание страницы в builder. Публичные
`/store/[slug]/[pageSlug]`, меню из опубликованных страниц; у каждой страницы
свой SEO и published snapshot.

### 11. Custom domain
`PartnerStorefront.customDomain/Status/Token/VerifiedAt`, PATCH/verify/remove
API, TXT-запись `navitravel-verify=<token>`, DNS-проверка через `dns.resolveTxt`.
Публичный `GET /public/domains/resolve?host=`; `proxy.ts` переписывает
верифицированный host на `/store/<slug>`.

## Ограничения

- Custom domain требует, чтобы DNS/TLS для домена были настроены на
  инфраструктуру деплоя; код проверяет владение и маршрутизирует host, но не
  выпускает сертификат.
- `proxy.ts` делает host-lookup на каждом запросе; для высокого трафика нужен
  кэш (Redis/CDN).

## Проверки

- Backend: 177 suites / 2824 tests PASS.
- Storefront E2E: 47 tests PASS (включая SEO, медиатеку, форму, multi-page,
  custom domain).
- Frontend: 76 files / 1118 tests PASS.
- Builds: PASS.
