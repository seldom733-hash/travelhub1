# M0-02. ADR — WhatsApp (Baileys) в TravelHUB: решения D1–D13 и модель данных

Статус: **предложено, ждёт подтверждения владельца (Gate M0).**
Формат каждого решения: Решение · Обоснование (evidence) · Альтернативы · Последствия.
Номера D\* и I\* — из мастер-промпта. Расхождения кода с промптом отмечены **[код]**.

---

## D1. Хранение сессии

**Решение.** Интерфейс `AuthStateStore` (контракт в `integrations/whatsapp/provider/baileys/`).
Реализация v1 — **зашифрованный файловый store на volume**: каталог `WHATSAPP_SESSION_PATH`,
ключ `WHATSAPP_AUTH_ENCRYPTION_KEY`. Шифрование — встроенный `node:crypto` **AES-256-GCM**
(проверенная реализация, не собственные примитивы): конверт `{v, alg, iv, tag, ct}`,
случайный IV на запись, версия конверта для key-rotation (процедура — runbook, M5).
Запись crash-safe: temp-файл → fsync → rename, одна writer-очередь, проверка целостности
при чтении, запись сверяет fencing token (I13). `useMultiFileAuthState` не используется
(примерный API Baileys, не production-storage).
`WHATSAPP_ENABLED=true` без ключа → модуль не стартует и пишет причину (fail closed).
Повреждённая сессия → `ERROR`, автосброс запрещён, только `session-reset` + audit.

**Обоснование.** В репо нет готового crypto-abstraction (единственное — `bcryptjs`,
`backend/package.json`), поэтому берём проверенную платформенную реализацию. Volume-вариант
консистентен с §6.7; DB-вариант (зашифрованный blob в схеме `whatsapp.*`) остаётся
резервным, если volume/multi-host не будет.

**Альтернативы (отклонены):** plaintext-каталог (I7 запрещает), DB-blob как основной
(лишняя нагрузка на БД при частых записях ключей), `useMultiFileAuthState` (не шифрует).

**Последствия:** нужно бэкапить volume отдельно и шифрованно; потеря ключа = потеря
сессии → re-pairing (runbook).

## D2. Single-owner (lease)

**Решение.** Строка `whatsapp.WhatsAppSessionLease` (singleton) с `instanceId`,
`fencingToken`, `heartbeatAt`, `expiresAt`; продление — CAS-обновление
(`updateMany` по `instanceId+fencingToken`, 1 row = успех). Self-fencing: не продлил до
TTL − safety margin → закрыть сокет, прекратить send/receive (I13а). Token-check на каждой
DB-записи, меняющей session/auth/outbound-lifecycle (I13б).
`WHATSAPP_ROLE=api|worker|all` (default `all`), lease enforced независимо от роли.

**Обоснование.** Session-level `pg_advisory_lock` через Prisma-pool не гарантирует
жизнь соединения (сам prompt, D2; в проекте advisory-lock уже используется только внутри
одного воркера — `outbox-worker.service.ts:119-126` — и не годится как межпроцессная
аренда). Проект запускается одним Nest-процессом (нет отдельных deployable) → выделенный
worker-процесс = флаг роли в том же образе, не отдельный сервис.

**Последствия:** heartbeat/TTL в конфиге (`WHATSAPP_LEASE_TTL_MS`, `…HEARTBEAT_MS`);
`/status` честно отдаёт «не владелец».

## D3. Идентичность: JID, LID, телефон

**Решение.** `whatsapp.WhatsAppContact(accountId, jid, lid?, canonicalPhone?, customerId?,
linkSource AUTO|MANUAL, linkedAt)`, `UNIQUE(accountId, jid)`. JID ≠ Customer, phone ≠ PK.
Источник телефона (по убыванию): `key.senderPn/participantPn` → `remoteJid` вида
`…@s.whatsapp.net` → только `@lid` ⇒ **unmatched** (ручная привязка).
Игнорируются: `@g.us`, `status@broadcast`, newsletters, служебные/протокольные, реакции;
edits/revokes v1 — не отдельная Communication (документированное ограничение).

