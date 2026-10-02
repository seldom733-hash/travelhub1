# MASTER IMPLEMENTATION PROMPT
# TRAVELHUB — FULL WHATSAPP INTEGRATION
# Baileys-based WhatsApp Web Gateway
# Production-ready implementation

---

## 0. ROLE

Ты работаешь как Senior/Principal Software Architect + Senior NestJS/TypeScript Engineer + PostgreSQL/Prisma Engineer + Frontend Engineer.

Твоя задача — НЕ создать демонстрационный WhatsApp prototype, а полностью реализовать интеграцию WhatsApp в существующую платформу TravelHUB.

Работай непосредственно с текущим репозиторием:

```text
https://github.com/seldom733-hash/travelhub1
```

Default branch:

```text
master
```

Перед любыми изменениями ОБЯЗАТЕЛЬНО изучи фактическое состояние репозитория.

Не выдумывай существующие модули, таблицы, события, API или файлы.

Если фактическая архитектура отличается от описанной ниже — приоритет имеет фактический код репозитория, а решение должно быть адаптировано к нему.

---

# 1. ГЛАВНАЯ ЦЕЛЬ

Полностью подключить WhatsApp к TravelHUB таким образом, чтобы WhatsApp стал одним из коммуникационных каналов платформы.

Архитектура должна поддерживать:

```text
TravelHUB
    │
    ├── CRM
    ├── Orders
    ├── Bookings
    ├── Payments
    ├── Communication
    │
    └── WhatsApp Integration
             │
             └── Baileys
                    │
                    └── WhatsApp Web
```

WhatsApp НЕ должен становиться отдельным бизнес-доменом вместо Communication.

Canonical communication entity должна оставаться владельцем фактов коммуникации.

---

# 2. КЛЮЧЕВОЙ АРХИТЕКТУРНЫЙ ПРИНЦИП

НЕ создавать второй бизнес-домен:

```text
WhatsAppCustomer
WhatsAppBooking
WhatsAppOrder
WhatsAppConversation
```

если существующие сущности TravelHUB уже покрывают соответствующую семантику.

Использовать существующий:

```text
Communication
CommunicationThread
Customer
Order
Booking
Payment
```

и связывать WhatsApp с ними через canonical references.

---

# 3. ТЕКУЩАЯ АРХИТЕКТУРА, КОТОРУЮ НУЖНО УЧЕСТЬ

В текущем backend уже существуют:

```text
backend/src/app.module.ts

backend/src/eventbus/

backend/src/modules/communication/

backend/src/modules/crm/

backend/src/modules/order/

backend/src/modules/booking/

backend/src/modules/finance/

backend/src/security/

backend/prisma/schema.prisma
```

В `AppModule` уже зарегистрированы соответствующие domain modules.

EventBus уже использует:

```text
transactional outbox
in-process event bus
InboxEvent idempotency
correlationId
causationId
actor
retryable events
```

Не создавать второй event bus.

Не создавать второй outbox.

Не создавать собственную параллельную систему idempotency.

Переиспользовать существующие механизмы.

---

# 4. СУЩЕСТВУЮЩИЙ COMMUNICATION

Текущая Communication модель содержит:

```text
CommunicationType
CommunicationChannel
CommunicationDirection
CommunicationStatus
CommunicationContextType
CommunicationParticipantType
Communication
CommunicationThread
```

Существующий:

```text
CommunicationChannel
```

сейчас содержит:

```text
PLATFORM
```

Добавить:

```text
WHATSAPP
```

только после проверки текущей Prisma schema.

Не добавлять заранее:

```text
EMAIL
SMS
TELEGRAM
```

если они реально не реализуются в рамках этой задачи.

---

# 5. WHATSAPP ДОЛЖЕН БЫТЬ TRANSPORT ADAPTER

Архитектура:

```text
Communication
      │
      ▼
Channel Dispatcher
      │
      ▼
WhatsApp Adapter
      │
      ▼
Baileys
      │
      ▼
WhatsApp Web
```

TravelHUB business domains НЕ должны импортировать Baileys напрямую.

Запрещено:

```text
BookingService → Baileys
CrmService → Baileys
OrderService → Baileys
PaymentService → Baileys
```

Правильно:

```text
Booking event
     ↓
Notification/Application layer
     ↓
Communication
     ↓
WhatsApp adapter
     ↓
Baileys
```

---

# 6. PROVIDER-NEUTRAL DESIGN

Архитектура должна быть построена так, чтобы позже можно было заменить:

```text
Baileys
```

на:

```text
WhatsApp Cloud API
```

без изменения:

```text
Booking
Order
CRM
Communication
frontend business logic
```

Создать provider abstraction:

```text
WhatsAppProvider
```

или эквивалентный интерфейс.

Минимальные операции:

```text
connect()
disconnect()
getStatus()
sendText()
sendMedia()
receiveMessage()
logout()
getQr()
```

Фактический интерфейс должен быть адаптирован к реальному lifecycle Baileys.

---

# 7. BAILEYS

Использовать актуальную стабильную версию Baileys, совместимую с текущим Node.js/TypeScript окружением проекта.

Перед установкой:

1. проверить текущую Node.js версию;
2. проверить package manager;
3. проверить TypeScript version;
4. проверить существующие dependency constraints;
5. выбрать совместимую Baileys version.

