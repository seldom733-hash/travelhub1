# M0. GATE REPORT — Аудит и проектирование WhatsApp (Baileys)

Статус: **M0 завершён. Код не менялся (по определению M0). Остановка — ждём подтверждения
решений и ответов на §10 (§R4, §8 «Gate M0: остановка»).**

Дата: 2026-10-02 · Репо `D:\travelhub_v1` · ветка `master` · HEAD `28c4dcd`

## 1. Что сделано (артефакты — пути файлов)

| # | Артефакт (§8 M0) | Файл |
|---|---|---|
| 1 | Dependency map + **реально существующие** события | `docs/whatsapp/M0-01-dependency-map-and-events.md` |
| 2 | ADR по D1–D11 (+D12) и модели данных | `docs/whatsapp/M0-02-adr-whatsapp.md` |
| 3 | Assumptions Register | `docs/whatsapp/M0-03-assumptions-register.md` |
| 4 | Версия Baileys: Node/TS/ESM-CJS, официальный пакет/издатель, pinned, message id, LID | `docs/whatsapp/M0-04-baileys-version-verification.md` |
| 5 | Решение по нейтральному статусу Communication до отправки (D6) | `docs/whatsapp/M0-05-communication-status-decision.md` |
| — | Этот Gate Report | `docs/whatsapp/M0-06-gate-report-m0.md` |

Все артефакты — **новые** файлы (`docs/whatsapp/` не существовал); существующий код и
документы не редактировались (R5).

## 2. Что проверено (инспекция, R1)

`backend/src/app.module.ts`, `backend/src/main.ts`; `eventbus/{eventbus.service.ts,
domain-events.ts, outbox-worker.service.ts}`; `modules/communication/{controller,service,module}`; `prisma/schema.prisma` (Communication/Thread/Customer/enums, datasource schemas, generator); `security/{permissions.constants.ts, security.service.ts, auth/*}`; `shared/idempotency/*`; `shared/request-context.middleware.ts`, `shared/cors.ts`;
`modules/{booking,order,finance,crm,catalog,sales}/*.{service,subscribers,consumer}.ts`;
`backend/{package.json,tsconfig.json,.env.example}`; `docker-compose.yml`;
`.github/workflows/ci.yml`; `docs/adr/ADR-0001…0015` (границы доменов — ADR-0001);
`frontend/{lib/routes.ts, lib/use-can.ts, lib/i18n.tsx, lib/api.ts,
components/OperationsCenterShell.tsx, app/**/page.tsx}`;
`docs/prompts/TRAVELHUB_WHATSAPP_MASTER_PROMPT_v2_3_FINAL.md` (прочитан целиком).
Baileys: `npm view` (registry), `npm pack @whiskeysockets/baileys@6.7.24` (362 файла,
прочитаны `package.json`, `engine-requirements.js`, `lib/Types/*`, `lib/Socket/*`,
`lib/WABinary/jid-utils.*`, `lib/Utils/generics.js`), advisory: NVD/GitLab/GitHub
(CVE-2026-48063 / GHSA-qvv5-jq5g-4cgg), OSV (MAL-2026-17359/17341, «PhantomSub»).

## 3. Выводы команд (фактический вывод, R3)

```text
> backend: npm run typecheck            (tsc --noEmit)
EXIT=0

> frontend: node_modules\.bin\tsc.cmd --noEmit
EXIT=0

> backend: npm test                     (jest --runInBand)
Test Suites: 112 passed, 112 total
Tests:       1879 passed, 1879 total
Time:        96.023 s
BACKEND_EXIT=0

> frontend: npx vitest run
Test Files  51 passed (51)
     Tests  922 passed (922)
FRONTEND_EXIT=0

> миграции: не применялись — M0 без изменений кода/схемы (нет новых файлов миграции)
```

## 4. Ключевые выводы аудита (кратко)

1. **Notification/i18n-слоя в backend нет** (grep → 0) → M4 создаётся минимальный
   channel-agnostic слой рядом с `communication/` (§4.1). Media storage **есть** (S3/MinIO).
2. **`CommunicationChannel = {PLATFORM}`** → M1 добавляет ровно `WHATSAPP`;
   **`CommunicationStatus = {ACTIVE, ARCHIVED}`** — нейтрального pre-send статуса нет →
   решение: lifecycle только в `whatsapp.*`, `Communication` = `ACTIVE` до отправки (M0-05).
3. **Событий 32**, закрытый реестр; все 8 D11-шаблонов существуют и эмитятся через `emit`
   (доставимы). **5 записей через `emitResult` = PUBLISHED → подписчикам не доставляются**
   (`BookingCreated`, `CommissionAccrued` и др.) — M4 на них не рассчитывать.
4. **`CommunicationThread` — только reverse pre-sale** → не переиспользуем (D5).
5. **`Idempotency-Key` уже реализован** глобально (interceptor + 409 при divergent) →
   для `POST whatsapp/messages` достаточно новой операции в `IDEMPOTENT_OPERATIONS`.
