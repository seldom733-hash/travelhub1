# TRAVELHUB — WHATSAPP INTEGRATION (Baileys) — MASTER PROMPT v2.2

> Каждое правило сформулировано один раз; инварианты (I*) и решения (D*) ссылаются друг на друга
> по номеру. Работа идёт milestone-ами с gate-ами и обязательной остановкой после аудита (M0).

---

## 0. РОЛЬ И МИССИЯ

Ты — Principal Architect + Senior NestJS/TypeScript/Prisma/Next.js инженер.

Задача: встроить WhatsApp в существующую платформу TravelHUB как **ещё один канал
Communication** (не как отдельный домен), через provider-neutral адаптер. Первый провайдер —
Baileys (неофициальный WhatsApp Web протокол). Позже должна быть возможна замена на
WhatsApp Cloud API без изменений в Booking / Order / CRM / Communication / UI.

**Решение владельца:** v1 использует Baileys (бесплатный, неофициальный) осознанно; риски
(блокировка номера, поломки при обновлениях протокола, отсутствие SLA) приняты (§10, п. 13).

Репозиторий: `https://github.com/seldom733-hash/travelhub1`, ветка `master`.

Это НЕ прототип. «QR показывается» и «sendMessage работает» — не результат (см. §9, Definition of Done).

---

## 1. ПРАВИЛА РАБОТЫ

**R1. Факты важнее описания.** Всё, что в этом промпте сказано о структуре репозитория
(модули, enum-ы, события, пути), — гипотеза. Перед использованием проверь по коду. Если код
расходится с промптом — приоритет у кода; зафиксируй расхождение в Assumptions Register.

**R2. Доступ.** Если у тебя нет доступа к репозиторию (private, нет клонирования) — остановись
и сообщи. Не работай «по описанию».

**R3. Evidence, не заявления.** Утверждение «тесты проходят / typecheck чистый / миграция
применяется» допустимо только с приложенным выводом реально выполненной команды. Если
команду запустить нельзя — так и напиши, не подразумевай успех.

**R4. Gate-ы.** Работа идёт milestone-ами (§8). В конце каждого — Gate Report (формат в §8).
К следующему milestone переходи только когда Gate выполнен. Между M0 и M1 — обязательная
остановка для подтверждения владельцем (см. §10 Open Questions).

**R5. Минимальный diff.** Переиспользуй существующие абстракции. Никакого рефакторинга чужого
кода «заодно». Один milestone = одна ветка/PR, мелкие осмысленные коммиты.

**R6. Неопределённость.** Если решение не следует из кода или этого промпта — не угадывай:
запиши вопрос в Assumptions Register, выбери безопасный дефолт, пометь его `[ASSUMPTION]`.
Блокирующие вопросы (§10) задавай до M1.

**R7. Тесты пишутся вместе с кодом**, а не в конце. Каждый milestone завершается зелёным
typecheck + релевантными тестами + существующими тестами без регрессий.

---

## 2. НЕИЗМЕНЯЕМЫЕ ИНВАРИАНТЫ

Каждый инвариант сформулирован один раз. Остальной текст ссылается на них по номеру.

**Архитектура**

- **I1.** Baileys импортируется **только** внутри `provider/baileys/` (единственный каталог с `import 'baileys'`). Ни Booking, ни Order, ни
  CRM, ни Finance, ни Communication, ни notification-слой не знают про Baileys, JID, QR, сессию.
- **I2.** Один canonical Communication-факт на одно сообщение. WhatsApp-таблицы хранят только
  provider/integration-метаданные (providerMessageId, jid, providerStatus, communicationId…),
  но не текст и не бизнес-контекст.
- **I3.** Не создавать: второй EventBus, второй outbox, свою idempotency-систему, свою retry-очередь,
  второй Customer/Conversation/Support-модель, свою tracing-систему. Использовать существующие
  `EventBusService`, `OutboxEvent`, `InboxEvent`, `RequestContext` (correlationId/causationId/actor).
- **I4.** Нет cross-domain записей в чужие таблицы. Чтение/запись чужих доменов — только через их
  application services / события / read-by-ID согласно существующему ADR (найди его в M0).
- **I5.** Бизнес-транзакция (Booking/Order/Payment) **никогда** не ждёт WhatsApp. Путь только такой:
  `транзакция → outbox → commit → consumer → Communication → WhatsApp`.
- **I6.** Отказ WhatsApp не откатывает бизнес-транзакции и не делает TravelHUB unhealthy
  (WhatsApp — optional external dependency).
- **I13.** Provider operation разрешена только владельцу актуального session lease. WhatsApp и
  сокет fencing token не проверяют, поэтому защита двухуровневая: (а) **self-fencing** —
  держатель lease обязан закрыть сокет и прекратить send/receive, если не смог продлить lease
  до истечения TTL (с запасом на clock skew и паузы процесса); (б) **token-check на записи** —
  каждая DB-запись, меняющая session state, auth state или outbound lifecycle, проверяет
  актуальный fencing token и отклоняется при несовпадении.

**Данные и безопасность**

- **I7.** Auth state / ключи сессии / QR: не в Git, не во frontend, не в обычных бизнес-таблицах,
  не в логах, не в audit log, не в дампах БД «по умолчанию». QR не персистится и не логируется.
- **I8.** Не логировать тело сообщений и телефоны целиком в обычных логах. Логировать
  `messageId, communicationId, customerId, direction, provider, result`.
- **I9.** Отправитель входящего сообщения определяется только событием провайдера. Frontend
  никогда не присылает authoritative-поля: `senderUserId, actorUserId, status, occurredAt,
  providerMessageId`.
- **I10.** Входящий Customer **не создаётся автоматически**. Неизвестный номер → unmatched
  Communication + ручная привязка оператором. Lead/Ticket/Order автоматически тоже не создаются.
