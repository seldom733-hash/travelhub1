# M0-03. Assumptions Register (WhatsApp, после аудита)

Формат: `[A-xx]` — предположение/дефолт, требующий подтверждения (R6), `Тип`:
`код` (вывод из кода, достаточно задокументировать), `вопрос` (блокирующий до M1 — §10),
`предложение` (безопасный дефолт, утверждает владелец).

| ID | Предположение / вопрос | Тип | Основание (evidence) | Статус |
|---|---|---|---|---|
| A-01 | Notification-слоя в проекте **нет**; минимальный channel-agnostic слой создаётся рядом с `communication` (не в `whatsapp/`), §4.1 | код | grep `Notification\|notification` по `backend/src/**` → 0 совпадений | подтверждено кодом; **[вопрос]** §10 п.1 → владелец подтверждает размещение |
| A-02 | Подключение Baileys в CJS-бэкенде — через **dynamic `await import('baileys')`** внутри адаптера (пакет ESM-only `"type":"module"`); не полагатьсяся на `require(ESM)` | предложение | `@whiskeysockets/baileys@6.7.24/package.json` → `"type":"module"`, `main: lib/index.js`; backend — `module: commonjs` (`backend/tsconfig.json`), `type` не задан; CI Node 22 / локально v24.18.0; `engines.node >=20` | подтверждено в M2 (loader/adapter/provider contract-тесты зелёные, boundary-тест 2/2) |
| A-03 | Схема `whatsapp` добавляется в `datasource db.schemas`; таблицы только с metadata (I2) | код | `prisma/schema.prisma:24-26` (16 схем), enum/comment `:2659-2660` | подтверждено кодом |
| A-04 | `Customer.phone` сырой (nullable, без индекса/unique) → дубли номеров возможны; **backfill к E.164 НЕ делаем молча** — предложить владельцу | код + вопрос | `schema.prisma:1888`, grep phone-helper → 0; D4 требует предложения backfill | **[вопрос]** §10 п.3 |
| A-05 | Язык клиента нигде не хранится → уведомления на platform default **`ru`**, не угадывать по входящему/browser | предложение | `Customer` без поля языка (`schema.prisma:1880-1900`); frontend-locale только в `localStorage["travelhub.locale"]` (`lib/behavioral-events.spec.tsx:124`), canonical ru/az/en (`lib/i18n.tsx`) | **[вопрос]** §10 п.2 |
| A-06 | `fromMe` (сообщения с телефона вне TravelHUB) → OUTBOUND + `sentOutsideTravelHub=true` | предложение | D8 `[ASSUMPTION]`; иного механизма учёта нет | **[вопрос]** §10 п.4 |
| A-07 | Opt-out хранить в `whatsapp.WhatsAppSuppression` (с audit); перенос в CRM — при решении владельца | предложение | D9; в CRM таблицы preference нет | **[вопрос]** §10 п.5 |
| A-08 | Шаблоны — версионируемые файлы в репо `…/notification/templates/{ru,az,en}.ts`; DB-шаблоны — отдельная задача | предложение | D11; notification-слоя нет (A-01) | **[вопрос]** §10/D11 |
| A-09 | Маппинг прав: `read` — internal-роли; `session.admin`/`manage` — ADMIN+OPERATOR; `send` — ADMIN+OPERATOR+SALES_MANAGER; `recover` — только ADMIN; `link/unlink` → `whatsapp.manage` | предложение | `permissions.constants.ts` (dotted-ключи), роли `INTERNAL_ROLES` (`frontend/lib/routes.ts:14-23`); аналогов whatsapp-прав нет | **[вопрос]** §10 п.8 |
| A-10 | Throttle/CB-консервативные значения: per-recipient 1/s и 20/ч, global 5/s, burst 10; CB после 5 retryable подряд, open 60s→15min; `QUEUE_MAX=1000` | предложение | D10; в коде аналогов нет (grep throttle/circuit → нет) | **[вопрос]** D10/§10 |
| A-11 | Retention: WhatsApp-metadata 24 мес, media — политика существующего S3-storage; настраивается конфигом | предложение | §6.6 требует зафиксировать; текущей retention-политики нет | **[вопрос]** §10 п.9 |
| A-12 | `AMBIGUOUS` recovery v1: оператор выбирает Customer (и только при явном требовании — Booking/Order context) | предложение | §10 п.11; контекст по D5 иначе `CUSTOMER` | **[вопрос]** §10 п.11 |
| A-13 | `UNKNOWN` recovery: `Reconcile` (по заранее сохранённому providerMessageId — **поддерживается**, M0-04), `Mark failed`, `Retry anyway` (право `whatsapp.send.recover`) | предложение | D6/§10 п.12; messageId подтверждён в Baileys 6.7.24 | **[вопрос]** §10 п.12 |
| A-14 | Топология: сейчас **один инстанс** (Dockerfile/compose-сервиса для backend нет, запуск `npm run dev`); volume `whatsapp-session` и Docker-образ — M5; `WHATSAPP_ROLE` в одном образе; lease enforced | код + вопрос | отсутствие Dockerfile (M0-01 §2.1), `docker-compose.yml` = только MinIO | **[вопрос]** §10 п.6 |
| A-15 | Алерты (`loggedOut`/`ERROR`/серия разрывов/CB/queue/потеря lease) → structured error log + readiness/diagnostic; канал (почта/Telegram/…) — владельцу | предложение | §6.6/§10 п.14; алерт-каналов в проекте нет | **[вопрос]** §10 п.14 |
| A-16 | `WHATSAPP_ENABLED=false` по умолчанию; `true` без `WHATSAPP_AUTH_ENCRYPTION_KEY` → fail closed (модуль не стартует) | код (§6.3/D1) | §6.3 требует валидации; fail-closed-образец `shared/cors.ts` | подтверждено промптом |
| A-17 | `Idempotency-Key` для `POST messages` — через существующий `IdempotencyInterceptor` + новая операция `"whatsapp.send"` в `IDEMPOTENT_OPERATIONS` | код | `idempotency.constants.ts:21`, `interceptor.ts:45-82`, `service.ts:101-107` (409 при divergent) | подтверждено кодом |
| A-18 | `CommunicationStatus` не расширяем; neutral pre-send = `ACTIVE` + lifecycle в `whatsapp.*` | решение (D6) | `schema.prisma:2684-2689` = {ACTIVE, ARCHIVED} | зафиксировано в M0-02 |
| A-19 | `BookingCreated`/`CommissionAccrued` пишутся через `emitResult` → подписчикам не доставляются; notification-consumers **не** полагаться на эти типы | код | `eventbus.service.ts:204,219,241-244`; `booking.subscribers.ts:233`, `commission.service.ts:162` | подтверждено кодом |
| A-20 | Версия Baileys pinned `6.7.24` exact; обновления — осознанный PR + contract-тесты + ручной smoke; `npm audit` добавить в CI | решение (D12) | M0-04 (dist-tags, CVE-2026-48063) | ждёт подтверждения |
| A-21 | Расхождения промпта с кодом (R1): (а) заголовок «v2.2» при имени файла `v2_3`; (б) «ADR по D1–D11», но раздел D12 существует; (в) §3 scope упоминает Docker, которого в репо нет; (г) §6.6 health-endpoint, §6.4 SSE — отсутствуют в проекте | код | `docs/prompts/TRAVELHUB_WHATSAPP_MASTER_PROMPT_v2_3_FINAL.md:1,772`; M0-01 §2.1 | задокументировано, код приоритетен |
| A-22 | История миграций была сломана: схема/таблицы `constructor.*` создавались вне миграций → shadow-replay (`prisma migrate dev`) и чистый `migrate deploy` падали на `20260913000000` (P3018 «schema constructor does not exist»). Добавлена remediation-миграция `20260912180000_constructor_foundation_remediation` (idempotent, для `ConstructorPage` — пре-20260913 набор колонок) | код | grep `constructor` по `prisma/migrations/*` → только 2 ALTER-файла; вывод shadow-fail (M1); прецедент `20260831220000_security_schema_drift_remediation` | исправлено в M1 (иначе gate «миграция применяется на чистой БД» невыполним) |
| A-23 | Чужой дрейф dev-БД вне M1: `catalog.PartnerActiveCategory`, `catalog.RoomView`, `catalog.RoomType.aliases`, rename индекса `geo.SupplierGeoLink` — **не тронуто** (DROP/переименование данных = риск потери; чужой scope) | код | `prisma migrate diff --from-config-datasource --to-schema` (M1); комментарии `20260926120000:3`, `20260926123000:3` | задокументировано; решение за владельцем отдельно |
| A-24 | Базовый `npm audit`: 13 уязвимостей (3 moderate, 10 high) у существующих зависимостей (sharp, exceljs/uuid, prisma, js-yaml, brace-expansion, fast-uri, qs); **Baileys 6.7.24 — 0**. В CI добавлен `npm audit --omit=dev --audit-level=critical` (EXIT=0) | код | вывод `npm audit` (M1), `npm ls` подтверждает принадлежность уязвимых пакетов exceljs/prisma | CI-шаг добавлен в M1; чистка baseline — отдельная задача |
| A-25 | Install scripts `@whiskeysockets/baileys` (`engine-requirements.js`) и `protobufjs` остались «pending» в allowScripts (не выполняются). В M1 не страшно: Baileys не импортируется (boundary-тест); к M2 — `npm approve-scripts` по необходимости | код | предупреждения `npm install` (M1) | **закрыто в M2:** `npm approve-scripts @whiskeysockets/baileys protobufjs --allow-scripts-pin` → pinned-записи в `package.json` `allowScripts`, `approve-scripts --allow-scripts-pending` → «No packages with unreviewed install scripts» |
| A-26 | `WhatsAppOutboundMessage.recipientPhone` добавлен сверх черновика M0-02 (там только `recipientJid`) — без канонического E.164 нельзя проверять D9-suppression и D10-throttle на отправке | код/предложение | M0-02 «Модель данных»; D9/D10; решение владельца №14 | реализовано в M1, подтверждается владельцем |
| A-27 | Бизнес-владелец WhatsApp-аккаунта = владелец платформы TravelHUB (ответ на §10 п.10) | решение | решение владельца №9 | закрыто |
| A-28 | Схема M2 уточнена относительно M1-миграций (авторизовано scope M2 владельцем): enum `WhatsAppConnectionState` пополнен состоянием **`LOGGED_OUT`** (явный logout ≠ ERROR/RECONNECTING) и в outbound добавлены колонки **`sentAt`/`deliveredAt`/`readAt`** (audit/таймлайны D6, §6.4). Миграция `20261002140000_whatsapp_m2_lifecycle_receipts` (idempotent) | код + решение | scope M2 в задании владельца («Lifecycle incl. LOGGED_OUT»); миграция применена на dev- и чистой-БД (gate-отчёт M2-01 §2.1) | реализовано в M2 |
| A-29 | **Бизнес-правило Customer Identity (решение владельца 2026-10-03):** один человек = один Customer; при создании/поиске использовать нормализованный телефон (**сильный идентификатор**) и нормализованное ФИО (доп. идентификатор/кандидат); несколько совпадений по ФИО → статус AMBIGUOUS и **ручной выбор, авто-merge запрещён**; Request и Order всегда ссылаются на `Customer` (не на телефон/логин); WhatsApp-клиент без User/BUYER всё равно получает Customer, а перед бронированием User/BUYER создаётся автоматически и credentials отправляются через WhatsApp | решение | решение владельца (M3, 2026-10-03); matching M3 уже реализует телефон-сильное сопоставление и запрет авто-merge (A-12); поля `Customer.firstName/lastName/phone` (schema.prisma, `crm`) | зафиксировано; авто-создание User/BUYER + отправка credentials — **вне scope M3**, реализация в следующих модулях |
| A-30 | Системный актор audit: auto-connect пишет `userId=null, username="system"` (не фиктивный id `"system"` — он нарушал FK `AuditLog_userId_fkey` и терял `whatsapp.connected`). Модель аудита не ослаблялась (`AuditLog.userId` остался nullable FK); ранее каждая загрузка backend теряла этот audit | код + решение | `session-runtime.service.ts:94` (до фикса), `docs/whatsapp/evidence/m3-fk-prefix-cleandb-seed.txt`; фикс + regression-тест (M3-01 §11), строка `whatsapp.connected userId=null` в dev-БД | исправлено в M3 |
| A-31 | Поиск Customer для WhatsApp-inbox — отдельный `GET /whatsapp/customer-search` (`whatsapp.manage`), т.к. CRM `GET /customers` отscoped по Marketplace (`total=0` без marketplace-связки). Критерии: нормализованный телефон ИЛИ code/firstName/lastName/companyName/email (case-insensitive), дедупликация, limit 10, пустой запрос → `[]` | код + предложение | `crm.controller` list-метод (marketplace-scope); `conversations.service.searchCustomers`; e2e M3 №6 (byPhone/byText/byEmpty) | реализовано в M3; подтверждается владельцем |

