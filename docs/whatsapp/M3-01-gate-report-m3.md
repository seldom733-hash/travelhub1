# M3-01. Gate Report — M3 «WhatsApp Inbound & Chat»

- **Дата:** 2026-10-03, ветка `master`, HEAD `28c4dcd` (по правилу владельца **ничего не коммичено** — все изменения в working tree). Финальный rerun выполнен 2026-10-03 14:03–14:15.
- **Итог: GATE M3 = PASS по всем 15 пунктам gate-таблицы** (с known limitations §13). Условие владельца выполнено: оба backend quality issue разобраны (Issue 1 — §11, Issue 2 — §12) и финальный clean rerun выполнен (§8–§10, все зелёные). Доказательство — не только тесты: полный live browser-smoke §30/§34 (скриншоты `m3-ui-0*.png` + API-снимок цепочки `m3-ui-05-chain-api-verification.txt`) и live API-верификация состояний UNMATCHED→AMBIGUOUS→MATCHED→SENT.
- **Scope M3:** inbound-pipeline (dedup → нормализация телефона → matching → одна сквозная Communication-история), диалоговый inbox оператора (3 колонки), ручное разрешение AMBIGUOUS, suppression-gate на отправке, RBAC/audit, тесты, gate-документы.
- **Вне scope M3 (§31, не делалось):** media/Cloud API (заглушки `[image]`/SKIPPED), notification-доставка, retention-джобы, авто-создание User/BUYER перед бронированием (закреплено как A-29 — реализация в следующих модулях).

## 1. HEAD и изменённые файлы

HEAD `28c4dcd`. Изменения M3 в working tree:

**Создано:**
- `backend/prisma/migrations/20261002150000_whatsapp_m3_inbound_conversations/`
- `backend/src/integrations/whatsapp/inbound/inbound.service.ts` (+ `inbound.service.spec.ts`)
- `backend/src/integrations/whatsapp/conversations/conversations.service.ts` (+ `conversations.service.spec.ts`)
- `backend/src/integrations/whatsapp/whatsapp-conversations.controller.ts`
- `backend/test/whatsapp-m3.e2e-spec.ts` (12 tests)
- `frontend/app/app/whatsapp/page.tsx` (inbox 3-колонки)
- `frontend/lib/whatsapp.ts` (+ `whatsapp.spec.ts`, `whatsapp-registry.spec.tsx`)
- `docs/prompts/M3_WHATSAPP_INBOUND_CHAT_IMPLEMENTATION_PROMPT.md`, `docs/whatsapp/evidence/m3-*`

**Изменено:**
- `backend/prisma/schema.prisma` — секция WhatsApp: `WhatsAppConversation`, `WhatsAppInboundMessage`, `WhatsAppMatchingStatus`, `WhatsAppInboundProcessingStatus`, `WhatsAppOutboundMessage.conversationId`
- `backend/src/integrations/whatsapp/outbound/outbound.service.ts` (+spec) — suppression-gate (409 + audit), `resolveRecipient` (customerId XOR phone), привязка outbound к conversation
- `backend/src/integrations/whatsapp/provider/baileys/baileys-provider.ts` (+spec) — `fromMe`-сообщения эмитируются в inbound-pipeline (OUTBOUND + `sentOutsideTravelHub`, без дубля Communication)
- `backend/src/integrations/whatsapp/session/session-runtime.service.ts` (+spec) — **фикс `AuditLog_userId_fkey`** auto-connect (см. §11)
- `backend/src/integrations/whatsapp/whatsapp.module.ts` — регистрация inbound/conversations сервисов и контроллера
- `frontend/lib/i18n.tsx` — блок `whatsapp.*` (ru/az/en), `nav.whatsapp`; `frontend/components/Shell.tsx` — пункт «WhatsApp» (`whatsapp.read`)

## 2. Prisma migrations и schema changes