- **I11.** Не выдумывать delivery/read-статусы. Записывать только то, что подтверждено событием
  провайдера. Канонический `CommunicationStatus` не менять без архитектурного обоснования.
- **I12.** Не реализовывать обход anti-spam, rate limits и защит WhatsApp. Baileys нигде не
  описывать как официальный Meta API.

---

## 3. SCOPE

**В scope (v1):** один platform WhatsApp-аккаунт; QR-pairing; persistent session; reconnect;
inbound/outbound текст; CRM-resolution; manual link/unlink; ручная отправка менеджером;
уведомления по реально существующим Booking/Order/Payment-событиям; шаблоны ru/az/en (если это
canonical-языки платформы); RBAC; audit; UI (Settings, Customer, Booking, Order); тесты; Docker;
документация; Mock-провайдер и contract-тесты. Media (image, document) — последним milestone-ом.

**Вне scope (но интерфейсы не должны этому мешать):** multi-account, CloudApiWhatsAppProvider,
автосоздание Customer/Lead/Ticket, маркетинговые рассылки, групповые чаты, голосовые/видеозвонки,
импорт истории чатов.

---

## 4. ЦЕЛЕВАЯ АРХИТЕКТУРА

```text
Domain event (Booking/Order/Payment)
        │  outbox → EventBus
        ▼
Notification layer  (channel-agnostic: policy + template + language)
        │
        ▼
Communication  (canonical fact, body = rendered snapshot)
        │
        ▼
Channel Dispatcher ──► ChannelTransport "WHATSAPP"
                               │
                               ▼
                    WhatsApp application layer
              (send / receive / contact / routing / throttle)
                               │
                               ▼
                    WhatsAppProvider (contract)
                    ├── BaileysWhatsAppProvider
                    ├── MockWhatsAppProvider
                    └── (future) CloudApiWhatsAppProvider
```

### 4.1. Где живут consumers доменных событий

Consumers бизнес-событий внутри `whatsapp/` размывали бы границы: WhatsApp-модуль начал бы знать
о бизнес-событиях. Поэтому:

- **Consumers доменных событий и notification policy — channel-agnostic**, живут в
  Communication/Notification-слое (или в существующем аналоге; если слоя нет — создай минимальный
  там, где живёт Communication, а не в `whatsapp/`).
- Они выбирают канал и вызывают **generic Channel Dispatcher**.
- Dispatcher работает с channel-neutral `ChannelTransport` contract; сейчас реализуется
  только `WHATSAPP`, но архитектура не должна быть WhatsApp-specific.
- `whatsapp/` реализует только `ChannelTransport` + provider + session + inbound.

Если в M0 выяснится, что существующая архитектура требует иного — следуй ей и зафиксируй в ADR.

### 4.2. Размещение

Предпочтительно `backend/src/integrations/whatsapp/` (подгони под реальные conventions):

```text
whatsapp/
├── whatsapp.module.ts
├── whatsapp.controller.ts            # status/qr/connect/disconnect/logout/link
├── provider/
│   ├── whatsapp-provider.ts          # контракт + типы + typed errors
│   ├── mock/mock-whatsapp.provider.ts
│   └── baileys/                      # единственное место с import 'baileys'
│       ├── baileys.provider.ts
│       ├── baileys.session.ts        # socket lifecycle, reconnect
│       ├── baileys.auth-store.ts     # AuthStateStore (encrypted)
│       ├── baileys.mapper.ts         # provider event → InboundProviderMessage
│       └── baileys.events.ts
├── application/
│   ├── whatsapp-transport.ts         # реализация ChannelTransport
│   ├── whatsapp-inbound.service.ts
│   ├── whatsapp-contact.service.ts   # JID/LID ↔ phone ↔ Customer link
│   ├── whatsapp-routing.service.ts   # inbound → context
│   ├── whatsapp-throttle.service.ts
│   └── whatsapp-session-lease.service.ts
├── state/connection-state.machine.ts
└── tests/
```

### 4.3. Контракт провайдера (ориентир, адаптируй)

```ts
interface WhatsAppProvider {
  readonly name: 'baileys' | 'cloud_api' | 'mock';
  readonly capabilities: {
    qrPairing: boolean;
    deliveryReceipts: boolean;
    media: Array<'image' | 'document'>;
    requiresSessionOwnership: boolean;   // Baileys: true
    requiresApprovedTemplates: boolean;  // Cloud API: true вне 24h-окна
  };
  start(): Promise<void>;                // идемпотентно, защищено от конкурентного вызова
  stop(): Promise<void>;                 // graceful, без утечки сокетов
  logout(): Promise<void>;               // только по explicit action
  getSnapshot(): ConnectionSnapshot;     // state, phone?, connectedAt?, qr? (только in-memory)
  onStateChange(cb: (s: ConnectionSnapshot) => void): Unsubscribe;
  onInbound(cb: (m: InboundProviderMessage) => Promise<void>): Unsubscribe;
  onDeliveryUpdate(cb: (u: DeliveryUpdate) => void): Unsubscribe;
  send(cmd: SendCommand): Promise<SendResult>;   // text | media; бросает typed errors
}
```

`capabilities` нужны, чтобы будущий Cloud API (webhook, access token, phone-number-id, обязательные
approved templates) не протекал в Communication и UI.

Typed errors: `WhatsAppNotConnectedError`, `WhatsAppAuthenticationError`, `WhatsAppSessionError`,
`WhatsAppRateLimitError`, `WhatsAppInvalidRecipientError`, `WhatsAppMessageSendError`,
`WhatsAppProviderError` — каждая с признаком `retryable: boolean` (адаптируй к существующим
error conventions).

### 4.4. Владение данными

| Данные | Владелец |
|---|---|
| Идентичность/мастер-данные клиента, язык клиента | CRM |
| Состояние booking / order / payment | Booking / Order / Finance |
| Факт коммуникации, rendered body, контекст | Communication |
| JID/LID, providerMessageId, providerStatus, сессия, lease, contact↔customer link | WhatsApp integration (`whatsapp.*`) |