## Вопросы §10 — что уже отвечено кодом, что ждёт владельца

**Отвечено кодом (документируется, переоткрывать не нужно):**
- п.1: notification-слоя нет (A-01); media storage — **есть** (S3/MinIO, `backend/.env.example` `S3_*`, `test/e2e.minio.ts`); backend-i18n нет (только frontend ru/az/en).
- п.2: canonical-языки `ru/az/en`, дефолт `ru`; хранение языка клиента отсутствует (A-05).
- п.3: `Customer.phone` сырой, nullable, без индекса/unique, дубли допустимы (A-04).
- п.6: фактическая топология — один процесс/инстанс, volume и Docker — M5 (A-14).
- п.8: предлагается `whatsapp.manage` для link/unlink (A-09).
- п.13: **решено владельцем** — Baileys, риски приняты, Cloud API в v1 не реализуется.

**Ждут владельца (блокируют M1):** п.2 (язык уведомлений, A-05), п.3 (backfill phone, A-04),
п.4 (fromMe, A-06), п.5 (opt-out storage, A-07), п.7 (выделенный номер + приём риска блокировки),
п.8 (маппинг прав, A-09), п.9 (retention, A-11), п.10 (бизнес-владелец аккаунта),
п.11 (AMBIGUOUS, A-12), п.12 (UNKNOWN recovery, A-13), п.14 (канал алертов, A-15),
плюс: STOP-keywords (D9), значения throttle (A-10), хранилище шаблонов (A-08), размещение
notification-слоя (A-01), топология/worker (A-14).

