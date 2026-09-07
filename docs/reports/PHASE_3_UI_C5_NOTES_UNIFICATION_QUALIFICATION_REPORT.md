# PHASE 3 — UI-C5 — NOTES UNIFICATION — QUALIFICATION REPORT

## 1. Executive Summary

UI-C5 реализован по **OPTION B (UI + MINIMAL BACKEND ENRICHMENT)** — утверждённому
после Audit First scope. Request gap закрыт на обоих уровнях: backend-allowlist
(`VALID_ENTITY_TYPES` + `resolveNoteParent`) расширен сущностью `Request` (без
schema-миграции — `entityType` является String), а Request detail теперь рендерит
канонический shared-компонент `<OperationalNotes entityType="Request">` между
Relations и Audit. i18n не менялся — существующий набор `notes.*` (RU/AZ/EN)
полностью покрывает интеграцию.

**Вердикт: VERDICT A — ACCEPTED** (по static + runtime qualification).

## 2. Baseline

```text
BASELINE: 49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
```

## 3. Implementation SHA

```text
IMPLEMENTATION: 395b01d feat(ui): integrate operational notes into Request detail (UI-C5)
FINAL SHA:      5fcfa8a docs: add UI-C5 notes unification audit + qualification reports
```

## 4. Files Changed

### Modified

| File | Change |
|---|---|
| `backend/src/modules/operational-notes/operational-notes.types.ts` | `VALID_ENTITY_TYPES` + `'Request'`; комментарий списка сущностей дополнен |
| `backend/src/modules/operational-notes/operational-notes.service.ts` | `resolveNoteParent`: case `'Request'` → `prisma.request.findUnique` (совместно с `resolveEntity`-гейтом: несуществующий Request → 404) |
| `backend/prisma/schema.prisma` | Комментарий модели `OperationalNote.entityType`: `Request` добавлен в документированный allowlist |
| `backend/src/modules/operational-notes/operational-notes.service.spec.ts` | Unit: allowlist-assertion включает `Request` как валидный entityType |
| `backend/test/d5-operational-note-audit.e2e-spec.ts` | +6 e2e-тестов: Request notes CRUD (create/list/update/delete), история через audit-трассу, 404 для несуществующего Request, 400 для недопустимого entityType |
| `frontend/app/app/requests/[id]/page.tsx` | WIDE-секция `<OperationalNotes entityType="Request" entityId={id} … />` между Relations (linked order) и Audit (UI-C4); user-гейт как на Order/Booking |

### New

| File | Purpose |
|---|---|
| `frontend/lib/commerce-notes.spec.tsx` | Source-contract spec: Request page рендерит `<OperationalNotes entityType="Request">` ровно один раз, между relations и audit; Order/Booking не регрессировали; используется канонический компонент (дизайн-контракт: без нового компонента); i18n-ключи `notes.*`/`state.loading`/`pagination.*` существуют в RU/AZ/EN |
| `docs/reports/PHASE_3_UI_C5_NOTES_UNIFICATION_AUDIT_REPORT.md` | Audit First отчёт (findings + VERDICT A / OPTION B) |
| `backend/tmp_uic5_runtime_check.py`, `backend/tmp_uic5_probe.py`, `backend/tmp_uic5_shots.py` | Playwright runtime-скрипты (по конвенции репозитория — `backend/tmp_*`) |
| `backend/uic5_shots/*.png` | Скриншоты-evidence: Request notes с созданной заметкой + empty-state после delete |

### Not touched (границы)

Audit (UI-C4, `EntityAuditHistory`), `EntityTimeline`, Communication,
`permissions.constants.ts` (RBAC — переиспользованы существующие
`operational-notes.*`), другие страницы (Order/Booking/Product/Customer/Partner —
не изменялись), миграции (не требуются: `entityType` — String), D7 financial section.

## 5. API Evidence

| Endpoint | Permission | Использование (UI-C5) |
|---|---|---|
| `GET /api/v1/operational-notes/:entityType/:entityId?page&pageSize` | `operational-notes.read` | Request detail — список заметок (pageData) |
| `POST /api/v1/operational-notes/:entityType/:entityId` | `operational-notes.create` | Request detail — создание заметки |
| `PATCH /api/v1/operational-notes/:noteId` | `operational-notes.update` | Request detail — редактирование |
| `DELETE /api/v1/operational-notes/:noteId` | `operational-notes.delete` | Request detail — soft-delete |