---

## 5. КЛЮЧЕВЫЕ ПРОЕКТНЫЕ РЕШЕНИЯ

Каждое — зафиксировать в ADR (M0). Ниже — рекомендуемые дефолты; если репозиторий или владелец
диктуют другое, меняй, но решение должно быть явным.

### D1. Хранение сессии

- Интерфейс `AuthStateStore`. Не использовать `useMultiFileAuthState` как production-решение
  (Baileys сам относит его к примерам) — проверь актуальную документацию.
- Дефолт: зашифрованное persistent storage на volume (`WHATSAPP_SESSION_PATH`) с ключом
  из `WHATSAPP_AUTH_ENCRYPTION_KEY`.
- Для шифрования использовать существующий security/crypto abstraction проекта либо
  проверенную криптографическую библиотеку. Не писать собственную криптографическую
  реализацию/примитивы. Конкретный алгоритм, nonce/IV, versioning и key-rotation должны
  соответствовать выбранной проверенной реализации и быть зафиксированы в ADR.
- Альтернативная реализация (если нет volume / нужен multi-host): зашифрованный blob в
  отдельной схеме `whatsapp.*`, доступный только integration-слою (не в `communication.*`,
  не в общих бизнес-таблицах).
- `WHATSAPP_ENABLED=true` без ключа шифрования → приложение не стартует WhatsApp-модуль и явно
  пишет почему (fail closed). Предусмотреть ротацию ключа (хотя бы документированную процедуру).
- Повреждённая сессия: детектировать, перевести в `ERROR`, не удалять автоматически — только
  по explicit `session_reset` с audit.
- Baileys обновляет ключи очень часто, поэтому запись auth state должна быть crash-safe:
  атомарная (temp-файл + fsync + rename; для DB-варианта — транзакция), сериализованная (один
  writer, очередь записей), с хранением последней известной рабочей копии и проверкой
  целостности при чтении. Запись проверяет fencing token (I13).

### D2. Single-owner (один Baileys на аккаунт)

- Два одновременных соединения на один аккаунт недопустимы.
- Семантика self-fencing и token-check — I13. Интервал heartbeat, TTL и запас безопасности
  настраиваются в конфиге и фиксируются в ADR.
- Реализация: **lease с heartbeat и TTL** (строка в `whatsapp.*` + fencing token). Не опирайся на
  session-level `pg_advisory_lock` через Prisma pool — соединения из пула не гарантируют жизнь сессии.
- Instance, не получивший lease, не запускает provider; `/status` честно показывает «не владелец».
- Допустимый вариант v1: один выделенный worker-процесс (`WHATSAPP_ROLE=worker`) — если это
  соответствует инфраструктуре и **enforced** lease-ом, а не только документацией.
- Отдельный deployable делай только если Baileys в API-процессе нестабилен или это уже принято в
  проекте; иначе — флаг роли в том же образе.

### D3. Идентичность отправителя: JID, LID, телефон

- Современные версии Baileys/WhatsApp могут присылать отправителя в виде LID (`…@lid`), а не
  `телефон@s.whatsapp.net`. **Проверь по changelog/документации выбранной версии** и реализуй
  явный mapping LID↔phone там, где он доступен; не считай, что номер всегда выводится из JID.
- Хранить `whatsapp.WhatsAppContact`: `accountId, jid, lid?, canonicalPhone?, customerId?,
  linkSource (AUTO|MANUAL), linkedAt`. JID ≠ Customer ID; phone ≠ PK.
- Если телефон определить нельзя (только LID) → unmatched с понятной пометкой, ручная привязка.
- Игнорировать: группы (`@g.us`), `status@broadcast`, newsletters, служебные/протокольные
  сообщения, реакции, edits/revokes (залогировать тип, не создавать Communication). Edits/revokes в v1 не являются отдельным Communication и считаются явно документированным ограничением v1.

### D4. Нормализация телефона

- Один canonical формат E.164. Используй существующий helper; если нет — shared utility на
  `libphonenumber-js` (или эквиваленте, уже принятом в проекте).
- Default region — из конфигурации платформы (ожидаемо AZ, `+994`); обрабатывать `+`, пробелы,
  `-`, `()`, национальный формат и ведущий `0` (например `050 123 45 67`).
- Поиск Customer — только по canonical значению; убедись, что в CRM есть индекс/нормализованное
  поле. Если `Customer.phone` хранится сырым — предложи (в Assumptions Register) backfill, но не
  делай его молча.

### D5. Сопоставление Customer и контекста

- Ровно 1 Customer → `MATCHED`; 0 → `UNMATCHED`; >1 → `AMBIGUOUS` (не угадывать).
- Контекст (Booking/Order): если ровно один релевантный активный → привязать; иначе контекст
  `CUSTOMER`. «Последний booking» как эвристика запрещена при неоднозначности.
- Перед использованием `CommunicationThread` проверь его domain contract. Если он предназначен для
  reverse pre-sale / `BuyerRequest` — не переиспользуй механически; обоснуй необходимость нового
  customer-facing conversation-объекта (или обходись фильтрацией Communication по
  customer+channel).
- Ручная привязка (link/unlink): server-authoritative, с audit; историю Communication не
  переписывать и не удалять при unlink.

### D6. Жизненный цикл исходящего сообщения и crash-safety

Внутренний lifecycle (в integration-слое, не в `CommunicationStatus`):

```text
CREATED → QUEUED → SENDING → SENT → (DELIVERED | READ)*   ← * только если подтверждено провайдером
                      │
                      ├──► FAILED_RETRYABLE → QUEUED (bounded backoff)
                      ├──► FAILED_PERMANENT
                      └──► UNKNOWN   ← крах/разрыв между send() и фиксацией результата
```