## M1-обновление (2026-10-02): все вопросы §10 закрыты решениями владельца

На Gate M0 владелец принял **17 решений**; блокирующих «ждёт владельца» больше нет:

| Решение владельца | Закрывает |
|---|---|
| №1 notification-слой рядом с `communication/` | A-01 |
| №2 языки ru/az/en, default ru, без backfill языка | A-05 |
| №3 `Customer.phone` — без backfill, нормализация read-only | A-04 |
| №4 `fromMe` → OUTBOUND + `sentOutsideTravelHub` | A-06 |
| №5 suppression в `whatsapp.WhatsAppSuppression` + audit | A-07 |
| №6 выделенный номер компании, риск блокировки принят, Cloud API не сейчас | §10 п.7 |
| №7 маппинг прав `whatsapp.*` (read внутренним, send — контур, recover — ADMIN) | A-09 |
| №8 retention 24 мес, media — существующий S3/MinIO | A-11 |
| №9 бизнес-владелец = владелец платформы | A-27 |
| №10 AMBIGUOUS: 0→UNMATCHED, 1→MATCHED, >1→AMBIGUOUS, выбор оператором | A-12 |
| №11 UNKNOWN: Reconcile / Mark failed / Retry anyway, at-most-once | A-13 |
| №12 алерты только structured logs + readiness/diagnostic/audit | A-15 |
| №13 STOP/СТОП/UNSUBSCRIBE — только они, без NLP | D9 |
| №14 throttle/CB значения (1/s, 20/ч, 5/s, burst 10, CB 5→60s→15min, queue 1000) | A-10 |
| №15 шаблоны — файлы `notification/templates/{ru,az,en}.ts`, `templateVersion` не в ключе | A-08 |
| №16 топология: один инстанс сейчас, lease+fencing всё равно, volume/Docker — M5 | A-14 |
| №17 Baileys 6.7.24 exact + `npm audit` в M1 и в CI | A-20, A-24 |