**Обоснование (Baileys 6.7.24, см. M0-04).** LID-first адресация реальна:
`isLidUser()` (`WABinary/jid-utils`), `WAMessageKey` содержит и `senderLid/participantLid`,
и `senderPn/participantPn` (`lib/Types/Message.d.ts:16-21`), `Contact.lid`,
`me.lid` (`lib/Types/Events.d.ts:32`), у групп — `addressingMode: 'pn'|'lid'`.
**Публичного API LID↔phone-resolver в 6.7.24 нет** → маппинг делаем из полей самого
сообщения; если пара не пришла — не угадываем.

**Последствия:** тест A14 (дубль с разной адресацией) требует нормализации
`remoteJid` через contact-слой до UNIQUE.

## D4. Нормализация телефона

**Решение.** Новая shared-утилита `backend/src/shared/phone/` на **`libphonenumber-js`**
(новая зависимость — в проекте phone-helper отсутствует, см. M0-01 §2.1). Canonical формат —
E.164, default region `WHATSAPP_DEFAULT_PHONE_REGION=AZ`, обработка `+`, пробелов, `-`,
`()`, национального формата, ведущего `0`. Поиск Customer — только по canonical-значению.

**Обоснование.** `Customer.phone String?` сырой, без индекса и unique
(`prisma/schema.prisma:1888`), нормализации в коде нет (grep — 0).

**Backfill (не делать молча):** предложить владельцу миграцию `crm.Customer.phone` к E.164
(отдельная задача CRM). В v1 — read-only нормализация при поиске через CRM application
service (I4: прямой записи в чужой домен нет).

**Последствия:** `[A-04]` — нужен ответ владельца о backfill (§10 п.3).

## D5. Сопоставление Customer и контекста

**Решение.** 1 → `MATCHED`; 0 → `UNMATCHED`; >1 → `AMBIGUOUS` (без угадываний;
авто-merge запрещён — D13).
Контекст: ровно один активный релевантный Booking/Order → привязать, иначе `CUSTOMER`;
«последний booking» как эвристика запрещён. **`CommunicationThread` не используется** —
история WhatsApp = `Communication` с `contextType/contextId` + фильтр
customer+channel (существующая фильтрация `GET /`, `GET /context/:type/:id`).
link/unlink — server-authoritative + audit, историю не переписывать/удалять.

**Обоснование.** `CommunicationThread` жёстко привязан к reverse pre-sale
(`schema.prisma:2804-2834`: `buyerRequestId`, `sellerPartnerId`,
`@@unique([buyerRequestId, sellerPartnerId])`, ADR-0011/0012) — предупреждение D5
подтверждено кодом.

## D6. Lifecycle исходящего + **нейтральный статус Communication** + crash-safety

**Решение 1 (нейтральный статус — обязательный пункт M0, п.5).**
`CommunicationStatus = {ACTIVE, ARCHIVED}` — нейтрального «создано, ожидает отправки»
**нет** (`schema.prisma:2684-2689`). **Расширять enum не будем.** Lifecycle
(`CREATED→QUEUED→SENDING→SENT→(DELIVERED|READ)`, `FAILED_RETRYABLE`,
`FAILED_PERMANENT`, `UNKNOWN`) живёт **только в integration-слое** —
`whatsapp.WhatsAppOutboundMessage.status`. `Communication` создаётся **до** `provider.send()`
со статусом `ACTIVE` (это «факт записи», а не «отправлено»), `channel=WHATSAPP`,
`direction=OUTBOUND`; статус `SENT/DELIVERED/READ` в `Communication` не пишется вообще
(I11: не выдумывать receipts).

*Альтернативы (отклонены):* `PENDING/SENDING` в `CommunicationStatus` — меняет канонический
enum без архитектурной необходимости (I11) и ломает существующих потребителей
(`@@index([direction,status])`, клиенты считают `ACTIVE` = активная переписка); новый
`CommunicationType` — тип ≠ статус, семантически неверно.

**Решение 2 (операционный ключ идемпотентности).** Инвариант фиксируется в ADR:
`operationKey = hash(accountId, sourceEventId, notificationType, canonicalRecipient)`;
версия шаблона/язык в ключ не входят; рендер один раз, snapshot = `Communication.body`,
ретраи шлют сохранённый текст (A13).

**Решение 3 (messageId → Reconcile).** Baileys 6.7.24 **позволяет** задать свой id:
`MinimalRelayOptions.messageId?: string` — «override the message ID with a custom provided
string» (`lib/Types/Message.d.ts:185-187`), `sendMessage` спредит `...options` поверх
своего `messageId` (`lib/Socket/messages-send.js:643-661`) и передаёт `fullMsg.key.id` в
`relayMessage` (`:696-697`). ⇒ генерируем id заранее, сохраняем **до** `send()`,
`Reconcile` реален (A11).