- Canonical `Communication` и provider/integration metadata создаются/фиксируются
  **до** вызова `provider.send()`. Внутренний outbound lifecycle переводится в `SENDING`
  с operation key до provider call. Это гарантирует, что попытка отправки не существует
  только внутри process memory.
- До подтверждения отправки Communication **не** получает статус, означающий «отправлено/
  доставлено» (I11). В M0 проверь существующий `CommunicationStatus` и выбери нейтральный статус
  для «создано, ожидает отправки»; если такого нет — храни lifecycle только в integration-слое
  и обоснуй в ADR.
- Provider message ID **генерируется заранее и сохраняется до `send()`**, если выбранная версия
  Baileys позволяет задать собственный message id (проверь в M0). Это делает `Reconcile`
  реальным: после краша эхо-событие/receipt с этим ID доказывает, что сообщение ушло. Если
  задать ID нельзя — зафиксируй в ADR, что автоматический `Reconcile` недоступен. Если используемая версия Baileys не позволяет заранее назначить/сохранить provider message ID до `send()`, не имитировать автоматический reconcile: `UNKNOWN` остаётся на ручном recovery.
- Если процесс упал в `SENDING` — при восстановлении состояние становится `UNKNOWN`;
  **автоповтор запрещён** (риск дубля клиенту). `UNKNOWN` не должен бесконечно зависать:
  explicit recovery workflow — `Reconcile` (по заранее сохранённому provider message ID),
  `Mark failed`, `Retry anyway`. `Retry anyway` — осознанный риск дубля: отдельное право
  `whatsapp.send.recover`, явное подтверждение оператора и audit. Выбранная semantics
  (at-most-once для `UNKNOWN`) фиксируется в ADR.
- Ошибки: network timeout / временный disconnect → retryable; `InvalidRecipient` →
  non-retryable; `logged out` → переводит connection в `DISCONNECTED/ERROR`, сообщения ждут
  (bounded), не теряются.
- Retry — через существующий outbox/`retryFailed` с ограниченным backoff и max attempts. Не
  вызывать `publishPending()` из HTTP-запроса WhatsApp-операций (дренирование outbox — только
  worker-ом, как принято в проекте).

### D7. Идемпотентность

- **Inbound:** ключ сообщения у WhatsApp составной (`remoteJid` + `id` + `fromMe`, в группах ещё
  `participant`; проверь по выбранной версии), поэтому UNIQUE строится по
  `(accountId, remoteJid, fromMe, providerMessageId)`, а не по одному ID. + `InboxEvent` (где
  соответствует текущей архитектуре). Повтор → ни второй Communication, ни второго события; лог
  `whatsapp.message.duplicate`. Обязательный тест: повторная доставка того же сообщения с другой
  адресацией чата (LID vs телефон) не создаёт дубль; если составной ключ этого не обеспечивает —
  нормализуй `remoteJid` через contact-слой (D3).
- **Outbound, автоматические:** operation key идентифицирует *намерение*, а не его рендер:
  hash(`accountId`, `sourceEventId`, `notificationType`, `canonicalRecipient`). Версия шаблона и
  язык в ключ **не входят** (иначе ретрай после правки шаблона получил бы новый ключ и дал бы
  дубль) — они сохраняются как метаданные записи. Сообщение рендерится **один раз**; rendered
  snapshot сохраняется, все ретраи отправляют сохранённый текст и не рендерят заново. Повторная
  обработка события не шлёт второй раз.
- **Outbound, ручные:** обязателен `Idempotency-Key` (header) от клиента; ключ скоупится на actor.
  Это защищает от double-click и HTTP retry. Повторный запрос с тем же key и другим payload
  должен завершаться `409 Conflict` и не выполнять новую отправку. Хранить хеш payload; срок
  жизни ключей — в конфиге.

### D8. Входящие сообщения: что и как сохранять

- Timestamp сообщения — из события провайдера (`occurredAt` из провайдера; серверное `receivedAt`
  хранить отдельно, если модель позволяет).
- Типы: text → body; image/document → архитектурная поддержка (rollout в M5); прочее
  (sticker, location, contact, audio) → Communication с безопасным placeholder-body и типом в
  metadata; **молча не терять**.
- Сообщения, отправленные владельцем аккаунта с самого телефона (`fromMe`, вне TravelHUB):
  `[ASSUMPTION]` записывать как OUTBOUND с пометкой `sentOutsideTravelHub=true`, чтобы история
  клиента не имела дыр. Подтвердить с владельцем (§10).
- History sync при первом pairing: **по умолчанию не импортировать** (флаг
  `WHATSAPP_IMPORT_HISTORY=false`), чтобы не создать лавину Communication.
- Текст входящих сообщений — недоверенный ввод: экранировать при рендере в UI (XSS), ограничить
  длину, нормализовать Unicode/управляющие символы.

### D9. Opt-out и notification policy

- Автоматические уведомления — только транзакционные, связанные с собственным booking/order/payment
  клиента. Маркетинг — вне scope.
- Opt-out архитектура должна поддерживать suppression по canonical phone; автоматические
  транзакционные уведомления после opt-out подавляются, а ручные сообщения менеджера требуют
  понятного предупреждения/политики.
- Конкретные STOP-команды/ключевые слова, их локализация и точная бизнес-политика НЕ
  фиксируются до решения владельца (§10). Не реализовывать молча собственный набор keywords.
- Где хранить предпочтение (CRM vs `whatsapp.*`) — решение владельца (§10); выбранное решение
  должно иметь audit trail.
- Это неофициальный канал: рекомендовать **выделенный** номер компании, не личный номер
  сотрудника, и документировать риск блокировки аккаунта.

### D10. Throttling / circuit breaker

- Ограничения: per-recipient, global, burst; все значения в конфиге; стартовые значения
  консервативные и настраиваются (укажи, что именно выбрал и почему).