- Миграция `20261002150000_whatsapp_m3_inbound_conversations` (idempotent SQL): enum `WhatsAppMatchingStatus = UNMATCHED, MATCHED, AMBIGUOUS`, enum `WhatsAppInboundProcessingStatus = RECEIVED, PROCESSED, SKIPPED, FAILED`, таблица `whatsapp.WhatsAppInboundMessage` с unique `(accountId, providerMessageId)`, таблица `whatsapp.WhatsAppConversation` с unique `(accountId, remoteJid)` + индексы `matchingStatus/customerId/canonicalPhone`, колонка `WhatsAppOutboundMessage.conversationId`.
- Применена на **dev-БД** (`prisma migrate deploy`) и на **чистой gate-БД** `travelhub_m3_diag`:
  ```
  npx prisma migrate deploy   →  All migrations have been successfully applied (105 total,
                                 последняя — 20261002150000_whatsapp_m3_inbound_conversations)
  ```
- Аудиторские FK не ослаблялись: `AuditLog.userId` остался `String?` с `references [id]` (см. §11 — правился источник данных, а не модель).

## 3. API endpoints

| Endpoint | Права | Назначение |
|---|---|---|
| `GET /whatsapp/conversations?limit&matchingStatus` | `whatsapp.read` | список диалогов (unread, preview, badge) |
| `GET /whatsapp/conversations/:id` | `whatsapp.read` | customer / candidates / context / suppressed |
| `GET /whatsapp/conversations/:id/messages` | `whatsapp.read` | единая история (INBOUND+OUTBOUND) |
| `POST /whatsapp/conversations/:id/customer` {customerId} | `whatsapp.manage` | manual link → MATCHED + backfill context + audit |
| `POST /whatsapp/conversations/:id/read` | `whatsapp.read` | markRead (unread=0) |
| `GET /whatsapp/customer-search?search=` | `whatsapp.manage` | поиск Customer по телефону/имени/компании/email (A-31) |
| `POST /whatsapp/messages` (M2, не менялся контракт) | `whatsapp.send` | отправка: customerId XOR phone + `conversationId` + Idempotency-Key |

## 4. Inbound architecture

```
provider (baileys/mock) events
  → WhatsAppInboundService.processInbound
      1. dedup: unique (accountId, providerMessageId) → повтор = без записи (concurrency-тест)
      2. fromMe=true → OUTBOUND + sentOutsideTravelHub (echo-строка; в таймлайне не дублирует Communication)
      3. phone normalization (read-only, E.164) → canonicalPhone
      4. suppression (STOP/СТОП/UNSUBSCRIBE) → audit whatsapp.suppression.added, suppressed=true
      5. matching: 0 → UNMATCHED / 1 → MATCHED / >1 → AMBIGUOUS (candidates)
      6. одна Communication (CML-…) на сообщение; context = Customer (или null)
      7. WhatsAppConversation: lastMessageAt/Preview, unread++, processingStatus=PROCESSED
```
Без изменений M2-контракта: outbound/idempotency/lease/fencing/Recover не тронуты.

## 5. Matching logic

- Сильный идентификатор — нормализованный телефон (`canonicalPhone`, `findCustomerIdsByCanonicalPhone`); дубли номера → >1 → **AMBIGUOUS, авто-merge запрещён** (A-29).
- `customer-search`: текстовый OR по code/firstName/lastName/companyName/email (case-insensitive) + канонический телефон, дедупликация, limit 10.
- Manual resolution: `POST …/customer` → `MATCHED`, `matchedAt`, audit `whatsapp.customer_linked`, прошлые `contextType=null` Communication → `CUSTOMER`.

## 6. Communication linkage

- **Communication — единственная история.** WhatsApp-сообщения ссылаются на неё по `communicationId` (ref без FK — ADR-0001); дублирование отдельной «WhatsApp-истории» не создаётся.
- Отправленное оператором — та же `Communication` (OUTBOUND, delivery-state из M2: `sentAt/deliveredAt/readAt`), inbound-echo его не удваивает (e2e №7).
- Ручная привязка клиента историю не переписывает — только резолвит context.