**Решение 4.** Крах в `SENDING` → `UNKNOWN`, **автоповтор запрещён**; recovery =
`Reconcile | Mark failed | Retry anyway` (`whatsapp.send.recover` + подтверждение +
audit) — at-most-once. Retry обычных ошибок — через существующий outbox/`retryFailed`;
`publishPending()` из HTTP-запроса не вызывать (только worker, `eventbus.service.ts:261`).

## D7. Идемпотентность

**Решение.**
- **Inbound:** `UNIQUE(accountId, remoteJid, fromMe, providerMessageId)` + `InboxEvent`;
  повтор → ни второй Communication, ни второго события, лог `whatsapp.message.duplicate`.
  Дедуп при разной адресации (LID vs PN) — нормализация `remoteJid` через contact-слой (D3).
- **Outbound авто:** operation key из D6; snapshot рендерится один раз.
- **Outbound ручной:** существующий механизм `Idempotency-Key`
  (`shared/idempotency/`, глобальный интерцептор `app.module.ts:28`) → добавить операцию
  `"whatsapp.send"` в `IDEMPOTENT_OPERATIONS` (`idempotency.constants.ts:21`); divergent
  payload → `ConflictError` 409 уже реализован (`idempotency.service.ts:101-107`),
  скоуп = actor (`interceptor.ts:82`) — ровно требование D7/A12.

**Отклонено:** собственная таблица ключей (I3 запрещает вторую idempotency-систему).

## D8. Входящие: что сохранять

**Решение.** `occurredAt` — из события провайдера; `receivedAt` — отдельное поле metadata.
text → `Communication.body`; image/document → архитектурная поддержка, rollout M5;
sticker/location/contact/audio → `Communication` с безопасным placeholder-body и типом в
metadata (**не терять молча**). `fromMe` (сообщения с телефона вне TravelHUB) →
`direction=OUTBOUND` + metadata `sentOutsideTravelHub=true` — `[A-06]` подтвердить.
History sync при первом pairing — **не импортировать** (`WHATSAPP_IMPORT_HISTORY=false`).
Текст недоверенный: экранирование в UI (XSS), лимит длины (`body` ≤ 4000 уже в схеме),
нормализация управляющих символов/Unicode.

## D9. Opt-out / notification policy

**Решение.** Автоматика — только транзакционные сообщения по booking/order/payment самого
клиента; маркетинг вне scope (§3). Suppression — таблица `whatsapp.WhatsAppSuppression`
по canonical phone (архитектурно готова к переносу в CRM при решении владельца), любое
изменение — audit. **STOP-слова/keywords и бизнес-политика НЕ реализуются до решения
владельца** (§10) — собственный набор не изобретаем. Ручные сообщения менеджера при
suppression — предупреждение в UI (требование политики — владельцу).
Рекомендация: выделенный номер компании, риск блокировки — в документации (§11).

## D10. Throttle / circuit breaker

**Решение (стартовые значения, все в конфиге, `[A-10]` — подтвердить владельцем):**
- per-recipient: 1 msg/s, не более 20/час на номер;
- global: 5 msg/s, burst 10;
- circuit breaker: 5 подряд retryable-ошибок провайдера → open 60s (затем экспоненциальный
  backoff до 15 min); при open сообщения остаются в `QUEUED` (bounded);
- очередь bounded: `WHATSAPP_QUEUE_MAX=1000`, при переполнении — `FAILED_PERMANENT` + alert;
- event storm (массовая отмена) → только очередь + throttle, без burst.

*Обоснование:* консервативность обусловлена неофициальностью канала (§10 п.13: риск
блокировки). Алерты — structured error log + diagnostic health (§6.6).

## D11. Шаблоны и локализация