Не устанавливать случайные deprecated packages.

Не использовать WhatsApp Web scraping через браузер, если Baileys предоставляет необходимый протокол.

Не использовать CDP/Chrome для WhatsApp.

---

# 8. WHATSAPP GATEWAY

Создать отдельный integration layer.

Предпочтительная архитектура:

```text
backend/src/integrations/whatsapp/
```

или другой путь, если фактическая архитектура репозитория требует иного.

Структура должна быть примерно такой:

```text
whatsapp/
│
├── whatsapp.module.ts
├── whatsapp.controller.ts
├── whatsapp.service.ts
├── whatsapp.provider.ts
├── whatsapp.types.ts
├── whatsapp.config.ts
│
├── adapters/
│   └── baileys/
│       ├── baileys.adapter.ts
│       ├── baileys.session.ts
│       ├── baileys.events.ts
│       └── baileys.mapper.ts
│
├── application/
│   ├── whatsapp-send.service.ts
│   ├── whatsapp-receive.service.ts
│   ├── whatsapp-contact.service.ts
│   └── whatsapp-routing.service.ts
│
├── consumers/
│   ├── booking-confirmed.consumer.ts
│   ├── booking-cancelled.consumer.ts
│   ├── payment-captured.consumer.ts
│   └── ...
│
└── tests/
```

Не копировать эту структуру механически.

Адаптировать её к существующим conventions проекта.

---

# 9. WHATSAPP SESSION

Реализовать полноценный persistent WhatsApp session.

Требования:

- QR pairing;
- session persistence;
- restart-safe reconnect;
- graceful disconnect;
- automatic reconnect;
- connection state;
- authentication state;
- logout;
- corrupted session recovery;
- concurrent initialization protection.

После перезапуска backend пользователь НЕ должен каждый раз сканировать QR.

---

# 10. SESSION STORAGE

Не хранить WhatsApp credentials:

```text
в Git
в frontend
в localStorage
в source code
```

Не сохранять session credentials в обычную Prisma Business таблицу, если это не требуется архитектурой.

Использовать защищённое persistent storage.

Для local development:

```text
persistent local directory
```

Для production:

```text
persistent Docker volume / secure storage
```

Если credentials шифруются — использовать encryption key из environment/config secret.

Добавить соответствующие:

```text
WHATSAPP_SESSION_PATH
WHATSAPP_AUTH_ENCRYPTION_KEY
```

или эквивалентную конфигурацию.

Никогда не логировать auth state.

---

# 11. CONFIGURATION

Добавить конфигурацию:

```text
WHATSAPP_ENABLED
WHATSAPP_PROVIDER=baileys
WHATSAPP_SESSION_PATH
WHATSAPP_AUTO_CONNECT
WHATSAPP_RECONNECT_ENABLED
WHATSAPP_RECONNECT_DELAY
WHATSAPP_MAX_RECONNECT_ATTEMPTS
WHATSAPP_MESSAGE_TIMEOUT
WHATSAPP_ADMIN_ONLY_PAIRING
```

Фактические имена адаптировать к существующей config architecture.

Не хранить secrets в repository.

---

# 12. QR CODE

Реализовать endpoint/API для получения состояния pairing.

Например:

```text
GET /api/v1/integrations/whatsapp/status
GET /api/v1/integrations/whatsapp/qr
```

или websocket/SSE, если существующая frontend architecture позволяет.

Ответ должен содержать состояние вроде:

```json
{
  "provider": "baileys",
  "status": "QR_REQUIRED"
}
```

или:

```json
{
  "provider": "baileys",
  "status": "CONNECTED",
  "phone": "...",
  "connectedAt": "..."
}
```

Не возвращать credentials.

---

# 13. CONNECTION STATES

Определить canonical state machine:

```text
DISCONNECTED
INITIALIZING
QR_REQUIRED
CONNECTING
CONNECTED
RECONNECTING
LOGGING_OUT
ERROR
```

Не смешивать connection state с Communication status.

---

# 14. ADMIN UI

Добавить в существующий административный UI раздел:

```text
Settings / Integrations / WhatsApp
```

или использовать фактическую структуру меню проекта.

Экран должен показывать:

```text
WhatsApp
────────────────────────────

Provider:
Baileys

Status:
CONNECTED / QR_REQUIRED / DISCONNECTED

Phone:
+994...

Connected:
2026-...

[Connect]
[Disconnect]
[Logout]
```

При:

```text
QR_REQUIRED
```

показывать QR.

QR должен обновляться автоматически.

После успешного pairing:

```text
QR disappears
status = CONNECTED
```

---

# 15. SECURITY

WhatsApp management endpoints должны быть доступны только авторизованным сотрудникам с соответствующим permission.

Не использовать просто:

```text
if admin
```

если в проекте уже существует granular RBAC.

Создать permissions в существующей permission model, например:

```text
whatsapp.read
whatsapp.manage
whatsapp.send
```

Названия адаптировать к существующим conventions.

Минимально:

```text
read status
manage connection
send message
```

Разрешение на pairing/logout должно быть отдельно защищено.

---

# 16. PHONE NUMBER NORMALIZATION

Реализовать canonical phone normalization.

Телефон:

```text
+994501234567
```

должен иметь один canonical representation.

Учитывать:

