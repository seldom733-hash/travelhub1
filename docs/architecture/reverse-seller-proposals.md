# PHASE 2 — STEP 2.2D — SELLER PROPOSAL FOUNDATION (reverse.*)

**Status:** `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` (Step 2.2D)
**Owner:** Reverse Marketplace (`reverse.*`, ADR-0012)
**Prerequisite:** Step 2.2C Strict Review `APPROVED WITH REVIEW FIXES`

---

## 1. Ownership

`SellerProposal → reverse.*` (ADR-0012). Proposal НЕ owned Sales/Catalog/CRM/
Communication/Order/Booking. Reverse читает trusted refs по ID (ADR-0001):
`BuyerRequest` и `BuyerRequestDistribution` — внутри `reverse.*` (реальные FK);
`crm.Partner` (seller status) и `catalog.Category` — кросс-контекстные reads
по ID без FK. Никаких cross-context writes.

## 2. Proposal ≠ Sales Quote — hard gate

SellerProposal — pre-commercial competitive ответ, НЕ `sales.Quote`/
`sales.Opportunity`/`sales.Sale`/Checkout/Order. Sales Quote table НЕ
переиспользуется; второй binding Quote engine НЕ создаётся. Binding commercial
authority остаётся canonical Sales Quote/Checkout/Sale (Step 2.3+).

## 3. Non-binding money

`money.amount` — индикативная сумма: Decimal(12,2) (Prisma Decimal, не JS
float), non-negative, верхняя граница 99_999_999_999.99, явная ISO 4217
currency (обязательна при amount), БЕЗ silent currency conversion, БЕЗ
использования в Checkout. `NULL amount` = `PRICE_ON_REQUEST` — честное
отсутствие, ноль НЕ фабрикуется. Proposal amount НЕ authoritative для
Checkout/Sale. Бюджет BuyerRequest — НЕ-binding hint: Proposal может быть выше
или ниже бюджета, сервер не выводит цену из бюджета и не отклоняет по нему.

## 4. Distribution prerequisite

Создание Proposal ТРЕБУЕТ реальной `BuyerRequestDistribution` к этому Seller-у
(`resolveDistribution(buyerRequestId, sellerId)`). `distributionId` — server-
derived (клиент НЕ передаёт; в forbidden keys). Отсутствие distribution →
422 с нейтральным сообщением (анти-enumeration: не раскрывает существование
чужого request). No self-match, no forged distribution.

## 5. Seller own-scope

`sellerId` ВСЕГДА из `actor.partnerId` (сервер), никогда из body/query.
Все мутации own-scope: чужой Proposal → neutral 404 (list/get/history/update/
submit/withdraw). Gate: PARTNER + partnerId (approved onboarding) + CRM Partner
ACTIVE (cross-schema read ADR-0001).

## 6. Buyer own-scope

Buyer читает только Proposals СВОИХ Buyer Requests: `listForRequest`/
`getForRequest` гейтятся `actor.customerId` + принадлежностью request.
Чужой request / чужой Proposal → neutral 404. Buyer видит ТОЛЬКО
`SUBMITTED`/`WITHDRAWN` Proposal (DRAFT — не направлен). DRAFT Proposal
недоступен Buyer-у даже по id (404).

**Seller identity (ADR-0005):** Buyer-проекция содержит seller-safe
`seller`-объект из `PublicSellerProfile` (catalog.*, read-only по ADR-0001):
`publicId` (SELL-*), `displayName` (по visibilityMode; ANONYMOUS → null),
`visibilityMode`, `verified`, `memberSince`, `countryCode`, `cityCode`.
Внутренний `sellerId` (crm.Partner UUID) НЕ отдаётся. Профиль HIDDEN/
отсутствует → `seller = null` (идентичность не показывается, не
угадывается).

## 7. Cross-Seller isolation — hard gate