6. **`Customer.phone` сырой** (nullable, без индекса/unique), поля языка нет;
   phone-helper/i18n-backend не существуют.
7. **Отсутствуют (требуют создания):** health-endpoint, SSE/WS (QR → polling),
   Settings/Integrations UI, Dockerfile/docker-сервис (compose = только MinIO),
   notification-слой, `whatsapp.*`-схема в Prisma.
8. **Baileys:** `@whiskeysockets/baileys@6.7.24` (издатель WhiskeySockets, MIT), pinned
   exact; ≥ 6.7.22 → CVE-2026-48063 закрыт; **ESM-only** → dynamic `import()` в адаптере
   (A-02); git-зависимость `libsignal`; **собственный `messageId` поддерживается** →
   `Reconcile` реален; **LID-first** подтверждён (`senderLid/senderPn`), публичного
   резолвера LID→phone нет → unmatched + ручная привязка; вредоносные форки Baileys
   зафиксированы в OSV (100+ клонов) → только пакет издателя проекта.
9. **Права/audit/API/preffix** спроектированы по существующим conventions
   (`permissions.constants.ts`, `@RequirePermissions`, `audit(tx, entry)`, глобальный
   `api/v1`) — см. M0-02.

## 5. Обновлённый Assumptions Register

`docs/whatsapp/M0-03-assumptions-register.md`: `[A-01]…[A-21]`.
Блокирующие до M1 (§10): **A-01, A-04, A-05, A-06, A-07, A-09, A-10, A-11, A-12, A-13,
A-14, A-15** + внешние (без `[A-]`): п.7 (выделенный номер/риск), п.10 (владелец аккаунта),
STOP-keywords (D9), хранилище шаблонов (A-08). Уже решено владельцем: п.13 (провайдер = Baileys).

## 6. Известные ограничения M0

- Ручные smoke H1–H6 (QR-скан, живой телефон) агент выполнить не может — чек-лист в M2/M3.
- Поведение LID и receipts проверялось по типам/исходникам Baileys, не на живом аккаунте.
- `npm audit` по дереву проекта не прогонялся (пакет ещё не установлен) — шаг в M1 + CI.
- Расхождения промпта с кодом зафиксированы как `[A-21]` (код приоритетен, R1):
  заголовок «v2.2» при имени файла `v2_3`; «D1–D11» при существующем D12;
  §3/§6.6/§6.4 упоминают Docker/health/SSE, которых в проекте нет.
- Frontend `npm run lint` не запускается (ESLint не установлен; CI-шага lint нет) —
  по условию задачи пропускается.

## 7. Вопросы владельцу ( Gate-решение, ответить до M1 — §10 )

1. **§10 п.1** — подтвердить размещение минимального notification-слоя рядом с `communication/` (A-01)?
2. **§10 п.2** — язык уведомлений: default `ru`, хранение языка клиента добавить в CRM? (A-05)
3. **§10 п.3** — делать ли backfill `Customer.phone` к E.164? (A-04)
4. **§10 п.4** — `fromMe` записывать OUTBOUND + `sentOutsideTravelHub`? (A-06)
5. **§10 п.5** — opt-out хранить в `whatsapp.*` или в CRM? (A-07)
6. **§10 п.7** — подтвердить: выделенный номер компании и приём риска блокировки.
7. **§10 п.8** — маппинг прав (A-09) и `link/unlink → whatsapp.manage`?
8. **§10 п.9** — retention: metadata 24 мес / media — политика S3? (A-11)
9. **§10 п.10** — кто бизнес-владелец platform WhatsApp-аккаунта?
10. **§10 п.11** — `AMBIGUOUS`: только выбор Customer или также контекст Booking/Order? (A-12)
11. **§10 п.12** — `UNKNOWN` recovery: `Reconcile | Mark failed | Retry anyway`? (A-13)
12. **§10 п.14** — канал алертов (лог + diagnostic; почта/Telegram/…)? (A-15)
13. **D9** — STOP-слова/локализация (не реализовывать до решения).
14. **D10** — значения throttle/CB (A-10).
15. **D11/§10** — хранилище шаблонов: файлы в репо? (A-08)
16. **§10 п.6** — топология: один инстанс + volume в M5, `WHATSAPP_ROLE` в одном образе? (A-14)
17. **D12** — утвердить pinned `@whiskeysockets/baileys@6.7.24` и запрет форков (A-20).

## 8. Что дальше (после подтверждения)

**M1 — Фундамент** (по §8): Prisma-модели `whatsapp.*` + миграция, `WHATSAPP` в
`CommunicationChannel`, конфиг + валидация (fail-closed), permissions, phone-normalization
утилита, контракт `WhatsAppProvider`, `MockWhatsAppProvider`, state machine, typed errors,
contract-тесты — всё под `WHATSAPP_ENABLED=false`; Gate: миграция на чистой БД, typecheck,
unit+contract tests, существующие тесты зелёные.