```text
+
country code
national format
spaces
-
()
leading zero
```

Не делать поиск по raw string.

Использовать существующий phone normalization helper, если он уже есть.

Если его нет — создать shared utility.

---

# 17. CUSTOMER MATCHING

Входящее WhatsApp сообщение должно быть сопоставлено с CRM Customer.

Алгоритм:

```text
WhatsApp sender JID
        ↓
normalize phone
        ↓
CRM Customer.phone
        ↓
Customer ID
```

Если найден ровно один Customer:

```text
matched = true
```

Если не найден:

```text
matched = false
```

Не создавать автоматически Customer без отдельной бизнес-политики.

Если найдено несколько совпадений:

```text
AMBIGUOUS
```

и НЕ угадывать клиента.

---

# 18. WHATSAPP CONTACT ID

Хранить отдельно:

```text
WhatsApp JID
```

и:

```text
canonical phone
```

Не использовать JID как Customer ID.

Не использовать phone как единственный database primary key.

---

# 19. COMMUNICATION MAPPING

Исходящее сообщение:

```text
type = MESSAGE
channel = WHATSAPP
direction = OUTBOUND
```

Входящее:

```text
type = MESSAGE
channel = WHATSAPP
direction = INBOUND
```

`body` содержит canonical normalized text.

Сохранять:

```text
externalMessageId
```

если это требует provider mapping.

---

# 20. DATABASE EXTENSION

Проанализировать существующую Prisma schema.

Добавить только необходимые поля/таблицы.

Предпочтительно создать integration-specific entities в отдельной schema/domain, например:

```text
whatsapp.*
```

если это соответствует существующей schema-per-domain архитектуре.

Не помещать provider credentials в:

```text
communication.*
```

---

# 21. РЕКОМЕНДУЕМЫЕ WHATSAPP TABLES

Если после анализа они действительно нужны, создать:

```text
whatsapp.WhatsAppAccount
whatsapp.WhatsAppSession
whatsapp.WhatsAppContact
whatsapp.WhatsAppMessage
```

Но НЕ создавать дублирующую business message model.

Например:

```text
WhatsAppMessage
```

должна быть только provider/integration metadata:

```text
providerMessageId
jid
communicationId
direction
providerStatus
createdAt
```

а текст/бизнес-контекст должен принадлежать:

```text
Communication
```

---

# 22. IDEMPOTENCY

Inbound WhatsApp messages могут приходить повторно.

Обязательно обеспечить:

```text
providerMessageId UNIQUE
```

или equivalent deterministic deduplication.

Повторный inbound event:

```text
same providerMessageId
```

НЕ должен создавать вторую Communication.

Использовать:

```text
DB unique constraint
+
InboxEvent
```

где это соответствует текущей архитектуре.

---

# 23. OUTBOUND IDEMPOTENCY

Для outbound сообщений также определить deterministic operation identity.

Не отправлять одно и то же сообщение дважды из-за:

```text
HTTP retry
event retry
worker restart
Baileys reconnect
```

---

# 24. DELIVERY STATUS

Если Baileys позволяет достоверно определить:

```text
sent
delivered
read
```

не записывать неподтверждённые состояния.

Сначала определить фактические события provider API.

Не симулировать:

```text
DELIVERED
READ
```

если provider не даёт достоверного факта.

Если текущая Communication модель не поддерживает эти lifecycle states — не ломать её.

Provider status можно хранить в integration layer.

---

# 25. MEDIA

Реализовать как минимум архитектурную поддержку:

```text
text
image
document
```

Но rollout можно делать поэтапно.

Не хранить media bytes в PostgreSQL.

Использовать существующий media storage, если он есть в проекте.

---

# 26. INCOMING MESSAGE FLOW

Реализовать:

```text
WhatsApp
   ↓
Baileys
   ↓
Baileys Adapter
   ↓
Inbound Mapper
   ↓
Phone/JID Resolver
   ↓
CRM Customer Resolver
   ↓
Communication
   ↓
optional business context resolver
```

---

# 27. OUTBOUND MESSAGE FLOW

Реализовать:

```text
Business event
      ↓
Notification policy
      ↓
Communication/Application service
      ↓
WhatsApp dispatcher
      ↓
WhatsApp provider
      ↓
Baileys
      ↓
WhatsApp
```

---

# 28. BOOKING NOTIFICATIONS

Подключить реальные Booking events.

Минимально:

```text
BookingConfirmed
BookingRejected
BookingCancelled
BookingCompleted
```

Для каждого создать explicit notification policy.

НЕ писать business text непосредственно в consumer без необходимости.

Предпочтительно:

```text
BookingConfirmed
      ↓
NotificationTemplate
      ↓
localized message
      ↓
Communication
      ↓
WhatsApp
```

---

# 29. PAYMENT NOTIFICATIONS

После проверки фактического Finance domain подключить:

```text
PaymentCaptured
PaymentFailed
PaymentCancelled
RefundProcessed
```

Только те события, которые действительно существуют в текущем коде.

---

# 30. ORDER NOTIFICATIONS

Проверить реальные Order events.

Подключать только утверждённые business facts.

Не отправлять WhatsApp на каждый технический status transition.

---

# 31. MESSAGE TEMPLATES

Не hardcode-ить все сообщения в TypeScript.