Новые предположения, возникшие при реализации M1, — **A-22…A-27** (таблица выше).

## M2-обновление (2026-10-02)

- **A-25 закрыт** — install scripts baileys/protobufjs одобрены через `npm approve-scripts --allow-scripts-pin` (pinned в `package.json`), pending = 0.
- **A-02 подтверждён** — ESM-импорт Baileys через `new Function("m","return import(m)")` проверен contract-тестами M2.
- Новое — **A-28** (уточнение схемы M2: `LOGGED_OUT` + `sentAt`/`deliveredAt`/`readAt`).

## M3-обновление (2026-10-03)

- **A-29 — новое бизнес-правило Customer Identity** (решение владельца): сильный идентификатор = нормализованный телефон, ФИО = дополнительный кандидат, мульти-совпадение → AMBIGUOUS без авто-merge, Request/Order → только на `Customer`, WhatsApp-клиент без User/BUYER всё равно = Customer (авто-создание User/BUYER + credentials через WhatsApp — вне scope M3, в следующих модулях).
- **A-30 — фикс `AuditLog_userId_fkey`** в M3: источником ошибки был auto-connect с актором `{id:"system"}`, а не `seedRoles` (в нём нет audit-вызовов; воспроизведено и исправлено на чистой БД — M3-01 §11). Системный актор → `userId=null`, модель аудита не менялась.
- **A-31 — `GET /whatsapp/customer-search`** как замена CRM list (Marketplace-scope) для поиска кандидатов в inbox.
- Реализация M3 подтверждает ранее зафиксированные: **A-12** (AMBIGUOUS → ручной выбор), **D9** (STOP → suppression + audit), **A-09** (`whatsapp.manage` на link/unlink/customer-search), **A-06** (`fromMe` → OUTBOUND без дубля истории).
- Gate-отчёт: `docs/whatsapp/M3-01-gate-report-m3.md` (GATE M3 = PASS, 15/15 gate-строк, live smoke со скриншотами; два backend quality issue разобраны: FK auto-connect §11, OutboxWorker lifecycle §12; финальный rerun зелёный).
- **Архитектурная фиксация Customer Identity → D13 в `M0-02-adr-whatsapp.md`**: dedupe по нормализованному телефону (сильный ключ) + нормализованному ФИО (кандидат), AMBIGUOUS без авто-merge, Request/Order → только `Customer.id`, авто-создание User/BUYER перед бронированием — следующий модуль.