## 7. Request→Order→Booking continuity

Context резолвится **read-time** из Customer (priority: ACTIVE Booking → Order → Request → Customer), терминальные состояния исключаются:
- Order: `CLOSED, CANCELLED`
- Booking: `COMPLETED, CANCELLED, SUPPLIER_REJECTED`
- Request: `CONVERTED, REJECTED, UNAVAILABLE, EXPIRED, CANCELLED_BY_CUSTOMER, CUSTOMER_PAYMENT_TIMEOUT` (+ `convertedOrderId: null`)

Доказательство — e2e №11 (§29): одна история через Request→Order→Booking→Customer, контекст §13 на лету.

## 8. Тесты (unit)

```
npx tsc --noEmit                     → EXIT=0 (0 errors)
npx jest --runInBand                 → Test Suites: 129 passed / 129 total
                                       Tests:       2051 passed / 2051 total   (80.6s)
   к M2 (126 / 2025): +3 suites / +26 tests — inbound.service.spec,
   conversations.service.spec, outbox-worker.service.spec (lifecycle Issue 2),
   regression auto-connect audit
npx jest src/integrations/whatsapp   → 15 suites / 162 tests PASS (22.9s)
```
Frontend:
```
npx tsc --noEmit                     → EXIT=0 (0 errors)
npx vitest run                       → 53 files / 932 tests PASS (27.7s)
   whatsapp.spec (5) + whatsapp-registry.spec (5, включая t() ×3 локали)
```

## 9. e2e результаты

```
npx jest --config ./test/jest-e2e.json whatsapp-m3 --runInBand
   → Test Suites: 1 passed / Tests: 12 passed, exit=0 (17.2s)
npx jest --config ./test/jest-e2e.json whatsapp-m2 rbac-parity --runInBand
   → Test Suites: 2 passed / Tests: 26 passed, exit=0 (38.6s)
```
M3: (1) RBAC 401/403/200 по всем 7 endpoints; (2) inbound→UNMATCHED+unread+markRead; (3) последовательный дубль; (4) **конкурентный дубль (7 параллельных → ровно 1 запись)**; (5) MATCHED+AUTO-контакт; (6) AMBIGUOUS+candidates+customer-search+link+audit §24; (7) echo без дубля истории; (8) fromMe → OUTBOUND+sentOutsideTravelHub; (9) media → SKIPPED `[image]`; (10) send/404/422/suppression; (11) **§29 непрерывность Request→Order→Booking**; (12) STOP → suppression → send 409 + audit.
RBAC-parity: точное соответствие прав (OPERATOR 50/50 и т.д.) — дрейфа нет.

Известные pre-existing падения вне scope M3 (не чинились, чужой контракт): `product-scope`, `external-idempotency-contract` (403); полный e2e-набор не гоняется целиком (OOM — pre-existing).

## 10. Качество (Quality DoD)

| Проверка | Результат |
|---|---|
| `npx tsc --noEmit` backend | PASS (0) |
| `npx jest --runInBand` | PASS 129/2051 (включая outbox-worker lifecycle spec) |
| whatsapp-контур `npx jest src/integrations/whatsapp` | PASS 15/162 |
| e2e M3 + M2 + rbac-parity | PASS 12 + 26 (exit=0) |
| frontend `tsc` + `vitest` | PASS (0) + 53/932 |
| ESLint | не запускается (запрет владельца) |
| `npm audit` | pre-existing: backend 12 (3 moderate/9 high), frontend 3 (2 high/1 critical) — **новых зависимостей M3 нет**, фиксы требуют breaking-upgrade (next 16.3.8, prisma 7.x) — чистка baseline отдельной задачей (A-24) |

## 11. Live smoke §30/§34 + фикс `AuditLog_userId_fkey`