Создать notification template layer.

Например:

```text
booking.confirmed
booking.cancelled
booking.rejected
payment.captured
payment.failed
refund.processed
```

Шаблон должен поддерживать:

```text
ru
az
en
```

если эти языки уже являются canonical languages TravelHUB.

---

# 32. LOCALIZATION

Не использовать browser locale для определения языка business notification.

Язык должен определяться из существующей customer/profile/localization policy.

Если у Customer нет language preference:

использовать platform default.

Не угадывать язык по WhatsApp сообщению.

---

# 33. TEMPLATE VARIABLES

Например:

```text
booking.confirmed
```

может получать:

```text
customerName
bookingCode
serviceName
serviceDate
destination
totalAmount
currency
supportPhone
```

Но source of truth должен оставаться в соответствующих доменах.

Не копировать business master data в WhatsApp tables.

---

# 34. TEMPLATE SNAPSHOT

Перед отправкой сформировать final rendered text.

Сохранить canonical Communication body.

Если шаблон позже изменится, история старого сообщения НЕ должна измениться.

---

# 35. FAILED SEND

Если WhatsApp недоступен:

```text
Communication
```

не должна исчезнуть.

Сохранить outbound intent.

Использовать existing outbox/retry mechanisms.

Определить:

```text
retryable
non-retryable
```

ошибки.

Например:

```text
network timeout → retry
temporary WhatsApp disconnect → retry
invalid JID → non-retryable
logged out → requires reconnection
```

---

# 36. RETRY POLICY

Использовать существующий:

```text
Outbox
```

и retry semantics.

Не создавать вторую самостоятельную retry queue без необходимости.

Backoff должен быть bounded.

Не создавать бесконечный retry loop.

---

# 37. CIRCUIT BREAKER / RATE LIMIT

Защитить систему от:

```text
WhatsApp unavailable
provider throttling
mass notification
event storm
```

Добавить rate limiting/queueing там, где это необходимо.

Не блокировать основной Booking transaction ожиданием WhatsApp.

---

# 38. CRITICAL RULE

Никогда:

```text
Booking confirmation transaction
        ↓
await WhatsApp.send()
```

Вместо этого:

```text
Booking transaction
        ↓
Outbox event
        ↓
commit
        ↓
notification consumer
        ↓
WhatsApp
```

Бизнес-транзакция не должна зависеть от WhatsApp availability.

---

# 39. CORRELATION / CAUSATION

Для всех generated outbound events/messages сохранить:

```text
correlationId
causationId
```

через существующий RequestContext/EventBus.

Не создавать альтернативную tracing system.

---

# 40. AUDIT

Все administrative operations должны попадать в существующий AuditLog/security system.

Минимально:

```text
whatsapp.connected
whatsapp.disconnected
whatsapp.logout
whatsapp.send
whatsapp.session_reset
```

Не писать:

```text
QR contents
auth credentials
private session keys
message secrets
```

в audit log.

---

# 41. PII / PRIVACY

WhatsApp messages могут содержать PII.

Не логировать полный message body в обычные application logs.

В production logs должны попадать:

```text
messageId
customerId
communicationId
direction
provider
result
```

но не полный текст.

---

# 42. LOGGING

Добавить structured logging:

```text
whatsapp.connection.changed
whatsapp.message.received
whatsapp.message.sent
whatsapp.message.failed
whatsapp.message.duplicate
whatsapp.qr.generated
```

Без credentials и чувствительного содержимого.

---

# 43. ERROR HANDLING

Определить типы ошибок:

```text
WhatsAppNotConnectedError
WhatsAppAuthenticationError
WhatsAppProviderError
WhatsAppRateLimitError
WhatsAppInvalidRecipientError
WhatsAppMessageSendError
WhatsAppSessionError
```

или адаптировать к существующим error conventions.

---

# 44. GRACEFUL SHUTDOWN

При:

```text
SIGTERM
SIGINT
Nest shutdown
```

корректно:

```text
stop receiving
finish safe operations
close socket
persist auth state
release resources
```

Не оставлять hanging WebSocket connections.

---

# 45. RECONNECT

При disconnect:

```text
connection lost
      ↓
RECONNECTING
      ↓
Baileys reconnect
```

Использовать exponential backoff.

При authentication failure:

```text
ERROR
```

не бесконечно пытаться reconnect.

При logout:

```text
DISCONNECTED
```

и удалить/invalid session только после explicit action.

---

# 46. MULTI-INSTANCE

Проанализировать текущую deployment architecture.

Критически важно:

один WhatsApp session НЕ должен одновременно запускаться несколькими backend instances.

Если приложение будет масштабироваться горизонтально:

```text
instance A
instance B
```

необходимо определить single-owner/leader mechanism для WhatsApp session.

Для первой production версии допустимо:

```text
one WhatsApp worker instance
```

если это явно документировано и enforced.

Не допускать два Baileys connections на один account.

---

# 47. SEPARATE WORKER

Если текущая архитектура позволяет, предпочтительно отделить WhatsApp runtime от HTTP process:

```text
TravelHUB API
       │
       ▼
WhatsApp Worker
       │
       ▼
Baileys
```

Но не делать отдельный deployable service только ради архитектурной красоты.

Сначала определить, что соответствует текущей инфраструктуре.

