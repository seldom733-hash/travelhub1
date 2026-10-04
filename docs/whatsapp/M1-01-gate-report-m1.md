# M1-01. Gate Report — M1 «Фундамент» (WhatsApp/Baileys)

- **Дата:** 2026-10-02 · ветка `master`, HEAD `28c4dcd` (коммитов не создавалось — правило «без разрешения не коммитить»).
- **Статус: GATE M1 = PASS.** По правилам мастер-промпта (§8) — **стоп после M1**: отчёт предъявляется владельцу, M2 начинается только после его согласования.
- **Scope M1 выполнен:** схема `whatsapp.*` + миграции, `CommunicationChannel.WHATSAPP`, конфигурация `WHATSAPP_*` с fail-closed, права `whatsapp.*`, нормализация телефона, контракт провайдера, typed errors, state machine, `MockWhatsAppProvider`, contract-тесты, статическая проверка границы Baileys, зависимость Baileys `6.7.24` exact + `npm audit` + CI-шаг, `WhatsAppModule` под флагом `WHATSAPP_ENABLED=false`.
- **В M1 НЕ делалось (по scope):** подключение Baileys, QR, живой WhatsApp, контроллеры/API, outbox/отправка, notification-слой — это M2+.

## 1. Что создано / изменено

**Новое:**
- `backend/prisma/migrations/20261002120000_whatsapp_foundation_m1/` — схема, 3 enum, `WHATSAPP` в `CommunicationChannel`, 6 таблиц, индексы, FK (idempotent).
- `backend/prisma/migrations/20261002130000_whatsapp_permissions/` — 5 Permission-строк + матричные RolePermission-гранты (решение №7) + ADMIN=ALL.
- `backend/prisma/migrations/20260912180000_constructor_foundation_remediation/` — **починка сломанной истории миграций** (A-22, см. §3).
- `backend/src/integrations/whatsapp/`: `whatsapp.config.ts` (+spec), `whatsapp.module.ts` (+spec), `baileys-import-boundary.spec.ts`, `provider/whatsapp-provider.ts` (контракт), `provider/whatsapp-errors.ts` (+spec), `provider/whatsapp-provider.contract.ts` (общий contract suite), `provider/mock/mock-whatsapp.provider.ts` (+spec), `state/connection-state.machine.ts` (+spec).
- `backend/src/shared/phone/phone.ts` (+spec) — E.164-нормализация на `libphonenumber-js`.

**Изменено:**
- `prisma/schema.prisma` — `whatsapp` в `datasource.schemas`, `WHATSAPP` в `CommunicationChannel`, 6 моделей/3 enum.
- `src/security/permissions.constants.ts` — 5 ключей `whatsapp.*` в `PERMISSIONS`; гранты: read — 7 внутренних ролей, send — +SALES_MANAGER/OPERATOR, manage/session.admin — OPERATOR, recover — только ADMIN (`ADMIN: ALL_PERMISSIONS` покрывает его).
- `src/security/security.service.ts` — описания `whatsapp.*` в `PERMISSION_DESCRIPTIONS`.
- `src/app.module.ts` — регистрация `WhatsAppModule`.
- `backend/.env.example` — блок `WHATSAPP_*` (включая throttle-переменные решения №14), без секретов.
- `backend/package.json` — `"@whiskeysockets/baileys": "6.7.24"` (exact), `"libphonenumber-js": "^1.13.14"` (был только transitive).
- `.github/workflows/ci.yml` — шаг `Dependency audit (production, critical)` → `npm audit --omit=dev --audit-level=critical`.

## 2. Gate-доказательства (реальный вывод команд)

### 2.1 Схема и миграции
```
npx prisma validate                     → The schema at prisma\schema.prisma is valid 🚀
npx prisma migrate deploy (dev-БД)      → applied 20261002120000_whatsapp_foundation_m1,
                                               20261002130000_whatsapp_permissions
                                          All migrations have been successfully applied.
npx prisma migrate status               → 103 migrations found … Database schema is up to date!
npx prisma generate                     → Generated Prisma Client (7.9.1)
```