### 11.1 Диагностика FK (блокер снятия)

Ошибку приписывали `SecurityService.seedRoles()`. **Диагностика показала обратное:**
1. `seedRoles()` (`security.service.ts:50-74`) не вызывает `audit()` вообще — только `role.upsert`/`permission.createMany`; в `PrismaService` нет `$extends`/middleware, SQL-триггеров на `AuditLog` нет → FK из `role.upsert` невозможен.
2. Реальный источник — `session-runtime.service.ts:94`: auto-connect вызывал `connect({ id: "system", username: "system" })`, audit писал `userId="system"` → **нет такой User-строки → `AuditLog_userId_fkey`** (лог ловился в `.catch`, при этом `whatsapp.connected` терялся — в dev-БД таких строк было **0** за всю историю).
3. Воспроизведено на **чистой БД** `travelhub_m3_diag` (создана с нуля, `migrate deploy`, seed одним инстансом — конфликт второго экземпляра исключён): `docs/whatsapp/evidence/m3-fk-prefix-cleandb-seed.txt` — `auto-connect failed … AuditLog_userId_fkey`; при этом seedRoles+seedAdmin на чистой БД успели (roles=10, users=1, audits=0 — в логе ошибки нет). На dev-БД та же ошибка в `m3-fk-prefix-backend-errlog.txt`.

### 11.2 Исправление (без фиктивных данных, без ослабления модели)

- `ActorAuditRef.id: string | null`; auto-connect → `{ id: null, username: "system" }` — `AuditLog.userId` остаётся NULL (системный актор, как уже принято в inbound-suppression audit и ledger SYSTEM-акторе). Модель аудита и FK **не изменялись**, фиктивный User не создавался.
- Regression-тест `session-runtime.service.spec.ts`: «autoConnect bootstrap: системный актор аудируется с userId=null (без FK AuditLog)» — 11/11 PASS.
- Проверка после фикса: чистая БД (`m3-fk-postfix-cleandb-seed.txt`) — **0 ошибок**, seed OK; перезапуск dev backend — `dev-server.err.log` **0 байт**; в БД появилась строка `whatsapp.connected | userId=null | username=system` (`m3-seed-realdb-postfix.txt` + SQL-выборка).

### 11.3 Сценарий (реальный dev-стек: backend :4000 + frontend :3000, mock provider)

Одиночный seed (backend остановлен — без второго инстанса) → `SEED RESULT: AMBIGUOUS/PROCESSED`. Далее UI-smoke:

1. `/app/whatsapp`: диалог `+994507000000`, badge «Несколько клиентов», **unread=1**, preview inbound → `m3-ui-01-inbox-list.png`.
2. Открытие диалога → markRead (unread→0), правая колонка: «Нет привязанного клиента» + **КАНДИДАТЫ (2)** «Иван Петров / CUS-00000001» и «…/CUS-00000002» (один телефон, одинаковое ФИО — A-29: авто-merge запрещён, ручной выбор) → `m3-ui-02-ambiguous-candidates.png`.
3. «Привязать» → `MATCHED`, badge «Клиент привязан», context `CUSTOMER/CUS-00000001` → `m3-ui-03-matched-customer.png`.
4. Ответ оператора → bubble «Отправлено» + `CML-00000301` → `m3-ui-04-sent-reply.png`.

API-верификация после smoke:
```
list:    match=MATCHED unread=0
detail:  customer=CUS-00000001 context=CUSTOMER/CUS-00000001 candidates=0 suppressed=false
timeline: INBOUND  []      CML-00000201
          OUTBOUND [SENT]  CML-00000301     ← одна история, история не копируется
audit:    whatsapp.customer_linked (admin), whatsapp.send ×2 (admin), whatsapp.connected (system, userId=null)
```
**Evidence-комплект §30/§34:** `m3-ui-01-inbox-list.png` (inbox) → `m3-ui-02-ambiguous-candidates.png` (AMBIGUOUS + 2 candidates) → `m3-ui-03-matched-customer.png` (link → MATCHED, customer/context) → `m3-ui-04-sent-reply.png` (outbound SENT) → `m3-ui-05-chain-api-verification.txt` (полный API/DB-снимок той же цепочки: list/detail/messages/customer-search + аудит-цепочка, 2026-10-03T09:53Z).