- Circuit breaker на повторяющиеся provider-ошибки: временно останавливает отправку, сообщения
  остаются в очереди (bounded), alert в логах/health.
- Event storm (массовая отмена tours и т.п.) не должен приводить к burst-отправке: очередь +
  throttle.

### D11. Шаблоны и локализация

- Не хардкодить тексты в consumers. Шаблонный слой: `booking.confirmed`, `booking.rejected`,
  `booking.cancelled`, `booking.completed`, `payment.captured`, `payment.failed`,
  `payment.cancelled`, `refund.processed` — **только для событий, реально существующих в коде**
  (проверь `domain-events.ts` и сервисы).
- Хранение шаблонов: используй существующий i18n/notification-механизм; если его нет —
  версионируемые файлы шаблонов в репозитории `[ASSUMPTION]`, DB-управляемые шаблоны — отдельная
  задача.
- Язык берётся из Customer/profile/platform-политики; если не задан — platform default. Не
  угадывать по языку входящего сообщения и не брать из browser locale.
- Перед отправкой формируется **rendered snapshot**; он сохраняется как Communication body и
  не меняется при последующей правке шаблона.
- Master data (имя, суммы, даты) читаются из доменов при рендере и **не копируются** в
  WhatsApp-таблицы.
- Не отправлять WhatsApp на каждый технический status transition: только утверждённые бизнес-факты
  (явная notification policy на событие).

### D12. Версия Baileys и цепочка поставок

- Использовать только официальный npm-пакет/издателя выбранного проекта Baileys; это не означает,
  что Baileys является официальным продуктом Meta. Имя пакета и издателя проверь в M0. Форки и
  зеркала не использовать без аудита: скомпрометированный пакет означает захват WhatsApp-аккаунта
  и сессии (публиковались
  отчёты о вредоносных форках — не полагайся на память, проверь).
- Точная версия без `^`/`~`, lockfile в репозитории. Обновление — только осознанным PR с
  прогоном contract-тестов и ручным smoke.
- Протокол неофициальный: WhatsApp может сломать совместимость в любой момент. Runbook: как
  откатить версию, как отключить канал (`WHATSAPP_ENABLED=false` как kill-switch), что
  происходит с очередью при отключении.
- Audit зависимостей (`npm audit` или эквивалент) в CI.

---

## 6. ДЕТАЛЬНЫЕ ТРЕБОВАНИЯ

### 6.1. Communication

- Добавить `WHATSAPP` в `CommunicationChannel` **после** проверки реальной Prisma schema. Не
  добавлять EMAIL/SMS/TELEGRAM.
- Outbound: `type=MESSAGE, channel=WHATSAPP, direction=OUTBOUND`. Inbound — аналогично INBOUND.
- Сохранять `correlationId`/`causationId` через существующие механизмы.
- Поиск/фильтры: customer, phone, booking, order, channel=WHATSAPP, date, direction —
  переиспользовать существующую фильтрацию; серверная пагинация (никогда не грузить всю историю).

### 6.2. Connection state machine

```text
DISCONNECTED → INITIALIZING → QR_REQUIRED → CONNECTING → CONNECTED
CONNECTED → RECONNECTING → CONNECTED | ERROR
any → LOGGING_OUT → DISCONNECTED
```

- Явная таблица допустимых переходов + unit-тесты на каждый.
- Состояние соединения никогда не смешивается с Communication status.
- Reconnect: exponential backoff с верхней границей и max attempts; логические причины разрыва
  Baileys разбирать по кодам (logged out, connection replaced, restart required и т.д. — сверь с
  актуальной версией): `loggedOut` → `DISCONNECTED` без auto-reconnect; `connectionReplaced` →
  не воевать за сессию, перейти в `ERROR`/пересмотреть lease; auth failure → `ERROR`, без
  бесконечных попыток.
- Защита от конкурентной инициализации (mutex в процессе + lease между процессами).
- Graceful shutdown (SIGTERM/SIGINT/Nest `OnApplicationShutdown`): перестать принимать,
  дождаться безопасных операций (с таймаутом), сохранить auth state, закрыть сокет, освободить
  lease. После restart — CONNECTED без нового QR.

### 6.3. Конфигурация

Адаптировать имена к существующей config-архитектуре; все — в `.env.example`, без реальных
секретов:

```text
WHATSAPP_ENABLED=false                 # по умолчанию выключено (feature flag)
WHATSAPP_PROVIDER=baileys
WHATSAPP_ROLE=api|worker|all
WHATSAPP_SESSION_PATH=
WHATSAPP_AUTH_ENCRYPTION_KEY=
WHATSAPP_AUTO_CONNECT=true
WHATSAPP_RECONNECT_ENABLED=true
WHATSAPP_RECONNECT_BASE_DELAY_MS=
WHATSAPP_RECONNECT_MAX_DELAY_MS=
WHATSAPP_MAX_RECONNECT_ATTEMPTS=
WHATSAPP_SEND_TIMEOUT_MS=
WHATSAPP_IMPORT_HISTORY=false
WHATSAPP_DEFAULT_PHONE_REGION=AZ
WHATSAPP_THROTTLE_*                    # per-recipient / global / burst
```

Конфигурация валидируется на старте; невалидная при `ENABLED=true` → понятная ошибка.

### 6.4. API и безопасность

Сначала проверь REST-conventions проекта и выбери **один** префикс. Минимальный набор:

```text
GET  status                      → whatsapp.read
GET  qr                          → whatsapp.session.admin   (чувствительно)
POST connect | disconnect        → whatsapp.session.admin
POST logout | session-reset      → whatsapp.session.admin   (+ подтверждение в UI, отдельный audit-event)
POST messages                    → whatsapp.send            (требует Idempotency-Key)
POST messages/:id/recover        → whatsapp.send.recover    (reconcile | mark-failed | retry-anyway)
POST contacts/:id/link | unlink  → whatsapp.manage или CRM-permission (решить в ADR)
```