Если отдельный worker необходим для стабильности Baileys — реализовать его с canonical interface.

---

# 48. API

Реализовать защищённые endpoints, например:

```text
GET    /api/v1/whatsapp/status
GET    /api/v1/whatsapp/qr
POST   /api/v1/whatsapp/connect
POST   /api/v1/whatsapp/disconnect
POST   /api/v1/whatsapp/logout
POST   /api/v1/whatsapp/messages
GET    /api/v1/whatsapp/messages
```

Но перед созданием проверить существующие REST conventions.

Не создавать API, дублирующий Communication API без необходимости.

---

# 49. SEND MESSAGE API

Для manual send:

```json
{
  "customerId": "...",
  "body": "Здравствуйте..."
}
```

Backend должен:

```text
authenticate actor
        ↓
authorize
        ↓
resolve Customer
        ↓
resolve phone
        ↓
validate WhatsApp connection
        ↓
create Communication
        ↓
send through adapter
```

Никогда не принимать от frontend authoritative fields:

```text
senderUserId
actorUserId
status
occurredAt
providerMessageId
```

---

# 50. CUSTOMER UI

В CRM Customer page добавить Communication/WhatsApp section.

Например:

```text
Customer
────────────────────
Name
Phone
Email

Communication

[ WhatsApp ]

Conversation
────────────────────

Customer:
Здравствуйте

Manager:
Здравствуйте, чем могу помочь?

[ Type message... ]

[Send]
```

---

# 51. BOOKING UI

На Booking detail page добавить:

```text
Communication
```

и возможность увидеть сообщения, связанные с:

```text
BOOKING
```

Не создавать второй chat viewer.

Использовать существующий Communication UI, если он уже существует.

---

# 52. ORDER UI

Аналогично:

```text
Order
  ↓
Communications
```

---

# 53. THREADING

Если текущий CommunicationThread применим к WhatsApp conversation — использовать его.

Но не ломать существующий `BuyerRequest` semantics.

Не переиспользовать `CommunicationThread` механически для всех WhatsApp chats, если его domain contract предназначен именно для reverse pre-sale.

Если нужен отдельный customer-facing WhatsApp conversation entity — доказать необходимость перед добавлением.

---

# 54. INBOUND ROUTING

После получения входящего сообщения:

```text
resolve Customer
        ↓
find active Orders/Bookings
        ↓
if exactly one relevant active context:
    associate context
else:
    CUSTOMER context
```

Никогда не выбирать Booking только по принципу:

```text
latest booking
```

если существует неоднозначность.

---

# 55. HUMAN AGENT REPLY

Менеджер отвечает из TravelHUB:

```text
CRM Customer
    ↓
WhatsApp conversation
    ↓
send
```

Ответ должен попадать в:

```text
Communication
```

до/после provider send согласно выбранной delivery semantics.

Не создавать сообщение только в WhatsApp и терять его в TravelHUB.

---

# 56. OUTBOUND DELIVERY SEMANTICS

Чётко определить:

```text
CREATED
QUEUED
SENDING
SENT
FAILED
```

если integration layer требует такой lifecycle.

Не изменять canonical CommunicationStatus без архитектурного основания.

Provider delivery state хранить отдельно, если необходимо.

---

# 57. TESTING

Обязательно написать:

## Unit tests

Для:

```text
phone normalization
JID mapping
message mapping
provider adapter
connection state machine
template rendering
routing
deduplication
```

## Integration tests

Проверить:

```text
Communication → WhatsApp adapter
Booking event → notification
Customer → WhatsApp resolution
duplicate inbound → one Communication
```

## E2E

Проверить API:

```text
status
QR state
manual send authorization
```

Baileys real connection НЕ должен быть обязательным для CI.

Использовать mock provider.

---

# 58. MOCK PROVIDER

Создать:

```text
MockWhatsAppProvider
```

который позволяет тестировать:

```text
send
receive
disconnect
reconnect
failure
duplicate
```

без подключения к WhatsApp.

---

# 59. CONTRACT TEST

Проверить, что:

```text
BaileysWhatsAppProvider
```

и:

```text
MockWhatsAppProvider
```

реализуют один и тот же provider contract.

Это будет основой будущего:

```text
CloudApiWhatsAppProvider
```

---

# 60. OFFICIAL CLOUD API FUTURE

Архитектура должна позволять добавить:

```text
CloudApiWhatsAppProvider
```

без изменения:

```text
Booking
CRM
Order
Communication
UI
Notification policy
```

Замена:

```text
BAILEYS
```

на:

```text
CLOUD_API
```

должна быть configuration/deployment decision.

---

# 61. DOCUMENTATION

Создать/обновить архитектурную документацию проекта.

Обязательно описать:

```text
WhatsApp architecture
Provider abstraction
Session management
Security
Inbound flow
Outbound flow
Message lifecycle
Customer resolution
Notification events
Failure handling
Retry
Idempotency
Deployment
Scaling
Backup
Recovery
Migration to Cloud API
```

---

# 62. ENVIRONMENT DOCUMENTATION

Обновить:

```text
.env.example
```

или фактический environment documentation проекта.

Добавить все новые параметры.

Никогда не добавлять реальные secrets.

---

# 63. DOCKER / DEPLOYMENT

Проанализировать текущий Docker/deployment setup.

