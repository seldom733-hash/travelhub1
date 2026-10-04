# M3 — WhatsApp Inbound & Chat
## FINAL IMPLEMENTATION PROMPT

**Project:** TravelHUB  
**Repository:** `seldom733-hash/travelhub1`  
**Branch:** `master`  
**Previous gate:** M2 — PASS  
**Current stage:** M3  
**Scope:** WhatsApp inbound + customer matching + communication context + operator chat UI

---

## 0. ОБЯЗАТЕЛЬНОЕ ПРАВИЛО

Перед реализацией M3 разработчик обязан изучить фактический текущий код репозитория.

**Не создавать заново сущности, сервисы или механизмы, которые уже существуют.**

При конфликте текущий код + Prisma schema + существующие тесты имеют приоритет над предположениями этого промпта.

Не менять существующий M2-контур без необходимости. Не переделывать Baileys provider, session lifecycle, auth-state, lease/fencing, outbound lifecycle или idempotency только ради удобства M3.

---

## 1. СОСТОЯНИЕ ПОСЛЕ M2

M2 считается завершённым.

Уже реализовано:

- Baileys 6.7.24;
- Baileys adapter/provider;
- ESM loader;
- encrypted AuthStateStore;
- AES-256-GCM;
- crash-safe persistence;
- lease + fencing;
- session ownership;
- session runtime;
- connection state machine;
- `LOGGED_OUT`;
- QR;
- connect/disconnect/logout/session-reset;
- RBAC;
- audit;
- outbound;
- idempotency;
- providerMessageId;
- at-most-once;
- UNKNOWN recovery;
- delivery receipts: `sentAt`, `deliveredAt`, `readAt`.

M2 имеет 126/126 unit suites, 2025/2025 tests, 16 WhatsApp suites / 178 tests и WhatsApp e2e + RBAC 26/26.

Эти механизмы не переписывать.

M2 сознательно оставил за последующими этапами inbound, deduplication, suppression/throttle orchestration, media, frontend UI, contacts link/unlink и CommunicationThread.

---

## 2. ЦЕЛЬ M3

После M3 TravelHUB должен уметь:

```text
WhatsApp
   ↓
Baileys
   ↓
Inbound event
   ↓
Deduplication
   ↓
Phone normalization
   ↓
Customer matching
   ↓
Communication
   ↓
Business context
   ↓
Operator UI
```

Оператор должен видеть входящие WhatsApp-сообщения в TravelHUB и иметь возможность отвечать клиенту.

WhatsApp остаётся **каналом коммуникации**, а не бизнес-сущностью.

---

## 3. ГЛАВНЫЙ БИЗНЕС-ПРИНЦИП

История коммуникации должна быть непрерывной.

Нельзя создавать отдельную историю для каждого этапа:

```text
WhatsApp → Request history
WhatsApp → Order history
WhatsApp → Booking history
```

Нужно:

```text
Customer
   │
   └── Communication
          │
          ├── Request
          ├── Order
          └── Booking
```

То есть:

```text
WhatsApp conversation
        │
        ▼
Customer
        │
        ▼
Request
        │
   conversion
        ▼
Order
        │
   conversion
        ▼
Booking
```

**Сообщения не копируются при Request → Order или Order → Booking.**

Меняется только актуальный бизнес-контекст.

---

## 4. НЕ СОЗДАВАТЬ ТРЕТЬЮ НЕЗАВИСИМУЮ ИСТОРИЮ

Существующая коммуникационная модель должна быть сначала изучена.

Особенно проверить:

- `communication`;
- `CommunicationThread`;
- существующие communication/message модели;
- связи с `buyerRequestId`;
- `sellerPartnerId`;
- существующие API;
- существующие frontend-компоненты.

Если существующий `CommunicationThread` жёстко привязан к Request и не способен корректно представить непрерывную коммуникацию Customer → Request → Order → Booking, **не ломать его ради WhatsApp**.

Предложить/реализовать минимальный слой связи, который позволяет сохранить одну историю.

Не создавать generic `Conversation` только потому, что это удобно.

---

## 5. INBOUND PIPELINE