- Права: `whatsapp.read`, `whatsapp.send`, `whatsapp.send.recover`, `whatsapp.manage`,
  `whatsapp.session.admin` — в существующей RBAC-модели (имена по conventions), а не `if admin`.
  Pairing, logout и session-reset защищены отдельно от остальных операций.
- Manual send: authenticate → authorize → resolve Customer (read-by-ID) → canonical phone →
  проверка connection → Communication → отправка через transport. Ответ не содержит credentials.
- QR: не хранить в БД, не логировать, инвалидировать при новом, отдавать только авторизованным,
  rate-limit на endpoint, не кешировать дольше жизни QR. Рендерить QR на клиенте из строки;
  обновление — SSE/WebSocket, если есть в проекте, иначе polling с коротким интервалом.
- Audit (в существующую security/AuditLog систему): `whatsapp.connected`, `.disconnected`,
  `.logout`, `.session_reset`, `.send`, `.contact_linked`, `.contact_unlinked`. Без QR,
  credentials, ключей, текста сообщений.

### 6.5. Frontend

Сначала определи фактическую frontend-архитектуру (routes, API client, auth, permissions,
навигация, дизайн-система) и встраивайся в неё. Отдельное standalone-приложение запрещено.

- **Settings → Integrations → WhatsApp:** provider, состояние, телефон, connectedAt, кнопки
  Connect/Disconnect/Logout (по правам), QR при `QR_REQUIRED` с автообновлением и исчезновением
  после pairing. Состояния: Not configured / QR required / Connecting / Connected / Reconnecting /
  Disconnected / Error / «Instance не владелец сессии». При ошибке — что случилось и что делать
  (без stack trace).
- **Customer → Communication:** переписка (пагинация), отправка, индикатор статуса, предупреждение
  при opt-out, loading/error/empty состояния.
- **Booking / Order → Communication:** показать связанные сообщения существующим Communication UI
  (не создавать второй chat viewer).
- **Unknown contacts:** список/плашка «Unknown WhatsApp contact +994…» с `[Find customer]
  [Link customer]`; при `AMBIGUOUS` — выбор из кандидатов.
- Скрывать/блокировать действия по permissions на клиенте **и** проверять на сервере.

### 6.6. Observability, Health, Privacy

- Structured logs: `whatsapp.connection.changed`, `.message.received`, `.message.sent`,
  `.message.failed`, `.message.duplicate`, `.qr.generated` (без содержимого QR и сообщений).
- Метрики/статус: enabled, provider, state, lastConnectedAt, lastDisconnectedAt, reconnectCount,
  lastInboundAt, lastOutboundAt, sendFailures, queue depth, lease owner.
- Алерты (минимум — structured-лог уровня error + diagnostic status): `loggedOut`, `ERROR`, серия
  разрывов, срабатывание circuit breaker, рост очереди выше порога, потеря lease. Получатель и
  канал алертов — решение владельца (§10, п. 14). Бизнес-операции при этом не блокируются (I5, I6).
- Health: WhatsApp отдаётся в **readiness/diagnostic** как informational; liveness и общий
  health не падают из-за WhatsApp. Публичный health без PII.
- Retention-политика для WhatsApp-метаданных и media — зафиксировать (хотя бы дефолт и где
  настраивается).

### 6.7. Deployment

- Persistent volume `whatsapp-session` (или аналог); session переживает `docker restart`.
- Один владелец сессии (lease/worker role) — enforced.
- Документировать: что бэкапить (session volume отдельно и шифрованно, не в обычных DB dump),
  как восстановить, как намеренно logout, как force reset, что делать при потере ключа
  шифрования.
- Migration-ы: все изменения Prisma — через migration; проверка на чистой БД;
  `prisma generate` → migrate → typecheck → tests. Миграции аддитивные и безопасные при
  `WHATSAPP_ENABLED=false`. Опиши rollback (как отключить фичу флагом без отката схемы).

### 6.8. Media (M5)

Text → image → document. Байты в PostgreSQL не хранить; использовать существующее media
storage. Allowlist MIME, лимиты размера, проверка расширений, безопасные имена файлов,
отсутствие исполнения/рендера активного контента. Если существующего media storage нет —
вынести решение в §10, не изобретать молча.

---

## 7. ТЕСТИРОВАНИЕ

Реальный Baileys в CI **не** используется.

**Unit:** phone normalization (таблица кейсов: `+994…`, `994…`, `050…`, `(050) 123-45-67`, мусор);
JID/LID mapping; inbound mapper (включая игнорируемые типы); state machine (все допустимые и
недопустимые переходы); template rendering ×3 языка + fallback; routing (0/1/N контекстов);
dedup; operation key; throttle; outbound lifecycle включая `UNKNOWN`.

**Contract:** один набор тестов, прогоняемый и на `MockWhatsAppProvider`, и (с моками сокета) на
`BaileysWhatsAppProvider`. Это основа будущего `CloudApiWhatsAppProvider`.

**Integration (с БД и mock provider):** Communication → transport → provider; Booking-событие →
notification → Communication → отправка; повторная доставка события → один Communication/одна
отправка; дубль inbound → один Communication; unmatched/ambiguous; link/unlink; провайдер
недоступен → сообщение в retryable/queued; восстановление → отправка; краш в `SENDING` → `UNKNOWN`
без автоповтора; два экземпляра → только один владеет lease; потеря lease → self-fencing закрывает
сокет, запись со старым токеном отклоняется; ретрай после смены версии шаблона → без дубля, уходит
сохранённый snapshot; краш посреди записи auth state → сессия цела.

**E2E (API):** status, QR state (с правами и без), manual send (authz, Idempotency-Key, попытка
подмены authoritative-полей отвергается), пагинация.

