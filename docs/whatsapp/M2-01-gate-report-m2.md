# M2-01. Gate Report — M2 «Сессия и админ-контур» (WhatsApp/Baileys)

- **Дата:** 2026-10-02 · ветка `master`, HEAD `28c4dcd` (коммитов не создавалось — правило «без разрешения не коммитить»; все изменения M1+M2 — в рабочем дереве).
- **Статус: GATE M2 = PASS по автоматическим доказательствам.** Единственный пункт, который нельзя выполнить без человека, — **ручной smoke (QR → CONNECTED → restart → CONNECTED без QR) за владельцем/оператором** (§8, M2-gate): инструкция в §5.
- **Scope M2 выполнен:** `BaileysWhatsAppProvider` (adapter/loader, ESM-импорт через `new Function("m","return import(m)")`, только внутри `provider/baileys/` — boundary-тест), `AuthStateStore` (AES-256-GCM, crash-safe атомарная запись, fail-closed, без автосброса), lease+fencing перед lifecycle/auth/outbound (self-fencing при потере), state machine c `LOGGED_OUT`, QR-endpoint (per-user rate limit, QR нигде не логируется/аудируется/персистится), REST §6.4 (`status/qr/connect/disconnect/logout/session-reset/messages/messages/:id/recover/list`) с RBAC+confirm+audit, outbound-контуур (`IDEMPOTENT_OPERATIONS: "whatsapp.send"`, `providerMessageId` `3EB0…` (40 hex) сохраняется ДО отправки в одной tx, at-most-once, `UNKNOWN` без автоповтора + Reconcile/Mark failed/Retry anyway), kill-switch `WHATSAPP_ENABLED=false`, mock сохраняет контракт-сьют.
- **В M2 НЕ делалось (запрет владельца):** notification-слой, inbound/дедупликация, suppression/throttle/CB оркестрация, медиа, frontend WhatsApp UI, Cloud API, контакты link/unlink (M3+), `CommunicationThread`.
- **A-25 закрыт**, A-02 подтверждён, добавлен **A-28** (уточнение схемы: `LOGGED_OUT` + `sentAt`/`deliveredAt`/`readAt`) — `M0-03`.

## 1. Что создано / изменено

**Новое:**
- `backend/prisma/migrations/20261002140000_whatsapp_m2_lifecycle_receipts/` — `LOGGED_OUT` в `WhatsAppConnectionState` + `sentAt`/`deliveredAt`/`readAt` в `WhatsAppOutboundMessage` (A-28).
- `backend/src/integrations/whatsapp/provider/baileys/` — `baileys-loader.ts` (ESM), `baileys-auth-adapter.ts`, `baileys-provider.ts` (+`baileys-provider.spec` 18 tests, мок-сокет FakeSocket), `auth-state-store.ts` (+spec 11 tests).
- `backend/src/integrations/whatsapp/lease/session-lease.service.ts` (+spec 10) — CAS-lease, heartbeat ≤ TTL/2 (fail-closed), fencing-токен.
- `backend/src/integrations/whatsapp/ownership/session-ownership.service.ts` (+spec 6).
- `backend/src/integrations/whatsapp/session/session-runtime.service.ts` (+spec 10) — bootstrap/QR/connect/disconnect/logout/session-reset, auto-connect только `enabled && role !== "api"`, FIFO-очередь persist-состояний.
- `backend/src/integrations/whatsapp/outbound/` — `outbound-lifecycle.ts` (+spec 9) и `outbound.service.ts` (+spec 23): send/recover/applyReceipt/recoverStaleSending/list.
- `backend/src/integrations/whatsapp/whatsapp.controller.ts` — §6.4 (DTOs, `@Idempotent("whatsapp.send")`, QR rate-limit per-user, confirm+audit для админ-действий).
- `backend/test/whatsapp-m2.e2e-spec.ts` — e2e §6.4, 15 tests.