### 11.4 §34 — бизнес-доказательство

```
WhatsApp (inbound +994507000000)
   ↓ phone matching → AMBIGUOUS → ручная привязка → Customer (CUS-00000001)
   ↓ context read-time: CUSTOMER (Request/Order/Booking в dev отсутствуют — fallback)
communication history = ONE  (CML-00000201 inbound + CML-00000301 outbound в одном потоке)
```
Цепочка Request→Order→Booking закрыта e2e №11 (§29) на тестовых данных.

## 12. Issue 2: OutboxWorkerService «Transaction not found» — диагностика и фикс

**Симптом:** `ERROR [OutboxWorkerService] outbox worker cycle failed: Transaction API error: Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting` — `docs/whatsapp/evidence/m3-fk-prefix-cleandb-seed.txt:23` (seed-прогон на чистой БД, 03.10.2026 12:14:24).

**Вердикт: самостоятельный lifecycle-баг — НЕ следствие dev-server и НЕ двух экземпляров:**
1. Воспроизведение — **одиночный** seed-прогон (второго инстанса не было). grep по всем логам репо: единственное вхождение — в evidence-файле симптома; в долгоживущем dev-логе `backend_stdout2.log` (тысячи циклов) — **0** таких ошибок: в dev `$disconnect` не выполняется.
2. Семантика текста — **отключение клиента Prisma** («obtained before disconnecting»): `PrismaService.onModuleDestroy` делает `$disconnect`, а воркер останавливался только в `onApplicationShutdown` (более поздний хук Nest) — таймер (interval 500ms / drain-backoff 100ms) успевал выстрелить между хуками и запустить `$transaction` на отключённом клиенте. Дополнительно: `scheduleNext` мог перепланировать цикл уже **после** stop, а `onApplicationShutdown` вызывал `clearInterval` на `setTimeout`-хэндле.
3. Двухинстансовая конкуренция этой ошибки не даёт: транзакцию инвалидирует только собственный клиент `$disconnect`; межинстансовую сериализацию закрывает pg advisory lock (try-lock → `lockAcquired=false`, без исключения) — T-A в `outbox-durable-worker.e2e-spec.ts`.