RBAC/tenant: без изменений — серверная authority (`operational-notes.*` c
author/ADMIN object-check), tenant наследуется от parent detail-gate; BUYER/PARTNER
без прав (RBAC-матрица e2e вне scope, pre-existing baseline).

## 6. Static Qualification

```text
frontend vitest: 770 passed / 1 failed (771 total)
  - единственный fail = известный pre-existing baseline
    (i18n formatPrice NBSP, промпт §32; НЕ относится к UI-C5, не фиксится)
  - commerce-notes.spec.tsx: 8/8 PASS
tsc --noEmit (frontend):   PASS
next build (frontend):     PASS
git diff --check:          PASS

backend unit (operational-notes.service.spec):
  - 8 известных pre-existing фейлов на чистом baseline
    (устаревший $transaction-mock: tx.operationalNote.update is not a function) —
    подтверждено stash-проверкой, НЕ связано с UI-C5
backend e2e (d5-operational-note-audit, изолированная travelhub1_test):
  19/19 PASS — включая 6 новых Request-тестов (CRUD/history/404/400)
backend e2e (RBAC-матрица): 42 pre-existing фейла на чистом baseline
  (404 на регистрацию партнёра в beforeAll — экологическая причина,
  подтверждено stash-проверкой, вне влияния UI-C5)
```

## 7. Runtime Qualification (hydrated DOM, Playwright, реальный стек)

Стек поднят: PostgreSQL 18 (Windows-служба) + backend (`ts-node src/main.ts`,
:4000, перезапущен для загрузки нового allowlist-кода) + frontend (Next.js dev,
:3000). Login: admin/admin123.

```text
20/20 PASS

Request (MKT-REQ-09000547, 006e94b4-62e7-447a-9cab-84ca62d74758):
  - секция «Примечания» рендерится (заголовок + create-form textarea
    #note-create-Request-<id>)
  - empty-state «Примечаний пока нет» для Request без заметок
  - порядок секций: Notes (y=1174) ABOVE Audit «История изменений» (y=1490)
    — между Relations и Audit, соответствует дизайн-контракту
  - CREATE через UI: заметка видна, автор «Administrator», «Создано» + timestamp,
    counter (1)
  - EDIT через UI: «Редактировать» → «Сохранить» → новый текст + «Изменено»
  - DELETE через UI: «Удалить» → «Да» → заметка удалена, empty-state восстановлен
Order (MKT-ORD-09000547): секция «Примечания» рендерится (regression,
  страница не изменялась)
Console: 0 errors
```

Audit-трасса (D5-R2, `security.AuditLog` для Request-заметок):

```text
operational_note.created  ×4   (все прогоны runtime-проверки)
operational_note.updated  ×3   (edit-шаги)
operational_note.deleted  ×3   (delete-шаги)
details.entityId = 006e94b4-… (Request) — мутации Request-заметок аудируются
```

Скриншоты-evidence: `backend/uic5_shots/request_notes_with_note.png`,
`backend/uic5_shots/request_notes_empty.png`.

## 8. Security & Boundaries

- Server authority сохранена: create/update/delete выполняются через
  `operational-notes.*` permissions с author/ADMIN object-check (backend не
  ослаблен; allowlist расширен единственной сущностью `Request`).
- `entityType` — String, миграция не требовалась; несуществующий Request → 404
  (existence-gate через `resolveEntity`).
- PII/данные: скриншоты и логи не содержат чувствительных данных клиентов
  (использован тестовый текст заметки).
- Отклонений от дизайн-контракта нет: используется существующий
  `<OperationalNotes>` (новый компонент не создавался).

## 9. Final Verdict

```text
VERDICT A — ACCEPTED

static:  frontend vitest 770/771 (1 pre-existing NBSP), tsc PASS, next build PASS,
         backend e2e d5 19/19 (включая 6 новых Request-тестов)
runtime: 20/20 hydrated DOM checks (Request Notes CRUD + section order +
         Order regression), 0 console errors
limits:  8 unit-фейлов operational-notes + 42 RBAC e2e — pre-existing baselines
         (подтверждено stash), НЕ приписаны UI-C5
```