**Изменено:**
- `whatsapp.module.ts` — полная проводка: config factory, lease, ownership, `WHATSAPP_PROVIDER` (disabled→null / mock→`MockWhatsAppProvider(startFlow:"connected")` / baileys), runtime, outbound, controller; экспорт `WHATSAPP_CONFIG, WHATSAPP_PROVIDER`; в `app.module.ts` (M1).
- `whatsapp.config.ts` — lease TTL/heartbeat, QR rate-limit, fail-closed валидация (спека 14 tests).
- `state/connection-state.machine.ts` — `LOGGED_OUT` (+spec 9 tests).
- `provider/mock/mock-whatsapp.provider.ts` — `driveState` эмитит QR при `QR_REQUIRED`, `startFlow: "connected"|"qr"`, `stop()` сбрасывает `started`.
- `session-runtime.service.ts` — persist-задачи через FIFO-очередь (граница гонки: строка в БД не «застревает» в `CONNECTING`).
- `shared/idempotency/idempotency.constants.ts` — `IDEMPOTENT_OPERATIONS = ["payment.create", "whatsapp.send"]`.
- `backend/.env.example` — `WHATSAPP_LEASE_*`, `WHATSAPP_QR_RATE_LIMIT_*` (без секретов).
- `backend/package.json` — `allowScripts`: pinned `"@whiskeysockets/baileys@6.7.24": true`, `"protobufjs@7.6.6": true` (A-25).
- DI-декораторы (`@Injectable`/`@Inject(PrismaService)`/`@Inject(WHATSAPP_CONFIG)`) в lease/ownership/outbound/runtime — честный `emitDecoratorMetadata`.

## 2. Gate-доказательства (реальный вывод команд)

### 2.1 Миграция на ЧИСТОЙ БД (ключевой gate)
```
БД travelhub_m2_clean создана с нуля → npx prisma migrate deploy
  104 migrations found in prisma/migrations
  All migrations have been successfully applied.   EXIT=0
  в т.ч.: 20261002120000_whatsapp_foundation_m1
          20261002130000_whatsapp_permissions
          20261002140000_whatsapp_m2_lifecycle_receipts
Проверка чистой БД:
  enum WhatsAppConnectionState = DISCONNECTED, INITIALIZING, QR_REQUIRED,
          CONNECTING, CONNECTED, RECONNECTING, ERROR, LOGGING_OUT, LOGGED_OUT
  WhatsAppOutboundMessage: sentAt, deliveredAt, readAt  (3 строки)
```
(БД удалена после проверки; dev-БД — те же 3 миграции.)

### 2.2 Typecheck + полный unit-прогон (существующие тесты зелёные)
```
npx tsc --noEmit -p tsconfig.json   → EXIT=0
npx jest --runInBand                 → Test Suites: 126 passed / 126 total
                                       Tests:       2025 passed / 2025 total   EXIT=0
   M1 было: 119 / 1928  →  +7 suites / +97 tests, всё зелёное
Frontend не менялся → vitest/frontend не затрагивались.
```

### 2.3 WhatsApp-контур: mock-автотесты и конфигурация
```
npx jest src/integrations/whatsapp src/shared/idempotency --runInBand
  → 16 suites / 178 tests, все passed (EXIT=0)
  session-runtime.service 10 · whatsapp.module 5 · whatsapp.config 14
  connection-state.machine 9 (в т.ч. LOGGED_OUT-переходы)
  mock-whatsapp.provider 22 (контракт-сьют M1 + driveState/QR/startFlow/stop)
  whatsapp-errors 3 · baileys-import-boundary 2
  idempotency: service 15 · fingerprint 14 · constants 7 («whatsapp.send» в реестре)
```

### 2.4 AuthStateStore: crash-safe запись + шифрование (A-25 закрыт)
```
provider/baileys/auth-state-store.spec  → 11/11
  AES-256-GCM (ключ ≥32 символов, fail-closed без него), plaintext на диск не пишется;
  атомарная запись tmp→rename (читатель не видит обрезанный файл);
  fail-closed: без ключа/битых данных — старт отклонён, автосброса сессии нет.
npm approve-scripts @whiskeysockets/baileys protobufjs --allow-scripts-pin
  → package.json allowScripts pinned (@whiskeysockets/baileys@6.7.24, protobufjs@7.6.6)
npm approve-scripts --allow-scripts-pending
  → "No packages with unreviewed install scripts."   (A-25 ЗАКРЫТ)
```