Реализовать обработку входящих WhatsApp events:

```text
Baileys event
    ↓
parse
    ↓
validate
    ↓
normalize
    ↓
deduplicate
    ↓
persist
    ↓
match customer
    ↓
resolve business context
    ↓
publish/update communication
```

Каждый этап должен быть идемпотентным настолько, насколько это необходимо.

---

## 6. INBOUND MESSAGE

Для входящего сообщения необходимо сохранить минимум:

- internal id;
- WhatsApp provider message id;
- sender JID;
- normalized phone;
- message type;
- text, если присутствует;
- timestamp;
- `fromMe`;
- raw/provider metadata только если это действительно необходимо;
- createdAt;
- processing status;
- matching status.

Не хранить полный Baileys event целиком без необходимости.

PII минимизировать.

---

## 7. ДЕДУПЛИКАЦИЯ

Provider message id является основным ключом дедупликации.

Повторная доставка одного WhatsApp message не должна создавать три сообщения.

Ожидаемый результат:

```text
same providerMessageId
same event
same event concurrently
        ↓
one canonical message
```

Добавить уникальное ограничение/индекс на канонический provider message id, если текущая schema этого ещё не обеспечивает.

Гонка двух одинаковых inbound events должна завершаться одним сообщением.

Обязательно написать concurrency test.

---

## 8. `fromMe`

Использовать ранее принятое решение:

```text
fromMe = true
    ↓
OUTBOUND
    +
sentOutsideTravelHub = true
```

если сообщение было отправлено с телефона вне TravelHUB.

Не создавать вторую копию сообщения, если outbound уже известен TravelHUB.

Определить механизм корреляции с существующим outbound message через providerMessageId.

---

## 9. PHONE NORMALIZATION

`Customer.phone` является nullable/raw и не должен считаться уникальным идентификатором Customer.

Решение владельца:

> backfill не выполняется; нормализация read-only.

Поэтому:

```text
existing Customer.phone
        ↓
normalize for matching
        ↓
НЕ изменять Customer.phone автоматически
```

Не выполнять массовый backfill и не менять существующие номера клиентов молча.

---

## 10. CUSTOMER MATCHING

После нормализации телефона выполнить поиск Customer.

Результаты строго:

```text
0 matches
    ↓
UNMATCHED

1 match
    ↓
MATCHED

>1 matches
    ↓
AMBIGUOUS
```

Это принятое бизнес-решение и не должно пересматриваться в M3.

---

## 11. UNMATCHED

Если Customer не найден:

```text
matchingStatus = UNMATCHED
```

Сообщение не теряется.

Оператор должен видеть его в inbox.

Должна существовать возможность:

```text
UNMATCHED
    ↓
выбрать Customer
    ↓
MATCHED
```

При ручной привязке необходимы audit, actor, timestamp, old state, new Customer и действие/причина.

Не создавать Customer автоматически только потому, что пришло WhatsApp-сообщение.

---

## 12. AMBIGUOUS

Если найдено несколько Customer:

```text
matchingStatus = AMBIGUOUS
```

Не выбирать Customer автоматически.

Оператор должен выбрать правильного Customer.

После выбора:

```text
AMBIGUOUS
    ↓
MATCHED
```

Зафиксировать audit.

Правило:

> 0 → UNMATCHED  
> 1 → MATCHED  
> >1 → AMBIGUOUS  
> выбор оператором.

---

## 13. BUSINESS CONTEXT

После определения Customer система должна определить актуальный коммерческий контекст.

Приоритет:

```text
ACTIVE Booking
      ↓
ACTIVE Order
      ↓
ACTIVE Request
      ↓
Customer only
```

Старый Request/Order не исчезает.

Пример:

```text
Customer C1

Request:
MKT-REQ-00001202
       ↓
Order:
MKT-ORD-00001202
       ↓
Booking:
MKT-BKG-00001202
```

WhatsApp conversation остаётся одной. Текущий context меняется на актуальный.

Исторические связи сохраняются.

---

## 14. КРИТИЧЕСКОЕ ПРАВИЛО CONVERSION

Никогда не делать:

```text
Request conversation
       ↓ copy
Order conversation
       ↓ copy
Booking conversation
```

Правильно:

```text
ONE COMMUNICATION HISTORY

Customer
   │
   └── WhatsApp communication
          │
          ├── Request 00001202
          ├── Order 00001202
          └── Booking 00001202
```

При conversion меняется association/context, а не создаётся новая история сообщений.

---

## 15. BUSINESS NUMBER

Сохранить существующую архитектуру commerce sequence:

```text
MKT-REQ-00001202
       ↓
MKT-ORD-00001202
       ↓
MKT-BKG-00001202
```

WhatsApp не генерирует отдельный коммерческий номер.

WhatsApp ссылается на существующий бизнес-контекст.

---

## 16. COMMUNICATION LAYER

Notification layer принят как отдельный channel-agnostic слой рядом с `communication/`, а не внутри `whatsapp/`.

Архитектура:

```text
communication/
       ↑
notification/
       ↑
whatsapp/
```

не:

```text
whatsapp/
   └── notification/
```

WhatsApp должен быть provider/channel.

---

## 17. OUTBOUND И INBOUND ДОЛЖНЫ СХОДИТЬСЯ В ОДНОЙ ИСТОРИИ

Пример:

```text
10:00 Customer → WhatsApp
     "Здравствуйте"

10:01 Operator → WhatsApp
     "Добрый день"

10:03 Customer → WhatsApp
     "Мне нужен тур"

10:04 Operator → WhatsApp
     "На какие даты?"
```

Все четыре сообщения должны отображаться в одном timeline.

Не должно быть двух независимых Incoming/Outgoing histories.

---

## 18. OPERATOR INBOX

После backend inbound необходимо реализовать минимальный frontend.

### Левая колонка

- Customer;
- phone;
- last message;
- last message time;
- unread count;
- matching status;
- current business context.

### Центральная колонка

- inbound;
- outbound;
- timestamps;
- delivery/read status;
- sender;
- message state.

### Правая колонка

```text
Customer
Request
Order
Booking
```

Если Customer не найден:

```text
UNMATCHED
[Find customer]
```

Если несколько:

```text
AMBIGUOUS
[Select customer]
```

---

## 19. SEND FROM UI

Оператор должен иметь возможность отправить сообщение из чата.

Использовать уже существующий:

```text
POST /api/v1/whatsapp/messages
```

Не создавать второй send endpoint.

Сохранить:

- RBAC;
- Idempotency-Key;
- audit;
- providerMessageId;
- at-most-once;
- UNKNOWN recovery.

---

## 20. DELIVERY STATUS

Frontend должен отображать:

```text
SENT
DELIVERED
READ
```

на основании:

```text
sentAt
deliveredAt
readAt
```

Не создавать альтернативную модель delivery status.

Переходы монотонные:

```text
SENT → DELIVERED → READ
```

---

## 21. MEDIA

Media в M3 не реализовывать, кроме минимальной поддержки, если она обязательна для inbound parser.

Не делать полноценный media subsystem.

Media — отдельный этап.

---

## 22. SUPPRESSION

Принято:

```text
STOP
СТОП
UNSUBSCRIBE
```

только эти ключевые слова, без NLP.

Storage:

```text
whatsapp.WhatsAppSuppression
```

с audit.

Если suppression ещё не реализован полностью, не смешивать его с inbound core. Можно предусмотреть hook `inbound → suppression check`, но полноценную suppression orchestration вынести отдельно.

---

## 23. SECURITY

Все новые endpoints используют существующий security/RBAC механизм.

Не создавать собственную authorization систему.

Минимум:

```text
whatsapp.read
whatsapp.send
whatsapp.manage
whatsapp.send.recover
```

---

## 24. AUDIT

Audit обязателен для:

- manual Customer matching;
- AMBIGUOUS resolution;
- UNMATCHED resolution;
- link/unlink;
- outbound send;
- administrative actions.

Не логировать QR, encryption key, auth state и лишние PII.

---

## 25. REST API

Перед созданием новых endpoints проверить существующие.

Минимально необходимые операции:

```text
GET    /whatsapp/conversations
GET    /whatsapp/conversations/:id/messages

POST   /whatsapp/messages

POST   /whatsapp/conversations/:id/link-customer
POST   /whatsapp/conversations/:id/resolve

GET    /whatsapp/conversations/unmatched
GET    /whatsapp/conversations/ambiguous
```

Названия адаптировать к фактической архитектуре проекта.

Если существующий API уже решает задачу — использовать его.

---

## 26. DATABASE

Перед миграцией определить, какие сущности уже существуют.

Не добавлять поля «на всякий случай».

Если нужны новые сущности, минимальная модель должна позволять:

```text
WhatsApp inbound message
        │
        ├── providerMessageId
        ├── phone
        ├── Customer?
        ├── communication?
        ├── Request?
        ├── Order?
        ├── Booking?
        └── matchingStatus
```

Не создавать одновременно полную универсальную CRM conversation model.

---

## 27. IDEMPOTENCY

Inbound должен быть устойчив к повторным событиям.

Тест:

```text
same providerMessageId
same event
same event concurrently
```

Результат:

```text
one persisted message
```

Outbound M2 idempotency не ломать.

---

## 28. TEST MATRIX

M3 считается готовым только при наличии тестов.

### Inbound

- valid text;
- empty/unsupported message;
- fromMe;
- inbound;
- timestamp;
- providerMessageId.

### Deduplication

- same message twice;
- same message concurrently;
- provider retry.

### Customer matching

```text
0 → UNMATCHED
1 → MATCHED
2+ → AMBIGUOUS
```

### Manual resolution

- UNMATCHED → MATCHED;
- AMBIGUOUS → MATCHED;
- wrong Customer forbidden/validated;
- audit created.

### Business context

Test:

```text
Customer
  ↓
Request
  ↓
Order
  ↓
Booking
```

и проверить, что communication history остаётся одной.

### Conversion continuity

Создать:

```text
Request MKT-REQ-00001202
Order  MKT-ORD-00001202
Booking MKT-BKG-00001202
```

Отправить сообщения до и после каждой conversion.

Assert:

```text
same communication thread/history
same customer
same WhatsApp conversation
different current business context
```

Без дублирования сообщений.

### Outbound

Сообщение, отправленное из UI, появляется в том же timeline, что и inbound.

### Delivery

```text
SENT
→ DELIVERED
→ READ
```

Без обратного перехода.

---

## 29. E2E SCENARIO — ОБЯЗАТЕЛЬНЫЙ

### Step 1

Customer существует:

```text
Customer C1
phone = +994...
```

### Step 2

Incoming WhatsApp:

```text
"Здравствуйте"
```

Expected:

```text
MATCHED
Customer C1
```

### Step 3

Operator replies:

```text
"Добрый день!"
```

Expected: same conversation.

### Step 4

Create Request:

```text
MKT-REQ-00001202
```

### Step 5

Customer accepts.

### Step 6

Convert:

```text
MKT-REQ-00001202
        ↓
MKT-ORD-00001202
```

### Step 7

Customer sends another WhatsApp message.

Expected: same conversation.

Current context:

```text
Order MKT-ORD-00001202
```

### Step 8

Convert to Booking:

```text
MKT-BKG-00001202
```

### Step 9

Customer sends another WhatsApp message.

Expected: same conversation.

Current context:

```text
Booking MKT-BKG-00001202
```

### Final assertion

```text
ONE Customer
ONE WhatsApp conversation
ONE continuous communication history

Request → Order → Booking
```

и **zero copied messages**.

---

## 30. UI ACCEPTANCE TEST

Оператор должен суметь:

1. открыть WhatsApp;
2. увидеть incoming message;
3. увидеть Customer;
4. открыть communication;
5. увидеть Request/Order/Booking context;
6. написать ответ;
7. отправить его;
8. увидеть SENT;
9. получить DELIVERED/READ;
10. после Request → Order продолжить тот же чат;
11. после Order → Booking продолжить тот же чат;
12. не увидеть дубликатов истории.

---

## 31. M3 НЕ ВХОДИТ

Не реализовывать:

- WhatsApp Cloud API;
- второй WhatsApp provider;
- Telegram;
- email;
- полноценный media center;
- NLP;
- AI chatbot;
- автоматическое создание Customer;
- массовую нормализацию Customer.phone;
- marketing campaigns;
- broadcast;
- полноценную CRM automation;
- полноценную notification template management;
- изменение существующего Request/Order/Booking lifecycle без необходимости для коммуникационного контекста.

---

## 32. DEFINITION OF DONE

### Backend

- inbound работает;
- providerMessageId deduplication работает;
- Customer matching работает;
- UNMATCHED работает;
- AMBIGUOUS работает;
- manual resolution работает;
- audit работает;
- business context определяется;
- история не копируется;
- outbound остаётся совместим с M2.

### Frontend

- оператор видит inbox;
- видит timeline;
- видит Customer;
- видит business context;
- может отправить сообщение;
- видит delivery state;
- может разрешить UNMATCHED/AMBIGUOUS.

### Tests

- unit;
- integration;
- e2e;
- concurrency для deduplication;
- Request → Order → Booking continuity.

### Quality

```text
npm run typecheck
npm test
relevant e2e
```

должны проходить.

Не считать M3 PASS только на основании unit tests.

---

## 33. GATE M3

В конце разработчик обязан предоставить `M3 Gate Report` с:

1. HEAD commit;
2. изменёнными файлами;
3. Prisma migrations;
4. schema changes;
5. API endpoints;
6. inbound architecture;
7. matching logic;
8. communication linkage;
9. Request→Order→Booking continuity;
10. test results;
11. e2e results;
12. known limitations;
13. manual smoke instructions.

Отдельно:

| Gate | Result |
|---|---|
| inbound | PASS/FAIL |
| deduplication | PASS/FAIL |
| customer matching | PASS/FAIL |
| UNMATCHED | PASS/FAIL |
| AMBIGUOUS | PASS/FAIL |
| manual resolution | PASS/FAIL |
| communication continuity | PASS/FAIL |
| Request→Order continuity | PASS/FAIL |
| Order→Booking continuity | PASS/FAIL |
| outbound compatibility | PASS/FAIL |
| delivery receipts | PASS/FAIL |
| RBAC | PASS/FAIL |
| audit | PASS/FAIL |
| frontend chat | PASS/FAIL |
| e2e | PASS/FAIL |

---

## 34. ОСОБОЕ ТРЕБОВАНИЕ К РАЗРАБОТЧИКУ

Не писать в отчёте:

> «готово, если тесты зелёные».

Нужно доказать именно бизнес-сценарий:

```text
WhatsApp
   ↓
Customer
   ↓
Request
   ↓
Order
   ↓
Booking
```

при этом:

```text
communication history = ONE
```

а не:

```text
Request history
Order history
Booking history
```

---

## 35. STOP CONDITION

Если обнаруживается архитектурный конфликт, требующий изменения существующего M2 или базовой communication architecture:

**остановить реализацию перед destructive/refactoring changes.**

Сначала представить:

1. обнаруженный конфликт;
2. текущую реализацию;
3. почему M3 нельзя корректно завершить без изменения;
4. минимальное изменение;
5. влияние на M2;
6. необходимые regression tests.

Не делать крупный refactor молча.

---

## 36. ИТОГОВАЯ ЦЕЛЬ M3

После завершения M3 оператор TravelHUB должен работать с WhatsApp как с обычным встроенным каналом коммуникации TravelHUB:

```text
                         ┌───────────────┐
                         │   Customer    │
                         └───────┬───────┘
                                 │
                         WhatsApp communication
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
          inbound/outbound                  audit/status
                 │
                 ▼
        ┌─────────────────┐
        │ Communication   │
        │     History     │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Current Business    │
        │ Context             │
        └─────────┬───────────┘
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
    Request      Order     Booking
       │          │          │
       └──────────┴──────────┘
              same commerce
                sequence
```

Главный результат:

> **WhatsApp не создаёт отдельный бизнес-мир. Он становится каналом внутри существующего Customer → Request → Order → Booking lifecycle.**