Seller A видит/мутирует только Proposal A; Proposal B недоступен (404),
списки не содержат чужих rows; контент/цена/количество чужих Proposal не
выводимы. Buyer-проекция одного Seller не раскрывает данных другого (только
свои proposal-факты + sellerId как публичный ref).

## 8. Cardinality

`BuyerRequest → 0..N Seller Proposals`; ОДИН Proposal на (Seller, BuyerRequest)
— DB `@@unique([buyerRequestId, sellerId])`. Retry/concurrent duplicate create
→ 409 (нет дубликатов; паттерн `uniqueConstraintNames` как у capabilities).

## 9. Lifecycle

`DRAFT → SUBMITTED → WITHDRAWN`. Редактирование только DRAFT; submit —
DRAFT → SUBMITTED (повторный submit — deterministic no-op без нового
milestone); withdraw — SUBMITTED → WITHDRAWN (терминал). `ACCEPTED/SELECTED/
CONVERTED/QUOTED/WON/LOST` НЕ в 2.2D (Buyer selection — Step 2.2F, DD-030).

## 10. BuyerRequest status gate

- `DRAFT` request → нет distribution → Proposal невозможен (422);
- `CANCELLED` request → новые Proposal запрещены (422); существующие
  Proposal durable (история не удаляется); DRAFT правки заморожены (422,
  честный контракт §12 prompt), withdraw остаётся доступен для SUBMITTED;
- `SUBMITTED` request → Proposal возможен (distributed Seller).

## 11. Content / anti-disintermediation

Free-text поля (`description`, `includedServices`, `exclusions`, `conditions`,
`notes`) — plain text, ≤4000 символов, анти-injection (без HTML/script),
control chars (кроме \t\n\r) отклоняются (422), анти-disintermediation:
запрет email/phone/URL/social/telegram/whatsapp (regex-паттерны, обнаружение
→ 422 loud). ISO-даты (YYYY-MM-DD) НЕ считаются телефоном (узкое исключение
только для phone-паттерна: все совпадения должны быть датами; реальный
телефон рядом с датой ловится). `PROPOSAL EXISTS ≠ CONTACT DISCLOSED`.
Ограничение документировано: это базовая regex-защита, НЕ DLP-level safety
(обфусцированные контакты «at»/«dot» не детектируются). Buyer-контакты НЕ
раскрываются ни в одном Proposal-endpoint.

## 12. CAS / concurrency

`version` optimistic concurrency: stale expectedVersion → 409 (update/submit/
withdraw); concurrent updates → один победитель; submit/update race
детерминирован (CAS на row). Дубликат submit не создаёт дубликатов milestone.

**Request cancel vs Proposal create/update/submit (Step 2.2D §14):** внутри
каждой мутирующей транзакции выполняется `SELECT ... FOR UPDATE` на request
row (та же техника, что 2.2C matching). Детерминированный порядок:
- cancel закоммичен раньше → create/update/submit видят CANCELLED → 422,
  Proposal НЕ может стать SUBMITTED/измениться на CANCELLED request
  (невозможное состояние недостижимо);
- Proposal-операция первая → факт durable, cancel продолжит (история
  Proposal сохраняется, Buyer projection показывает актуальный request.status).

## 13. History / audit

`SellerProposalHistory` — created/updated/submitted/withdrawn с actor,
from/to, changed fields (без контактного PII). `AuditLog` (SecurityService):
`proposal.created/updated/submitted/withdrawn` с resource `SellerProposal`.
Failed CAS/validation/IDOR НЕ оставляют success-записей (транзакционная
атомарность: mutation+history+audit в одной транзакции).

## 14. Events / outbox / communication / Sales

События НЕ эмитятся (consumer отсутствует в 2.2D; 2.2E/2.2F читают состояния
напрямую; explicit command — наблюдаемый trigger). Chat НЕ создаётся
(Step 2.2E — Communication = CML-*, второй messaging domain запрещён).
Create/update/submit создают ноль: Lead/Opportunity/Quote/CheckoutIntent/
Sale/OrderRequested/Order/Booking/Payment. Ноль мутаций Catalog/Product/
Tariff/Availability/Reservation.