**Статические проверки:** grep/lint-правило, что `baileys` импортируется только из
`provider/baileys/`; Booking/Order/CRM/Finance не содержат WhatsApp-specific кода (I1).

**Mock provider** обязан уметь: send, receive, disconnect, reconnect, failure (retryable и
permanent), duplicate delivery, delay.

---

## 8. MILESTONES И GATE-Ы

Каждый milestone завершается **Gate Report**: что сделано (пути файлов), вывод
typecheck/тестов/миграций, обновлённый Assumptions Register, известные ограничения, что дальше.

### M0 — Аудит и проектирование (без изменений кода)

Изучить: `app.module.ts`, `communication/`, `eventbus/`, `crm/`, `booking/`, `order/`,
`finance/`, `security/` (RBAC, audit), `schema.prisma` (схемы, naming), существующий ADR о
границах доменов, `domain-events.ts`, Notification/i18n/media/Support-слои (если есть),
frontend-архитектуру, Docker/deploy, конфигурацию, тестовую инфраструктуру, версии Node/TS/пакетного
менеджера, health-endpoint, текущий phone-helper.

Артефакты (в `docs/whatsapp/` или по conventions):
1. Dependency map и список **реально существующих** событий.
2. ADR по D1–D11 и модели данных.
3. Assumptions Register.
4. Проверка выбранной версии Baileys с обоснованием: совместимость с Node/TS/ESM-CJS, официальность npm-пакета/издателя выбранного проекта (не Meta),
   pinned версия (D12), поддержка собственного message id (D6), поведение LID (D3).
5. Решение по нейтральному статусу Communication до отправки (D6).

**Gate M0:** остановка. Ждать подтверждения решений и ответов на §10.

### M1 — Фундамент

Prisma-модели (`whatsapp.*`, только необходимые: Account, Contact, Message-metadata, Lease,
при выбранном варианте — AuthBlob, Suppression) + migration; `WHATSAPP` в
`CommunicationChannel`; конфиг + валидация; permissions; phone normalization utility; контракт
`WhatsAppProvider`; `MockWhatsAppProvider`; state machine; typed errors; contract-тесты на Mock.
Всё под feature flag `WHATSAPP_ENABLED=false`.

**Gate:** migration на чистой БД, typecheck, unit + contract tests, существующие тесты зелёные.

### M2 — Сессия и админ-контур

`BaileysWhatsAppProvider`; `AuthStateStore` (шифрование); lease; QR; reconnect; graceful
shutdown; API status/qr/connect/disconnect/logout с RBAC и audit; Settings UI; health/observability.

**Gate:** автоматические тесты на Mock + контрактные тесты на Baileys-обёртку с мок-сокетом;
тесты lease/self-fencing и crash-safe записи auth state (A10, A15);
**ручной smoke (требует человека с телефоном)**: QR → CONNECTED → restart → CONNECTED без QR;
результат отчёта оператора приложить.

### M3 — Сообщения

Inbound pipeline (mapper → dedup → contact → customer → routing → Communication); link/unlink +
UI; manual send (Idempotency-Key, lifecycle D6, retry, throttle, circuit breaker); Customer →
Communication UI; поиск/пагинация.

**Gate:** integration/E2E по §7 для inbound/outbound/дубли/сбои; отдельно проверить
`UNKNOWN` recovery (включая Reconcile по сохранённому provider message ID, если он поддерживается); ручной smoke: клиент пишет →
видно в Customer; менеджер отвечает → клиент получает.

### M4 — Уведомления

Notification layer (если отсутствует — минимальный), consumers для реально существующих
Booking/Order/Payment-событий, шаблоны ru/az/en, language resolution, snapshot, Booking/Order
Communication tab.

**Gate:** integration-тесты по §7; Test «WhatsApp выключен → Booking завершается → уведомление
queued → после подключения доставлено» на mock; ручной smoke с реальным booking.

### M5 — Hardening и поставка

Media (image/document); Docker/volume/env; backup/recovery/force-reset runbook;
документация (§11); финальный code review (§9); финальный отчёт.

---

## 9. DEFINITION OF DONE

**Автоматически проверяемое (CI):**
- A1. typecheck, lint, все тесты зелёные; существующие API (Communication, Booking, CRM, Order) и
  EventBus не сломаны.
- A2. Миграции применяются на чистой БД; фича выключена по умолчанию.
- A3. Дубль inbound → 1 Communication. Повторное событие → 1 отправка.
- A4. Provider недоступен → бизнес-транзакция успешна, уведомление в retryable/queued.
- A5. Краш в `SENDING` → `UNKNOWN`, без автоповтора.
- A6. Два экземпляра → один владелец lease.
- A7. Contract tests Mock ≡ Baileys wrapper.
- A8. Статическая проверка: Baileys только в своём каталоге; нет WhatsApp-кода в Booking/Order/CRM/Finance.
- A9. Нет секретов/QR/тела сообщений в логах и audit (тест/grep на логирующий код).
- A10. Self-fencing: при неудачном продлении lease сокет закрывается до истечения TTL; DB-записи
  (session state, auth state, outbound lifecycle) со старым fencing token отклоняются.
- A11. `UNKNOWN` имеет explicit recovery path, recovery audit-ится, а автоматический retry
  без operator confirmation невозможен; `Retry anyway` требует права `whatsapp.send.recover`.
- A12. Повторный `Idempotency-Key` с идентичным payload возвращает сохранённый результат/эквивалент,
  а с другим payload → `409 Conflict`.
- A13. Ретрай после смены версии шаблона не создаёт дубль и отправляет сохранённый snapshot.
- A14. Dedup inbound по составному ключу; повторная доставка с другой адресацией (LID/телефон)
  не даёт дубля.
- A15. Краш посреди записи auth state не теряет сессию.
- A16. Baileys закреплён точной версией, lockfile в репозитории, пакет официальный (D12).