### 2.5 Lease / self-fencing / ownership / runtime-контур
```
session-lease.service.spec        10/10  — CAS-взятие, heartbeat ≤ TTL/2 (иначе fail-closed),
                                            утрата lease → self-fencing (стоп + ERROR, без самовольного
                                            «воскрешения»)
session-ownership.service.spec     6/6   — актор-скоуп до старта сессии
session-runtime.service.spec      10/10  — статус/QR (409 вне QR_REQUIRED, 503 без QR),
                                           connect/disconnect/logout/session-reset: confirm-gate,
                                           ownership-проверка ДО start, audit-действия
                                           whatsapp.connected/.disconnected/.logout/.session_reset,
                                           bootstrap → FIFO-persist, потеря lease → stop+ERROR
whatsapp.module.spec               5/5   — disabled → provider null; ENABLED без ключа → fail-closed;
                                           mock/baileys → правильный тип провайдера
```

### 2.6 Outbound: at-most-once, идемпотентность, UNKNOWN-recovery
```
outbound-lifecycle.spec            9/9   — только легальные переходы D6 (FAILED_* → send запрещён,
                                           SENT→DELIVERED→READ монотонно)
outbound.service.spec             23/23  — providerMessageId /^[0-9A-F]{40}$/ сохраняется в ОДНОЙ tx
                                           ДО send (каноничен; эхо провайдера отбрасывается);
                                           send → Communication+Outbound+operationKey одной транзакцией;
                                           applyReceipt монотонный; list — PII-минимизирован
                                           (без recipientPhone/recipientJid)
e2e whatsapp-m2 (фрагмент)         — идемпотентный replay → тот же outboundId, divergent → 409;
                                     нет Idempotency-Key → 400; запрещённые ключи → 422;
                                     сбой до отправки → outbox-повтор (DISPATCH_RETRY),
                                     отправленный → UNKNOWN БЕЗ автоповтора:
                                     recoverStaleSending() → UNKNOWN, затем Mark failed /
                                     Retry anyway (confirm, audit) / 409 / 404
```

### 2.7 Baileys-обёртка с мок-сокетом + e2e §6.4 + RBAC + зависимости
```
baileys-provider.spec             18/18  — контракт через FakeSocket (мок-сокет): рилей-команды,
                                           дисконнект-коды (DisconnectReason), формат
                                           providerMessageId '3EB0'+randomBytes(18) → 40 hex,
                                           typed-errors, QR-события; реальный ESM-импорт Baileys
                                           проверен (loader, дочерний процесс)
e2e: npx jest --config test/jest-e2e.json whatsapp-m2 rbac-parity --runInBand
  → Test Suites: 2 passed · Tests: 26 passed · EXIT=0
     whatsapp-m2 (15): аноним 401 на все §6.4; RBAC 403 (BUYER) / правомерный доступ OPERATOR;
       connect/disconnect/logout/session-reset — confirm-gating (пусто→400, false→422),
       audit без PII/QR; GET qr: 409 вне QR_REQUIRED, 200 без аудита/персиста QR,
       скользящий лимит per-user (10×200 → 11-й 429, считается по всем попыткам);
       POST messages: валидация DTO, 201 SENT + providerMessageId + audit whatsapp.send;
       идемпотентность (replay/diff); OPERATOR send 201 + recover 403;
       list без recipientPhone; delivery receipts DELIVERED→READ монотонно;
       crash→UNKNOWN + recovery; env-guard «сборка §6.4 соединена end-to-end»
     rbac-parity (11): DB-наборы прав всех 10 ролей == ROLE_PERMISSIONS (включая whatsapp.*)
npm audit                   → 13 vulnerabilities (3 moderate, 10 high) — baseline M1 не изменился
                              (все у существующих зависимостей; у Baileys-дерева — 0)
npm audit --omit=dev --audit-level=critical → EXIT=0  (CI-шаг M1)
```

