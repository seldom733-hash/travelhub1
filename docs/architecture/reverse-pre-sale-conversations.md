# Step 2.2E — Buyer Request / Proposal Communication (pre-sale conversations)

**Status:** IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW
**Owner:** Communication (`communication.*`, ADR-0011) + Reverse Marketplace context refs (ADR-0012)
**IDs:** `CML-*` (потоки и сообщения — тот же canonical ID-домен, §18)
**Migration:** `20260811101502_add_pre_sale_conversations` (additive, только `communication.*`)

---

## 1. Communication ownership

Владелец pre-sale chat — **существующий Communication bounded context** (`communication.*`).
Никакой второй messaging domain / второй chat-таблицы / второго ID-префикса не создано:

- **`communication.CommunicationThread`** — комната (room): изолированный разговор
  `BuyerRequest + Buyer + Seller [+ Proposal]`. Код — `CML-*` (тот же атомарный
  счётчик, что сообщения). Уникальность `(buyerRequestId, sellerPartnerId)` —
  DB-level кардинальность.
- **Сообщения** — существующие строки `communication.Communication` (`CML-*`),
  `type=MESSAGE`, `contextType=BUYER_REQUEST`, `contextId=buyerRequestId`,
  `threadId=<поток>`. Повторно используется существующая message-модель
  (без нового rich-text/HTML path, §15).

`reverse.*` **не изменён**: BuyerRequest / BuyerRequestDistribution / SellerProposal
остаются владельцами reverse (ADR-0012). Чат хранит ТОЛЬКО trusted context refs
(buyerRequestId, buyerCustomerId, sellerPartnerId, proposalId) без cross-schema FK
(ADR-0001) и без snapshot-дублирования.

## 2. Reverse context model

- `buyerRequestId` — ref на `reverse.BuyerRequest` (server-derived из client входа open-команды);
- `buyerCustomerId` — server-derived из `BuyerRequest.buyerId` (никогда из body);
- `sellerPartnerId` — server-derived: для PARTNER — `actor.partnerId`; для BUYER —
  резолвится из `sellerPublicId` (`SELL-*`) через `catalog.PublicSellerProfile`
  (read-only, ADR-0001);
- `proposalId` — optional trusted ref на `reverse.SellerProposal` (тот же request +
  тот же seller; auto-attach при open, если Proposal уже существует
  SUBMITTED/WITHDRAWN). Proposal НЕ становится владельцем контекста.

## 3. Buyer / Seller eligibility

- **Buyer**: владеет BuyerRequest (`request.buyerId == actor.customerId`); чужой
  request → neutral 404.
- **Seller**: имеет каноническую `BuyerRequestDistribution` для этого request
  (Step 2.2C); отсутствие → neutral 422 (анти-enumeration, не раскрывает
  существование request/distribution).
- **Request gate**: open ТОЛЬКО для `SUBMITTED` request (DRAFT не распределён,
  CANCELLED закрыт). Распределение — обязательный prerequisite.

## 4. Conversation cardinality & creation trigger

- Ровно **один** канонический pre-sale conversation на `(buyerRequestId,
  sellerPartnerId)` — DB unique + get-or-create (повторный/конкурентный open
  сходится к одному потоку, P2002 → retry новой транзакцией).
- Trigger: **явная команда** Buyer-а или Seller-а (`POST .../conversations`).
  Никакого auto-создания при distribution/proposal (ретроактивных side effects
  нет, §20).

## 5. Membership

Membership НЕ является таблицей: ровно 2 участника — server-derived колонки
`buyerCustomerId` + `sellerPartnerId`. Generic add/remove-member API **отсутствует**;
клиент не передаёт member IDs (forbidden → 422). Cross-Seller изоляция:
каждый Seller имеет собственный поток; Seller A не видит/не пишет в поток Seller B
(neutral 404, включая невозможность вывести существование).

## 6. API surface (Communication, §25)

```text
POST  /api/v1/communications/reverse/conversations            open/get (get-or-create) — communication.write_own
GET   /api/v1/communications/reverse/conversations            list own — communication.read_own
GET   /api/v1/communications/reverse/conversations/:id        detail — communication.read_own
GET   /api/v1/communications/reverse/conversations/:id/messages  сообщения (paginated) — communication.read_own
POST  /api/v1/communications/reverse/conversations/:id/messages  send — communication.write_own
```

- Open body: `{ buyerRequestId, sellerPublicId? }` — `sellerPublicId` только для
  BUYER (SELL-*); для PARTNER запрещён (identity = actor).
- Send body: `{ body, subject? }` — ТОЛЬКО. Авторство/direction/ownership/статусы
  server-derived (forged sender/senderId/direction/memberIds/... → 422).