Если требуется persistent volume:

```text
whatsapp-session
```

добавить его.

Session НЕ должна исчезать после:

```text
docker restart
```

---

# 64. BACKUP / RECOVERY

Документировать:

```text
что нужно сохранять для WhatsApp session
как восстановить
как intentionally logout
как force reset session
```

Не включать WhatsApp credentials в обычные database dumps, если архитектура этого не требует.

---

# 65. OBSERVABILITY

Добавить health/status information:

```text
WhatsApp enabled
provider
connection state
last connected
last disconnected
reconnect count
last inbound
last outbound
send failures
```

Не раскрывать PII в public health endpoint.

---

# 66. HEALTH CHECK

Если в проекте есть existing health endpoint:

интегрировать туда только техническое состояние.

Например:

```text
WhatsApp:
CONNECTED
```

но health endpoint не должен считать весь TravelHUB unhealthy только потому, что WhatsApp отключён.

WhatsApp является optional external dependency.

---

# 67. FAILURE ISOLATION

При WhatsApp outage:

```text
TravelHUB API
CRM
Booking
Order
Payment
```

должны продолжать работать.

WhatsApp failure не должен rollback business transaction.

---

# 68. RATE LIMITING

Добавить outbound throttling.

Минимально:

```text
per-recipient
global
burst protection
```

если это требуется реальным WhatsApp provider behavior.

Не пытаться обходить WhatsApp anti-spam restrictions.

---

# 69. COMPLIANCE / OPERATIONAL WARNING

Документация должна явно указывать:

Baileys работает через WhatsApp Web protocol и является неофициальным способом интеграции.

Нельзя документировать его как официальный Meta API.

Система должна быть provider-abstracted, чтобы при необходимости перейти на официальный WhatsApp Business Platform / Cloud API.

Не реализовывать механизмы обхода блокировок, anti-spam, rate limits или security controls WhatsApp.

---

# 70. NO BUSINESS LOGIC IN BAILEYS ADAPTER

Baileys adapter должен знать только:

```text
WhatsApp protocol
JID
provider events
send
receive
connection
session
```

Он НЕ должен знать:

```text
Booking
Order
Payment
Customer business rules
CRM permissions
```

---

# 71. NO PROVIDER LOGIC IN BOOKING

Booking должен знать только:

```text
BookingConfirmed
BookingCancelled
...
```

и ничего о:

```text
Baileys
JID
WhatsApp session
QR
WhatsApp API
```

---

# 72. EVENT CONSUMERS

Создать consumers только для фактически существующих domain events.

Перед реализацией обязательно проверить:

```text
domain-events.ts
BookingService
OrderService
FinanceService
```

Не создавать consumer на event, которого нет.

---

# 73. EVENT DELIVERY

Использовать existing:

```text
EventBusService
OutboxEvent
InboxEvent
publishEvent
publishPending
retryFailed
```

Не вызывать `publishPending()` из каждого WhatsApp operation таким образом, чтобы HTTP request начинал дренировать весь outbox backlog.

Соблюдать текущую архитектуру worker-based delivery.

---

# 74. DATABASE MIGRATIONS

Все Prisma changes должны иметь migration.

Никаких ручных изменений production DB.

После migration:

```text
prisma generate
prisma migrate
typecheck
tests
```

---

# 75. CODE QUALITY

Соблюдать текущий стиль:

```text
NestJS
TypeScript
Prisma
DTO validation
RBAC
SecurityService
RequestContext
EventBus
domain boundaries
```

Не вводить новую architectural paradigm без необходимости.

---

# 76. BACKWARD COMPATIBILITY

После реализации:

```text
existing Communication API
existing Booking API
existing CRM API
existing Order API
existing EventBus
```

должны продолжать работать.

Не ломать существующие tests.

---

# 77. FRONTEND

Сначала определить фактический frontend architecture:

```text
Next.js
routes
components
API client
auth
permissions
navigation
```

и встроить WhatsApp в существующий UI style.

Не создавать отдельный standalone WhatsApp web application.

---

# 78. UX

Пользователь должен видеть понятные состояния:

```text
Not configured
QR required
Connecting
Connected
Disconnected
Error
```

При ошибке:

```text
что произошло
что делать
```

а не raw stack trace.

---

# 79. QR SECURITY

QR:

- не сохранять в database;
- не логировать;
- не кешировать дольше необходимого;
- не отдавать unauthorized users;
- invalidate old QR;
- refresh when provider generates a new one.

---

# 80. MULTI-USER POLICY

Определить, чей WhatsApp account подключается:

```text
TravelHUB company WhatsApp
```

а не личный WhatsApp сотрудника.

Архитектура первой версии:

```text
ONE PLATFORM WHATSAPP ACCOUNT
```

Если multi-account не нужен прямо сейчас — НЕ реализовывать его как business requirement.

Но интерфейс можно сделать extensible:

```text
WhatsAppAccount
```

---

# 81. PLATFORM ACCOUNT

WhatsApp account должен иметь, если это необходимо:

```text
id
displayName
phone
provider
status
createdAt
updatedAt
```

Все messages должны ссылаться на account/provider context.

---

# 82. FUTURE MULTI-ACCOUNT

Архитектура должна позволять:

```text
TravelHUB WhatsApp
       ├── Sales
       ├── Support
       └── Partner
```