**Решение.** Notification-слоя **нет** (grep `notification` по `backend/src` → 0) →
по §4.1 создаём минимальный, **channel-agnostic**, рядом с Communication
(`backend/src/modules/communication/notification/`), НЕ в `whatsapp/`:
`policy` (событие → какой шаблон/канал) + `templates` + `language resolution` +
`rendered snapshot` → `Communication`.
Шаблоны: версионируемые файлы в репозитории —
`backend/src/modules/communication/notification/templates/{ru,az,en}.ts`
`[A-08]` (DB-управляемые шаблоны — отдельная задача). Ключи строго по D11
(8 шаблонов, все реально существуют — M0-01 §3.1); подписчиков у 3 из них ещё нет —
это первые notification-consumers.
Язык: поля языка у `Customer` **нет** (§10 п.2) → platform default `ru` `[A-05]`;
**не** угадывать по языку входящего и не брать browser locale.
Canonical-языки платформы — `ru/az/en` (подтверждено фронтом: `lib/i18n.tsx`,
`localStorage["travelhub.locale"]`, default `ru`).
Snapshot: рендер один раз → `Communication.body`; master data (имя, суммы, даты) читается
из доменов при рендере и не копируется в `whatsapp.*`. На каждый технический стейт-переход
не шлём — только утверждённая notification policy.

## D12. Версия Baileys и цепочка поставок

**Решение: `@whiskeysockets/baileys` pinned `6.7.24` (exact, без `^`/`~`), npm-пакет
издателя проекта WhiskeySockets, lockfile в репо.** Подробности и доказательства —
отдельный артефакт **M0-04** (ESM/CJS, CVE-2026-48063, messageId, LID, вредоносные форки,
git-зависимость `libsignal`, `npm audit` в CI).

## D13. Customer Identity: dedupe по нормализованному телефону + ФИО, запрет авто-merge

**Решение (владелец, 2026-10-03; [A-29]).** Один человек — один `Customer`:

1. **Нормализация при создании/поиске:** телефон → канонический E.164 (тот же
   `shared/phone`, что у `WhatsAppConversation.canonicalPhone`); ФИО → нормализованная
   форма (trim/case/пробелы) для сравнения. Молчаливый миграционный backfill сырых
   `Customer.phone` — отдельное решение владельца (A-04, не делать молча).
2. **Дедупликация:** сильный идентификатор — **нормализованный телефон** (phone match →
   существующий `Customer`, не создавать новый); **нормализованное ФИО** — дополнительный
   идентификатор/кандидат (поиск и подсказка), но не основание для auto-create дубля.
3. **AMBIGUOUS не объединять автоматически:** >1 кандидатов (по телефону или по ФИО) →
   ручной выбор оператором; авто-merge/авто-link запрещён; статус `AMBIGUOUS`
   сохраняется до явной привязки (D5).
4. **Request/Order всегда ссылаются на `Customer.id`** — никогда на сырой телефон/логин
   как на идентификатор человека.
5. **WhatsApp-контакт без User/BUYER:** `Customer` создаётся независимо от наличия
   учётной записи (matching M3); перед переходом в бронирование `User/BUYER`
   создаётся автоматически, credentials доставляются через WhatsApp
   (вне scope M3 — план следующего модуля).

**Обоснование.** Телефон идентифицирует человека надёжнее ФИО: совпадения типа
«Иван Петров» типичны — воспроизведено в M3-smoke (два `Customer` с одним телефоном и
одинаковым ФИО → `AMBIGUOUS`, 2 кандидата). Авто-merge при ошибочной привязке
«сшивает» разных людей безвозвратно: история `Communication` переезжает на чужого
`Customer`. Дедуп при создании по телефону закрывает повторное создание клиента при
каждом inbound.

**Реализация в M3:** matching inbound по `canonicalPhone` (`conversations.service`);
`GET /whatsapp/customer-search` (нормализованный телефон ИЛИ имя/компания/email);
manual link `POST /conversations/:id/customer` (audit `whatsapp.customer_linked`);
запрет авто-merge закрыт e2e M3 №6 (2 кандидата → ручной link). Авто-создание
`User/BUYER` (п.5) — в следующих модулях.

**Связь:** D5 (статусы matching), [A-29]/[A-04]/[A-12] (M0-03).

## Модель данных (M1, предложение)

В `datasource db.schemas` добавляется `"whatsapp"` (`prisma/schema.prisma:24-26`).
Только provider/integration-метаданные (I2): **без текста сообщений и без бизнес-контекста.**