**Ручной smoke (нужен человек и реальный телефон — ты его выполнить не можешь; подготовь
чек-лист и отметь «НЕ ВЫПОЛНЕНО АГЕНТОМ»):**
- H1. `Settings → Integrations → WhatsApp` показывает `QR_REQUIRED`; после скана — `CONNECTED`.
- H2. Restart backend → `CONNECTED` без QR.
- H3. Сообщение клиента появляется в Customer → Communication.
- H4. Ответ менеджера доходит клиенту.
- H5. Подтверждение booking → клиент получает уведомление на своём языке.
- H6. Отключить WhatsApp → создать booking → успех; подключить → уведомление доставлено без дубля.

**Финальный review (отдельный проход, с чек-листом результатов):** архитектурные границы,
security (RBAC/PII/секреты/audit/XSS), надёжность (outbox/retry/idempotency/reconnect/shutdown/
lease), БД (индексы, unique, migrations, ownership), frontend (permissions, UX, error/loading),
production (Docker, restart, logs, health, backup).

---

## 10. OPEN QUESTIONS — ответить ДО M1

1. Есть ли уже notification/i18n слой и media storage? Где?
2. Canonical языки платформы (ru/az/en?) и где хранится язык клиента.
3. Как хранится `Customer.phone` (сырой/нормализованный), допускаются ли дубли номеров?
4. Политика `fromMe`-сообщений (записывать как OUTBOUND с пометкой?).
5. Где хранить opt-out: CRM или integration-слой?
6. Топология деплоя: один инстанс / несколько; есть ли persistent volume; допустим ли
   отдельный worker-процесс?
7. Выделенный ли номер компании для WhatsApp и принят ли риск блокировки неофициального канала?
8. Кто имеет право link/unlink контактов (новое WhatsApp-право или CRM-право)?
9. Retention: сколько хранить WhatsApp-метаданные и media?
10. Кто является бизнес-владельцем platform WhatsApp account (company/brand/department)?
11. Что должен сделать оператор при `AMBIGUOUS`: только выбрать Customer или также вручную
    выбрать Booking/Order context?
12. Какой explicit recovery workflow утверждаем для `UNKNOWN`: `Reconcile`, `Mark failed`,
    `Retry anyway` (или ограниченный набор)?
13. [РЕШЕНО ВЛАДЕЛЬЦЕМ] Провайдер v1 — Baileys (бесплатный, неофициальный). Выбор провайдера закрыт и в M0 не переоткрывается; M0 проверяет только техническую реализацию, выбранную версию/пакет и supply-chain риск. Владелец осознаёт и
    принимает риски: блокировка номера, поломки при обновлениях протокола WhatsApp, отсутствие
    SLA и поддержки. Следствия для реализации:
    - Cloud API в v1 не реализуется; сохраняется только provider-контракт и contract-тесты как
      путь выхода.
    - Выделенный номер компании (не личный).
    - Только транзакционные сообщения, без маркетинга и рассылок.
    - Консервативный throttle, opt-out, kill-switch (`WHATSAPP_ENABLED`).
    - Алерт при loggedOut / ERROR / серии разрывов; сообщения копятся в очереди (bounded),
      бизнес-операции не блокируются.
    - В документации описать триггеры перехода на Cloud API (§11).
14. Кто и по какому каналу получает алерты о `loggedOut` / `ERROR` / потере lease?

---

## 11. ДОКУМЕНТАЦИЯ

Создать/обновить: архитектура и provider abstraction; session management; security; inbound и
outbound flows; message lifecycle; customer resolution; notification events; failure handling,
retry, idempotency; deployment и scaling (single-owner); backup/recovery/force-reset;
`.env.example`; **явное предупреждение**, что Baileys — неофициальный способ интеграции через
WhatsApp Web protocol, не Meta API, с рисками блокировки; путь миграции на Cloud API
(`BAILEYS → CLOUD_API` как конфигурационное/deployment-решение: что меняется — provider и
конфиг, плюс требование approved templates; business domains и business UI остаются стабильными,
а channel/integration UI может быть capability-aware; notification policy остаётся channel-neutral).

Описать также **триггеры перехода на Cloud API** (решение владельца, §10, п. 13): блокировка
номера; повторяющиеся поломки после обновлений Baileys; рост объёма или требование SLA;
изменение политики WhatsApp.

---

## 12. ФОРМАТ ФИНАЛЬНОГО ОТЧЁТА

С конкретными путями файлов:

1. Созданные/изменённые файлы · 2. Prisma migrations и новые сущности · 3. Permissions ·
4. API endpoints · 5. События и consumers · 6. Provider architecture и session storage ·
7. Inbound/outbound flows · 8. Шаблоны · 9. Frontend · 10. Тесты и **фактический вывод** команд ·
11. Команды запуска · 12. Env-переменные · 13. Docker · 14. ADR-решения и Assumptions Register ·
15. Что проверено автоматически, а что — только ручным smoke (и не выполнено агентом) ·
16. Known limitations · 17. Security considerations · 18. Путь миграции на Cloud API.

---

## 13. ЧЕГО НЕ ДЕЛАТЬ (сводка)

Не изобретать несуществующие файлы/события/таблицы · не переписывать архитектуру · не создавать
второй EventBus/Communication/Customer/Support · не импортировать Baileys вне адаптера · не
делать WhatsApp частью бизнес-транзакции · не имитировать delivery/read · не создавать Customer
из неизвестных номеров · не логировать секреты и тексты · не создавать fake webhook для Baileys ·
не обходить защиты WhatsApp · не считать QR-pairing готовой интеграцией · не заявлять успех без
вывода команд · не включать версию шаблона в operation key и не рендерить шаблон заново при
ретрае · не использовать форки Baileys без аудита.

# END OF MASTER PROMPT v2.2