но первая реализация:

```text
ONE account
```

если текущие requirements не требуют больше.

---

# 83. SUPPORT

Если Support domain уже существует, изучить его фактическую модель.

Не создавать вторую Support conversation model.

Входящий WhatsApp message потенциально должен быть преобразован в Support workflow только отдельной бизнес-политикой.

Не делать автоматический Lead/Ticket/Order creation без явного требования.

---

# 84. ANTI-DUPLICATION

Особенно проверить:

```text
Communication
CommunicationThread
Support
CRM Activity
Operational Notes
```

и не дублировать один и тот же communication fact в несколько таблиц.

---

# 85. DATA OWNERSHIP

Зафиксировать:

```text
CRM
  → customer identity/master data

Booking
  → booking business state

Order
  → order business state

Payment
  → payment state

Communication
  → communication fact

WhatsApp integration
  → provider/session/delivery metadata
```

---

# 86. NO CROSS-DOMAIN DATABASE WRITES

Не делать:

```text
WhatsAppService → direct Booking table mutation
WhatsAppService → direct Customer table mutation
```

Использовать application services / events / read-by-ID согласно существующему ADR.

---

# 87. CUSTOMER CREATION

Inbound WhatsApp message НЕ должен автоматически создавать Customer.

Если бизнес хочет auto-create later — это отдельный workflow.

Первая версия:

```text
unknown number
    ↓
unmatched communication
```

с возможностью оператору привязать клиента.

---

# 88. UNKNOWN CONTACT UI

В административном интерфейсе показать:

```text
Unknown WhatsApp contact
+994...
```

и возможность:

```text
[Find customer]
[Link customer]
```

Link operation должна быть server-authoritative и audited.

---

# 89. LINKING

После manual link:

```text
WhatsApp Contact
       ↓
Customer
```

сохранять mapping.

Не менять исторические Communication без необходимости.

---

# 90. UNLINK

Если поддерживается unlink:

```text
unlink WhatsApp contact
```

не удалять исторические messages.

История должна сохраняться.

---

# 91. MESSAGE SEARCH

Добавить возможность искать коммуникации по:

```text
customer
phone
booking
order
channel = WHATSAPP
date
direction
```

Переиспользовать Communication filtering infrastructure.

---

# 92. PAGINATION

Не загружать всю WhatsApp history.

Использовать server-side pagination.

---

# 93. SECURITY AGAINST SPOOFING

Inbound sender identity должна исходить из provider event.

Frontend никогда не должен иметь возможность заявить:

```text
sender = customer X
```

и создать inbound message.

---

# 94. WEBHOOK

Baileys не требует Meta webhook.

Не создавать fake webhook endpoint только ради архитектурной симметрии.

Inbound events идут через Baileys adapter.

---

# 95. OFFICIAL CLOUD API COMPATIBILITY

Абстракция должна позволять:

```text
Baileys:
  QR
  websocket
  session

Cloud API:
  webhook
  access token
  phone number ID
```

не смешивая эти provider-specific mechanisms с Communication.

---

# 96. MIGRATION PATH

Документировать будущий migration:

```text
Baileys Provider
       ↓
Cloud API Provider
```

без миграции:

```text
Communication
Customer
Booking
Order
```

---

# 97. IMPLEMENTATION ORDER

Работу выполнять строго в следующем порядке.

## PHASE 1 — Repository Audit

Изучить:

```text
app.module.ts
communication
eventbus
crm
booking
order
finance
security
frontend
prisma
docker
environment
tests
```

Сначала сформировать фактическую dependency map.

Не менять код.

---

## PHASE 2 — Architecture Design

Зафиксировать:

```text
provider interface
data ownership
database model
session model
message flow
event flow
security
retry
idempotency
UI flow
```

---

## PHASE 3 — Database

Реализовать необходимые Prisma changes.

Создать migration.

Проверить migration на clean DB.

---

## PHASE 4 — Provider Abstraction

Создать:

```text
WhatsAppProvider
MockWhatsAppProvider
BaileysWhatsAppProvider
```

---

## PHASE 5 — Session

Реализовать:

```text
connect
QR
persist
reconnect
disconnect
logout
```

---

## PHASE 6 — Inbound

Реализовать:

```text
receive
normalize
deduplicate
resolve contact
resolve customer
create Communication
```

---

## PHASE 7 — Outbound

Реализовать:

```text
manual send
Communication
provider send
delivery state
retry
```

---

## PHASE 8 — Events

Подключить реальные:

```text
Booking
Order
Payment
```

events.

---

## PHASE 9 — Templates

Реализовать:

```text
RU
AZ
EN
```

templates.

---

## PHASE 10 — Frontend

Реализовать:

```text
Settings → WhatsApp
Customer → Communication
Booking → Communication
```

---

## PHASE 11 — Security

RBAC + audit + PII controls.

---

## PHASE 12 — Testing

Unit + integration + e2e + mock provider.

---

## PHASE 13 — Deployment

Docker/env/persistent storage/restart recovery.

---

## PHASE 14 — Final Verification

Выполнить полный verification suite.

---

# 98. ACCEPTANCE TEST

Работа считается завершённой ТОЛЬКО если можно выполнить следующий сценарий.

## Test 1

Запустить TravelHUB.

```text
npm run dev
```