### 2.2 Миграция на ЧИСТОЙ БД (ключевой gate)
```
БД travelhub1_m1clean создана с нуля → npx prisma migrate deploy
  103 migrations found in prisma/migrations
  Applying migration `20260912180000_constructor_foundation_remediation`
  Applying migration `20261002120000_whatsapp_foundation_m1`
  Applying migration `20261002130000_whatsapp_permissions`
  All migrations have been successfully applied.   EXIT=0
```
Проверка содержимого чистой БД (тот же запрос выполнялся и на dev-БД — результаты идентичны):
```
TABLES: constructor.{ConstructorPage, ConstructorPageSection, ConstructorPageVersion, ConstructorPageAuditLog}
        whatsapp.{WhatsAppAccount, WhatsAppContact, WhatsAppInboundMessage,
                  WhatsAppOutboundMessage, WhatsAppSessionLease, WhatsAppSuppression}
CommunicationChannel: "{PLATFORM,WHATSAPP}"
PERMISSIONS: whatsapp.manage, whatsapp.read, whatsapp.send, whatsapp.send.recover, whatsapp.session.admin
GRANTS: ADMIN: все 5 · OPERATOR: read,send,manage,session.admin · SALES_MANAGER: read,send
        DIRECTOR/FINANCE/MARKETER/ANALYST/MODERATOR: read · PARTNER/BUYER: нет
```
(БД удалена после проверки; лог deploy-а сохранён в сессии.)

### 2.3 Typecheck, тесты
```
npm run typecheck (backend)   → EXIT=0
npm test                      → Test Suites: 119 passed / 119 total
                                Tests:       1928 passed / 1928 total   (64.9 s)   EXIT=0
   база до M1: 112 suites / 1879 tests → +7 suites / +49 tests, все зелёные
   новые suites: phone, whatsapp.config, whatsapp.module, connection-state.machine,
                 whatsapp-errors, mock-whatsapp (contract suite 11 + mock), baileys-boundary
e2e rbac-parity (чистая test-БД, migrate deploy в global setup):
   Test Suites: 1 passed · Tests: 11 passed · EXIT=0
   (для всех 10 ролей DB-набор прав ТОЧНО равен ROLE_PERMISSIONS — включая whatsapp.*)
```
Frontend не менялся → typecheck/vitest frontend не затрагивались.

### 2.4 Зависимости (решение №17)
```
package.json: "@whiskeysockets/baileys": "6.7.24"   (exact, без ^/~; издатель WhiskeySockets)
npm audit: 13 vulnerabilities (3 moderate, 10 high) — ВСЕ у существующих зависимостей
           (sharp, exceljs→uuid, prisma, js-yaml, brace-expansion, fast-uri, qs);
           у Baileys/его дерева — 0 (npm ls подтверждает: readdir-glob, напр., от exceljs)
npm audit --omit=dev --audit-level=critical → EXIT=0  ← добавлено в CI
```

## 3. Найдено по ходу и как решено
1. **Сломанная история миграций (A-22):** ни одна миграция не создавала `constructor.*` → `prisma migrate dev` падал в shadow-БД (P3018), чистый `migrate deploy` (CI) падал бы на `20260913000000`. Добавлена idempotent remediation-миграция `20260912180000` (до `20260913000000`; `ConstructorPage` — в пре-20260913 виде, чтобы последующие ALTER отработали). Прецедент в репо: `20260831220000_security_schema_drift_remediation`.
2. **`CREATE TYPE IF NOT EXISTS` не существует в PostgreSQL** → enum-создания переписаны в `DO $$ … EXCEPTION WHEN duplicate_object` (паттерн уже использовался в репо).
3. **Чужой дрейф dev-БД (A-23):** diff «dev-БД → schema» выявил `DROP catalog.PartnerActiveCategory`, `DROP catalog.RoomView`, `DROP RoomType.aliases`, rename geo-индекса. **Не включено в миграции** (чужой scope, риск потери данных) — решение за владельцем.
4. **`npm install` allow-scripts (A-25):** install-скрипты baileys/protobufjs остаются pending; в M1 безопасно (boundary-тест гарантирует отсутствие импортов Baileys вне `provider/baileys/`).
5. **`recipientPhone` в outbound (A-26):** добавлен сверх черновика M0-02 — без него невозможны проверки D9-suppression/D10-throttle; подтверждается владельцем.

## 4. Обновления документов
- `M0-03 Assumptions Register`: **все вопросы §10 закрыты 17 решениями владельца** (добавлена таблица соответствия) + новые **A-22…A-27**.
- `backend/.env.example`: полный блок `WHATSAPP_*` (§6.3 + throttle №14), без секретов.
- CI: аудит зависимостей (critical-порог) — закрывает обязательство №17.

## 5. Решение по Gate
**M1 PASS.** Все четыре обязательных доказательства собраны: миграция на чистой БД ✅, typecheck ✅, юнит/контрактные тесты ✅ (119/119, 1928/1928), существующая матрица + e2e rbac-parity ✅ (11/11).

**Дальше — только с разрешения владельца: M2** (провайдер Baileys: AuthState с шифрованием, lease/fencing, контроллер §6.4, QR-endpoint, `IDEMPOTENT_OPERATIONS: "whatsapp.send"`, подключение mock/baileys по конфигу).
