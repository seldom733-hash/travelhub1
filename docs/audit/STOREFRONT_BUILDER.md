# Storefront Site Builder — общий движок для партнёров и marketplace

Дата: 2026-10-26.

## Общий BuilderWorkspace и родительский сайт

Структура страницы, библиотека блоков, выбор блока, его настройки,
draft/save/publish и статус вынесены в `components/constructor/BuilderWorkspace.tsx`.
Его используют оба редактора:

- `/app/page-builder` — marketplace, сохраняя вкладки Header / Hero / Search /
  Content / Footer / Design;
- `/partner/storefront/builder` — Storefront, со своим tenant API.

Общие контентные блоки доступны в обоих контекстах:

- `content-about`;
- `content-cta`;
- `content-faq`;
- `content-gallery`.

Marketplace рендерит их через `MarketplaceContentBlock` (тёмная тема),
Storefront — через `StorefrontBlocks` (светлая тема и контакты витрины).

Для `content-faq` и `content-gallery` контент обязателен для вывода: FAQ
принимает строки `вопрос | ответ` (также поддерживаются `—`, `–`, `-` и `:`),
галерея — по одной ссылке на строку. Пустой/некорректный блок не рендерится на
публичной странице; в инспекторе показывается предупреждение и кнопка
«Вставить пример вопросов» для FAQ.

## Что реализовано (MVP)

Партнёрский Storefront получил собственный **tenant-scoped конструктор страницы**
на том же движке `ConstructorPage`, что и главная marketplace:

- `context = "storefront"`, `tenantId = partnerId` (только из сессии);
- автоматическое создание черновика при первом открытии;
- блоки Storefront: hero, «О бизнесе», продукты, CTA, контакты, footer;
- редактирование контента, добавление/удаление/скрытие блоков, порядок;
- сохранение черновика;
- публикация snapshot-версии;
- предпросмотр черновика владельцем;
- публичный рендер только опубликованной версии;
- fallback на старый фиксированный StorefrontSite, если страницы ещё нет;
- аудит `create` / `save_draft` / `publish`;
- tenant isolation и проверка entitlement/lifecycle.

Родительский marketplace использует тот же реестр блоков и тот же
version/publish/audit pipeline. Storefront-блоки не попадают в marketplace,
marketplace-блоки — в Storefront.

## API

| Метод | Путь | Доступ |
|---|---|---|
| GET | `/api/v1/partner/storefront/builder` | `storefront.read_own` |
| GET | `/api/v1/partner/storefront/builder/registry` | `storefront.read_own` |
| GET | `/api/v1/partner/storefront/builder/preview` | `storefront.read_own` |
| PUT | `/api/v1/partner/storefront/builder/sections` | `storefront.update_own` |
| POST | `/api/v1/partner/storefront/builder/publish` | `storefront.update_own` |
| GET | `/api/v1/public/storefronts/:slug/page` | public |

Публичный контракт возвращает `{ page: ... | null }`, не содержит `tenantId`,
внутренний `id`, `draftVersion`/`currentVersion`; при неактивной или
неоплаченной витрине возвращает `{ page: null }`, и публичная страница
использует legacy-шаблон.

## UI

- `/partner/storefront` → кнопка **«Конструктор сайта»**;
- `/partner/storefront/builder` — библиотека блоков, структура страницы,
  настройки выбранного блока, сохранить/опубликовать, предпросмотр;
- `/partner/storefront/preview` — рендер черновика через тот же renderer;
- `/store/:slug` — опубликованные блоки; при отсутствии — прежний шаблон.

## Блоки MVP

| Тип | Источник данных |
|---|---|
| `storefront-hero` | настройки + hero media |
| `storefront-about` | настройки + описание витрины |
| `storefront-products` | только опубликованные продукты партнёра |
| `storefront-cta` | настройки, безопасные ссылки `#`, `/`, `http(s)` |
| `storefront-contacts` | публичные контакты витрины |
| `storefront-footer` | настройки + брендинг TravelHub |

## Безопасность

- `tenantId` никогда не принимается из body;
- партнёр не может открыть/изменить чужую страницу;
- публичный endpoint отдаёт только опубликованный snapshot;
- неизвестные/чужие block types отклоняются;
- произвольный JS/HTML не поддерживается;
- ссылки CTA проходят allowlist-схему;
- публичный ответ очищен от внутренних идентификаторов;
- publish/rollback остаются в существующем audit pipeline.

## Реализовано в builder v3

- drag-and-drop + undo/redo;
- live iframe предпросмотр draft;
- медиатека `GALLERY` с загрузкой, порядком и alt;
- multi-page, меню, SEO на каждую страницу;
- шаблоны и brand kit;
- форма заявки → `sales.Lead`;
- custom domain: установка, TXT-верификация, host-routing.

## Ограничения

- версий/diff/rollback UI всё ещё нет (backend pipeline есть);
- TLS-сертификат для custom domain выпускается инфраструктурой деплоя, не
  приложением;
- host-lookup в `proxy.ts` не кэшируется (для высокого трафика нужен CDN/Redis).

## Тесты

- `backend/src/modules/constructor/block-registry.spec.ts` — 3 теста.
- `backend/test/storefront.e2e-spec.ts` — 44 теста, включая builder:
  tenant page, registry isolation, draft, publish, public blocks, entitlement
  gate, audit.
- `frontend/components/storefront/StorefrontBlocks.spec.tsx` — 2 теста.
- `frontend/lib/public-api.spec.ts` — публичный контракт страницы.