## 15. DD-030 compatibility

Schema поддерживает будущую конверсию без выбора target сейчас: НЕТ
`salesQuoteId`/`leadId`/`opportunityId`/`selected` полей (все в forbidden
keys). Решение «Lead vs Opportunity vs Quote» — за 2.2F (DD-030 gate).

## 16. Acquisition source

Proposal originates from BuyerRequest; `BUYER_REQUEST` остаётся на
BuyerRequest (серверный, не forgeable через Proposal payload). Step 2.2F
сохранит его через canonical Sales → Order pipeline (Step 2.5B propagation).

## 17. ID strategy

`PRP-00000001` — канонический префикс зарегистрирован в `docs/contracts/ids.md`
и генерируется атомарным `IdsService.nextCode(tx, "PRP")` в транзакции create.

## 18. Indexes / query paths

- `@@unique([buyerRequestId, sellerId])` — один Proposal на (Seller, request);
- `@@index([sellerId])` — Seller own list;
- `@@index([sellerId, status])` — Seller list по статусу;
- `@@index([buyerRequestId, status])` — Buyer own-request read
  (SUBMITTED/WITHDRAWN filter);
- детерминированная пагинация `[createdAt desc, id desc]` (seller) /
  `[submittedAt desc, id desc]` (buyer).

## 19. API surface

Seller (`/api/v1/partner/reverse/proposals`, `reverse.proposal.write_own`/
`read_own`):
- `POST /` create (требует `buyerRequestId`, распределённый Seller-у);
- `GET /` list own; `GET /:id` get own; `GET /:id/history`;
- `PATCH /:id` update DRAFT (CAS `expectedVersion`);
- `POST /:id/submit`; `POST /:id/withdraw` (CAS).

Buyer (`/api/v1/buyer/requests/:requestId/proposals`, `reverse.proposal.read_own`):
- `GET /` list proposals своего request (SUBMITTED/WITHDRAWN);
- `GET /:proposalId` get proposal своего request.

## 20. Permissions / RBAC

`reverse.proposal.read_own` — PARTNER (свои Proposal) и BUYER (proposals
своего request); `reverse.proposal.write_own` — PARTNER own-scope.
ADMIN — по конвенции ALL_PERMISSIONS. Staff-роли иных прав не получают;
роль гейтится дополнительно в сервисе (403).

## 21. Mass assignment

Forbidden keys (create): id/code/sellerId/partnerId/ownerId/buyerId/
distributionId/status/version/acquisitionSource/source/createdBy/timestamps/
convertedAt/quoteId/saleId/contactDisclosed/selected/accepted/correlation/
causation. `buyerRequestId` НЕ запрещён на create (легитимный вход — для
какого request создаётся Proposal); на update/lifecycle запрещён (immutable).
Lifecycle принимает ТОЛЬКО `expectedVersion` (forged → 422 loud).

## 22. Migration

`20260811090154_add_reverse_seller_proposals` — additive:
`reverse.SellerProposal` + `reverse.SellerProposalHistory` + enum
`ProposalStatus`. Без cross-schema FK, без destructive backfill, без db push.
Clean replay + drift 0 (проверено e2e globalSetup).

## 23. Compatibilities

- **2.2E (Communication):** Proposal НЕ создаёт chat; контекст
  `BuyerRequest + Buyer + Seller [+ Proposal]` — 2.2E будет использовать
  существующий Communication (CML-*).
- **2.2F (Conversion):** Proposal → canonical Sales conversion (DD-030 gate).
- **2.5B (Acquisition):** `BUYER_REQUEST` propagation сохранён.

## 24. Deferred (НЕ в 2.2D)

Contact disclosure policy (PROPOSAL ≠ DISCLOSED), Buyer selection/accept,
Proposal → Sales conversion, proposal chat, entitlement product rules,
Universal Pricing, Service Templates. 2.2E и 2.2F НЕ начаты.