- `direction` для thread-сообщений: автор BUYER → `INBOUND`, автор SELLER →
  `OUTBOUND` (платформенный поток от requester-стороны; не staff-семантика
  create-эндпоинта).
- Роли: BUYER/PARTNER. Staff (OPERATOR и др.) не имеют `write_own` — peer-контур
  для них закрыт (403); staff-чтение — через существующие `communication.read`
  /detail.

## 7. Message authorship / IDOR

- `senderType/senderId/recipientType/recipientId/actorUserId` — строго из actor и
  потока; спуфинг невозможен (forbidden keys + server-derived запись).
- Каждый read/send проверяет membership (neutral 404). Guessed thread id / CML
  /message id → 404 (включая legacy `GET /communications/:code` для
  BUYER_REQUEST-сообщений — own-scope не совпадает).

## 8. Request / Proposal state at send time (§31)

- **Open/send** re-read ЖИВОЙ `reverse.BuyerRequest.status` внутри транзакции
  (`SELECT ... FOR UPDATE`): CANCELLED → 422, новые сообщения блокируются,
  история остаётся читаемой и durable (§11). Нет «impossible state»:
  cancel-vs-open / cancel-vs-send сериализованы (та же техника, что 2.2C/2.2D).
- **Proposal WITHDRAWN** НЕ блокирует переписку (request — primary context);
  CML-история не удаляется; Proposal НЕ мутируется через чат (§12/§37).

## 9. Contact disclosure boundary / anti-disintermediation

`CHAT EXISTS ≠ CONTACT DISCLOSED`. Body/subject сообщений проходят **единую**
каноническую анти-disintermediation проверку (`src/shared/anti-disintermediation.ts`
— одна реализация, переиспользуется Proposal 2.2D и pre-sale chat; Roadmap
Amend 3.37B): email / phone / URL / мессенджеры / social handles → 422 (loud).
ISO-даты (YYYY-MM-DD) не считаются телефоном. Ограничение честно
документировано: базовый regex-защитник, НЕ DLP.

## 10. PublicSellerProfile projection (ADR-0005)

Buyer-view потока содержит `seller` = seller-safe проекцию (`publicId` `SELL-*`,
`displayName` по `visibilityMode`, `verified`, `memberSince`, `countryCode`,
`cityCode`) — **никогда** raw `crm.Partner` UUID/legal/private. HIDDEN-профиль →
seller недоступен (open → 422, идентичность не раскрывается); ANONYMOUS →
`displayName: null`. Сообщения в обе стороны содержат только `side`
(BUYER/SELLER) — без внутренних UUID сторон.

## 11. Buyer PII minimization

Seller-view: только request-контекст (`requestCode` BRQ-*, `buyerRequestId`),
НЕ customerId/email/имя/телефон. Сообщения — без raw идентичности сторон.

## 12. Idempotency / concurrency / failure atomicity

- Open: DB unique + get-or-create + retry-цикл (P2002 → новая транзакция);
  никаких duplicate rooms.
- Send: одна транзакция (FOR UPDATE request + insert + audit); 422 не оставляет
  строк; failed open не создаёт поток.
- Аудит: `conversation.opened` / `conversation.message.sent` в `security.AuditLog`
  (без body — PII minimization). События НЕ эмитятся (конвенция ADR-0011 §19 —
  нет реального consumer-а). Correlation: requestId/correlationId из request
  context (ADR-0009).

## 13. Isolation guarantees (zero fan-out)

Open/send создают НОЛЬ: Lead/Opportunity/Quote/Checkout/Sale/Order/Booking/
Payment/Product/Tariff/AvailabilityReservation. Acquisition source НЕ меняется
(остаётся `BUYER_REQUEST`). DD-030 (Proposal→Sales conversion target) НЕ
резолвится в 2.2E; никаких sales refs в чате как authority.

## 14. Pagination

- Thread list: `createdAt desc, id desc`, page/pageSize (cap 50), total/hasMore.
- Messages: `occurredAt asc, code asc` (хронология чата), cap 50.

## 15. Migration

`20260811101502_add_pre_sale_conversations` — additive, только `communication.*`:
enum `BUYER_REQUEST`, таблица `CommunicationThread` (+ unique/индексы), колонка
`Communication.threadId` (+ индекс). `reverse.*` не тронут (доказано e2e §28/§35).
Clean replay на e2e-БД (globalSetup), drift 0.

## 16. Compatibility with 2.2F

2.2F (Proposal → canonical Sales conversion) остаётся следующим шагом после
2.2E STRICT REVIEW: чат не создаёт conversion-точку и не содержит sales refs;
Buyer-выбор Proposal останется явной domain-командой (gate DD-030).