```prisma
model WhatsAppAccount {            // platform-аккаунт (v1: одна строка)
  id, provider ("baileys"), state, phone?, connectedAt?, lastError?
  createdAt/updatedAt
}
model WhatsAppContact {
  accountId, jid, lid?, canonicalPhone?, customerId?,   // customerId — ref без FK (ADR-0001)
  linkSource (AUTO|MANUAL), linkedAt
  @@unique([accountId, jid])  @@index([canonicalPhone])
}
model WhatsAppInboundMessage {     // inbound dedup (D7)
  accountId, remoteJid, fromMe, providerMessageId, communicationId, occurredAt, receivedAt
  @@unique([accountId, remoteJid, fromMe, providerMessageId])
}
model WhatsAppOutboundMessage {    // integration lifecycle (D6/D7)
  communicationId (unique), operationKey (unique), accountId, recipientJid?,
  status (CREATED|QUEUED|SENDING|SENT|DELIVERED|READ|FAILED_RETRYABLE|FAILED_PERMANENT|UNKNOWN),
  providerMessageId?, attempts, nextAttemptAt?, fencingToken, lastError?
  @@index([status, nextAttemptAt])
}
model WhatsAppSessionLease {       // D2 / I13
  key (singleton), instanceId, fencingToken, heartbeatAt, expiresAt
}
model WhatsAppSuppression {        // D9 (opt-out)
  canonicalPhone (unique), scope, reason?, actorUserId?, createdAt
}
// WhatsAppAuthState — НЕ создаётся в v1: файловый encrypted store (D1).
// Резервный вариант (DB-blob) включается только при отказе volume-варианта.
```

Миграции аддитивные; фича выключена `WHATSAPP_ENABLED=false` (A2).

## Права, API, audit, frontend, health, deployment

- **Права** (`security/permissions.constants.ts`): `whatsapp.read`, `whatsapp.send`,
  `whatsapp.send.recover`, `whatsapp.manage`, `whatsapp.session.admin`;
  маппинг ролей → `[A-09]` (предложение: read — все internal; session.admin/manage —
  ADMIN+OPERATOR; send — ADMIN+OPERATOR+SALES_MANAGER; recover — только ADMIN).
  `link/unlink` → право `whatsapp.manage` (вариант «CRM-право» отклонён: операция
  привязывает WhatsApp-идентичность, а не CRM-данные).
- **API**: глобальный префикс уже `api/v1` (`main.ts:16`) → `@Controller("whatsapp")`:
  `GET status` (read); `GET qr` (session.admin); `POST connect|disconnect|logout|session-reset`
  (session.admin, logout/reset — отдельный audit); `POST messages` (send + `Idempotency-Key`);
  `POST messages/:id/recover` (send.recover); `POST|DELETE contacts/:id/link|unlink` (manage).
  Ответы без credentials; QR не персистится/не логируется, rate-limit, polling (SSE/WS нет).
- **Audit** (`security.service.ts:329`): `whatsapp.connected`, `.disconnected`, `.logout`,
  `.session_reset`, `.send`, `.contact_linked`, `.contact_unlinked` — без QR/ключей/текста (I7/I8).
- **Frontend**: раздел `Settings → Integrations → WhatsApp` **создать** (страницы нет):
  `frontend/app/settings/integrations/whatsapp/page.tsx` + запись в nav
  `components/OperationsCenterShell.tsx` с `permission: "whatsapp.read"`;
  состояния: Not configured / QR required / Connecting / Connected / Reconnecting /
  Disconnected / Error / «Instance не владелец»; QR — polling 2–3 c, рендер на клиенте.
  `Customer → Communication`, `Booking/Order → Communication` — существующий UI
  (без второго chat-viewer); unknown contacts — плашка + `[Find customer] [Link customer]`,
  `AMBIGUOUS` — выбор из кандидатов; скрытие по `useCan` + серверная проверка.
- **Health/observability**: health-endpoint в проекте отсутствует → добавить
  readiness/diagnostic (informational; liveness не зависит от WhatsApp, I6); structured logs
  `whatsapp.connection.changed|.message.received|.message.sent|.message.failed|
  .message.duplicate|.qr.generated` — без содержимого (I7/I8); метрики §6.6
  (state, reconnectCount, queue depth, lease owner и др.).
- **Deployment**: Dockerfile/compose-сервис **не существует** → M5 создаёт (image + volume
  `whatsapp-session`), kill-switch `WHATSAPP_ENABLED=false`, runbook
  backup/recovery/force-reset/потеря ключа (§6.7).