или фактическую dev command.

## Test 2

Открыть:

```text
Settings → Integrations → WhatsApp
```

## Test 3

Увидеть:

```text
QR_REQUIRED
```

## Test 4

Отсканировать QR реальным телефоном.

## Test 5

Получить:

```text
CONNECTED
```

## Test 6

Перезапустить backend.

После restart:

```text
CONNECTED
```

без нового QR.

## Test 7

Клиент пишет WhatsApp сообщение.

Оно появляется в:

```text
TravelHUB → Customer → Communication
```

## Test 8

Менеджер отвечает из TravelHUB.

Клиент получает WhatsApp message.

## Test 9

Создать/подтвердить Booking.

Например:

```text
BookingConfirmed
```

## Test 10

Клиент автоматически получает соответствующее WhatsApp notification.

## Test 11

Проверить:

```text
Communication
EventBus
Outbox
WhatsApp metadata
```

и убедиться, что correlation/idempotency работают.

## Test 12

Повторить event.

Убедиться:

```text
NO DUPLICATE MESSAGE
```

## Test 13

Отключить WhatsApp.

Создать Booking.

Booking должен успешно завершиться.

WhatsApp notification должен перейти в retryable/queued state.

## Test 14

Подключить WhatsApp обратно.

Notification должна быть обработана согласно retry policy.

## Test 15

Проверить, что:

```text
Booking
CRM
Order
Payment
```

не содержат Baileys-specific code.

---

# 99. FINAL CODE REVIEW

Перед завершением провести отдельный review.

### Architecture

```text
DDD boundaries
bounded contexts
provider isolation
```

### Security

```text
RBAC
PII
session secrets
audit
```

### Reliability

```text
outbox
retry
idempotency
reconnect
shutdown
```

### Database

```text
indexes
unique constraints
migrations
ownership
```

### Frontend

```text
permissions
UX
error states
loading
reconnect
```

### Production

```text
Docker
persistent session
restart
logs
health
monitoring
```

---

# 100. НЕ СЧИТАТЬ ЗАВЕРШЕНИЕМ

Работа НЕ считается законченной, если есть только:

```text
QR
```

или:

```text
sendMessage()
```

или:

```text
Baileys connected
```

Это только prototype.

Полная реализация должна включать:

```text
connection
session persistence
reconnect
inbound
outbound
CRM resolution
Communication integration
Booking notifications
Payment notifications
templates
localization
RBAC
audit
idempotency
retry
UI
tests
Docker
documentation
Cloud API abstraction
```

---

# 101. ОБЯЗАТЕЛЬНЫЙ FINAL REPORT

После реализации предоставить отчёт:

```text
1. Files created
2. Files modified
3. Prisma migrations
4. New database entities
5. New permissions
6. New API endpoints
7. New domain events/consumers
8. WhatsApp provider architecture
9. Session storage
10. Inbound flow
11. Outbound flow
12. Notification templates
13. Frontend changes
14. Tests
15. Commands to run
16. Environment variables
17. Docker changes
18. Known limitations
19. Security considerations
20. Future Cloud API migration path
```

Для каждого изменения указывать конкретный путь файла.

---

# 102. IMPORTANT EXECUTION RULES

НЕ:

```text
изобретать отсутствующие файлы
```

НЕ:

```text
переписывать существующую архитектуру
```

НЕ:

```text
создавать второй EventBus
```

НЕ:

```text
создавать второй Communication domain
```

НЕ:

```text
создавать второй CRM Customer
```

НЕ:

```text
подключать Baileys непосредственно к Booking/CRM/Order
```

НЕ:

```text
хранить WhatsApp credentials в Git
```

НЕ:

```text
логировать message body / credentials
```

НЕ:

```text
делать WhatsApp availability частью Booking transaction
```

НЕ:

```text
создавать fake delivery/read statuses
```

НЕ:

```text
создавать автоматические Customers из неизвестных номеров без бизнес-политики
```

НЕ:

```text
считать QR pairing полной интеграцией
```

---

# 103. WORKING PRINCIPLE

На каждом этапе:

1. сначала исследовать существующий код;
2. определить owner;
3. определить existing abstraction;
4. переиспользовать её;
5. изменить минимально необходимое количество файлов;
6. написать tests;
7. запустить typecheck;
8. запустить relevant tests;
9. только после успешной проверки переходить дальше.

Не делать массовый refactor unrelated code.

---

# 104. FINAL OBJECTIVE

После завершения TravelHUB должен иметь полноценный WhatsApp communication channel:

```text
                         TRAVELHUB
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
      CRM                  ORDER                BOOKING
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                         EventBus
                             │
                             ▼
                     Notification Layer
                             │
                             ▼
                       Communication
                             │
                             ▼
                    WhatsApp Provider
                             │
                    ┌────────┴────────┐
                    │                 │
                 Baileys          Future Cloud API
                    │
                    ▼
                 WhatsApp
```

При этом:

```text
TravelHUB business domains
```

остаются полностью независимыми от:

```text
Baileys
WhatsApp Web
JID
QR
WhatsApp session
provider-specific APIs
```

А замена:

```text
Baileys
```

на:

```text
official WhatsApp Cloud API
```

в будущем не требует переделки бизнес-логики TravelHUB.

# END OF MASTER PROMPT