**Фикс (`src/eventbus/outbox-worker.service.ts`):**
- `shuttingDown` + `inFlight`; `stop()` (await in-flight, `clearTimeout`) — в **`onModuleDestroy`** (тот же хук, где Prisma `$disconnect`) и идемпотентно в `onApplicationShutdown`;
- guard `if (this.shuttingDown) return` в `scheduleNext` — репланировки после stop невозможны;
- классификация disconnect-race (`Transaction not found` / `before disconnecting` / `Client is closed`) как штатной остановки: `log` вместо `error`, без ретрая; реальные сбои БД («Can't reach database server» и т.п.) по-прежнему → `error` + retry;
- 6 unit-тестов `src/eventbus/outbox-worker.service.spec.ts`: lock-пути цикла, stop после bootstrap, идемпотентный двойной stop, race → benign stop, обычная ошибка → retry через интервал.

**До/после (evidence):**
- до: `m3-fk-prefix-cleandb-seed.txt:23` — ERROR «cycle failed: Transaction not found…»;
- после: `m3-outbox-shutdown-postfix.txt` — boot воркера, **5 выполненных циклов**, `SHUTDOWN CLEAN`, **0 ERROR / 0 «cycle failed»**, exit=0 — тот же сценарий boot→close, что в seed-прогоне (`WHATSAPP_AUTO_CONNECT=false`).

Контракт `runCycle()`/`status()` не менялся — targeted-прогоны M2/RBAC/M3 и public API совместимы; открытых действий по Issue 2 не осталось.

## 13. Known limitations

1. Media-входящие: сохраняются как `SKIPPED` + заглушка `[image]` (§31 — Cloud API/media вне M3).
2. Auto-provisioning: WhatsApp-клиент без User/BUYER — правило зафиксировано (A-29), создание User/BUYER + отправка credentials — вне M3 (следующий модуль).
3. `GET /whatsapp/customer-search` вместо CRM `GET /customers` (Marketplace-scoped, total=0) — A-31.
4. Pre-existing: npm audit baseline (A-24), дрейф dev-БД (A-23), падения `product-scope`/`external-idempotency-contract` в полном e2e, OOM полного e2e-прогона, dev-БД содержит 5 legacy-прав сверх `ALL_PERMISSIONS` (175 vs 170).
5. Auto-connect audit пишется `userId=null` (по design, §11.2) — исторических `whatsapp.connected` строк до фикса не существует.

## 14. Manual smoke instructions

```text
1. backend/.env: WHATSAPP_ENABLED=true, WHATSAPP_PROVIDER=mock; npm run dev (backend:4000)
2. frontend: npm run dev (frontend:3000)
3. Инбound-событие: любой способ (e2e-харнесс или вызов processInbound против dev-БД);
   для AMBIGUOUS-демо нужны ≥2 Customer с одним телефоном.
4. Открыть http://localhost:3000/app/whatsapp (login admin/admin123, право whatsapp.read)
5. Проверить: badge «Несколько клиентов» + unread; открыть → markRead; кандидаты → «Привязать»
   → MATCHED + КЛИЕНТ/КОНТЕКСТ; ввести ответ → «Отправлено» (mock SENT)
6. Проверить STOP: отправить inbound «СТОП» → suppressed=true, POST messages → 409 + audit
7. API-проверки: GET conversations/:id (customer/context/candidates), .../messages (INBOUND+OUTBOUND)
```

## Gate

Условие владельца («не считать M3 PASS, пока два backend quality issue не разобраны и финальный rerun не выполнен») — **выполнено**: Issue 1 (AuditLog FK) §11, Issue 2 (OutboxWorker) §12, финальный rerun §8–§10 (tsc 0/0, unit 129/2051, контур 15/162, e2e 12+26 exit=0, vitest 932).

| Gate | Result |
|---|---|
| inbound | PASS (e2e №2, live seed) |
| deduplication | PASS (e2e №3 sequential, №4 concurrent 7→1) |
| customer matching | PASS (e2e №5/#6, live smoke) |
| UNMATCHED | PASS (e2e №2, live seed до привязки) |
| AMBIGUOUS | PASS (e2e №6, live smoke + скриншот m3-ui-02) |
| manual resolution | PASS (e2e №6, live «Привязать» → MATCHED, audit customer_linked) |
| communication continuity | PASS (timeline CML-00000201+CML-00000301, e2e №7/#11) |
| Request→Order continuity | PASS (e2e №11 §29) |
| Order→Booking continuity | PASS (e2e №11 §29) |
| outbound compatibility | PASS (контракт M2 не менялся, whatsapp-m2 e2e 15/15, идемпотентность/Recover) |
| delivery receipts | PASS (M2 sentAt/deliveredAt/readAt, статус «Отправлено» в UI, e2e №10) |
| RBAC | PASS (e2e №1 7×(401/403/200), rbac-parity 11/11, права без дрейфа) |
| audit | PASS (suppression/customer_linked/send/connected incl. фикс FK, §11) |
| frontend chat | PASS (inbox/timeline/customer/context/ссылка/отправка — 4 скриншота + API-снимок m3-ui-05 §11.3) |
| e2e | PASS (M3 12/12 + M2/RBAC 26/26) |