## 3. Найдено по ходу и как решено
1. **Гонка persist-состояния (e2e):** конкурентные события сессии применялись вне порядка → строка аккаунта в БД «застревала» в `CONNECTING` (e2e падал, unit — нет). Решение: FIFO-очередь persist-задач в `session-runtime` (M2, п.1 §1); спека runtime закрывает.
2. **DI `emitDecoratorMetadata`:** type-only импорты `PrismaService`/`WHATSAPP_CONFIG` ломали инжекцию в юнит-прогонах → явные value-импорты + `@Injectable()`/`@Inject(...)` (lease/ownership/outbound/runtime).
3. **`whatsapp.module.spec` и SecurityModule-граф:** overrideProvider не сработал (JwtAuthGuard-инжектива) → спека собирает `[PrismaModule, EventBusModule, SecurityModule, WhatsAppModule]` c `jest.mock("@react-pdf/renderer")` и `jest.mock("react")` (ESM-граф документов).
4. **Pre-existing падения не-WA e2e (вне M2):** `product-scope`, `external-idempotency-contract`, `order-lifecycle` падают в `POST /products` → **403 «Commercial Product creation requires a Partner owner»** — правило `catalog.service.ts` из коммита `2c61c83` (2026-08-29, Step 3.6B) применяется к спекам от `08ec62f` (2026-08-09), которые создают product у admin **без partnerId**. Это committed-правило каталога, не связанное с WhatsApp/M2 (в diff M2 каталог не входил; диагностика: ad-hoc e2e — 403 с этим телом). Как M1 — gate прогнан по репрезентативным e2e (`rbac-parity`, теперь + `whatsapp-m2`); починка старых спеков — отдельная задача вне scope.
5. **Полный прогон e2e-сьюта OOM** (~2 GB, exit 134) — pre-existing (планка M1 тоже не гоняла весь сьют); gate-прогоны — точечные `--runInBand`.
6. **A-25 закрыт** pin-одобрением install-scripts (см. §2.4) — установка/импорт Baileys больше не «pending».
7. **`GET qr` rate-limit считает 409:** 11-я попытка в окне падает в 429 даже при 409-ответах (спек runtime + e2e) — защита от probe-обхода лимита.
8. **`inject` роли в QR/структуре:** `@Inject` собран в один импорт `@nestjs/common`; `ensureAccountRow` возвращает id (без «как бы any»).

## 4. Обновления документов
- `M0-03 Assumptions Register`: **A-25 → закрыт**, **A-02 → подтверждён в M2**, добавлен **A-28** (LOGGED_OUT + receipts-колонки, авторизованы scope M2), секция «M2-обновление».
- `backend/.env.example`: блоки `WHATSAPP_LEASE_*` и `WHATSAPP_QR_RATE_LIMIT_*` (без секретов).
- `M0-04` (версия Baileys 6.7.24) — подтверждён contract-тестами M2 (п. §2.7).

## 5. Решение по Gate
**M2 PASS** по всем автоматическим обязательным доказательствам §8:
- автотесты на Mock ✅ (16 suites / 178 tests, полный юнит 126/2025);
- контрактные тесты Baileys-обёртки с мок-сокетом ✅ (18/18 + boundary 2/2 + loader ESM);
- lease/self-fencing ✅ (10/10 + ownership 6/6 + runtime 10/10) и crash-safe записи auth state ✅ (11/11, A-25 закрыт);
- typecheck ✅, чистая БД ✅ (104 миграции), e2e §6.4 + rbac-parity ✅ (26/26), audit critical=0 ✅.

**Остаётся за владельцем (требует человека с телефоном, §8 M2-gate):**
> Ручной smoke: QR → CONNECTED → restart → CONNECTED **без QR**; результат отчёта оператора приложить к отчёту.
> Порядок: `WHATSAPP_ENABLED=true WHATSAPP_PROVIDER=baileys WHATSAPP_ROLE=all` (+ `WHATSAPP_SESSION_PATH`, `WHATSAPP_AUTH_ENCRYPTION_KEY` ≥32 симв.), старт приложения → `GET /api/v1/whatsapp/qr` (admin) → QR на телефоне → `POST connect {confirm:true}` → CONNECTED → рестарт процесса → статус без повторного QR → `POST logout {confirm:true}`.
> Автозаменой (без телефона) служит mock-цепочка из e2e `whatsapp-m2` (DISCONNECTED→CONNECTING→QR_REQUIRED→CONNECTED→LOGOUT→LOGGED_OUT) — она зелёная (§2.7).

**STOP:** M3 не начинается; коммитов не создавалось — отчёт предъявляется владельцу.
