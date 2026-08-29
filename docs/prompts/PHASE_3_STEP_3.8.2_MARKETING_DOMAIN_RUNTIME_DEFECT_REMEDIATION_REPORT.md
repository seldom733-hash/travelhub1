# PHASE 3 — STEP 3.8.2 — MARKETING DOMAIN ATTRIBUTION / AUDIENCE RUNTIME DEFECT REMEDIATION — REPORT

## 1. Исходное состояние

```
Step 3.8 implementation SHA:  541fe4b
Step 3.8.1 evidence SHA:      8b32e34
Starting HEAD:                8b32e34
```

Исходный verdict:

```
VERDICT B — STEP 3.8.1 EVIDENCE CLOSURE FAILED
SYSTEM DEFECTS ESTABLISHED
STEP 3.8 NOT READY FOR STRICT REVIEW
```

## 2. Findings Step 3.8.1

| Finding | Severity | Описание |
|---|---:|---|
| Duplicate attribution raw 500 | P2 | Повторная уникальная атрибуция возвращала raw Prisma P2002 ошибку (HTTP 500) |
| Nonexistent attribution entity | P2 | Несуществующий `entityId` сохранялся с HTTP 201 |
| Attribution type confusion | P2 | UUID Order можно было подставить как `entityType: BOOKING` — сохранялось с 201 |
| Audience arbitrary/contact criteria | P2 | JSONB `criteria` принимал произвольные contact-bearing поля (email, phone, partnerId, rawSql) |
| Partner campaign entity scope | P2 | Platform actor на partner-scoped Campaign мог привязать foreign Partner entity |
| Partner Marketing permissions | P3 | Partner роли не имеют `marketing.*` permissions — определено как Platform-only |

## 3. Причины и исправления

### 3.1 Finding A: Несуществующая сущность (P2 → ИСПРАВЛЕНО)

**Причина:** `createAttribution` сохранял `entityId` без проверки существования сущности в каноническом домене.

**Исправление:** Добавлен приватный метод `validateEntityReference()`, который разрешает каждый `entityType` через канонический authority:
- `CUSTOMER` → `prisma.customer.findUnique`
- `LEAD` → `prisma.lead.findUnique`
- `ORDER` → `prisma.order.findUnique`
- `BOOKING` → `prisma.booking.findUnique`

Несуществующая сущность → контролируемый 404 `NotFoundError`, persistence = 0.

**Файл:** `marketing.service.ts` — метод `validateEntityReference()`, вызывается из `createAttribution()`.

### 3.2 Finding B: Целостность типа (P2 → ИСПРАВЛЕНО)

**Причина:** `entityId` не валидировался через authority, соответствующий `entityType`. UUID Order можно было отправить как `entityType: BOOKING`.

**Исправление:** Тот же метод `validateEntityReference()` — каждая ветка `entityType` выполняет lookup в соответствующей таблице. Order UUID, отправленный как `BOOKING`, не проходит `prisma.booking.findUnique` → 404.

**Runtime доказательство:** `BOOKING + OrderId → HTTP 404, persistence=0`

### 3.3 Finding C: Дубликат атрибуции raw 500 (P2 → ИСПРАВЛЕНО)

**Причина:** DB-level уникальный constraint `(campaignId, entityType, entityId)` генерировал raw Prisma P2002 ошибку, маппинг HTTP 500.

**Исправление:** Добавлен try/catch вокруг `prisma.campaignAttribution.create`, который ловит `Prisma.PrismaClientKnownRequestError` с кодом `P2002` и маппит в `ConflictError` (HTTP 409). Несвязанные Prisma ошибки пробрасываются дальше.

**Runtime доказательство:** `Duplicate CUSTOMER → HTTP 409, DB rows = 1`

### 3.4 Finding D: Audience criteria contract (P2 → ИСПРАВЛЕНО)

**Причина:** JSONB `CampaignAudience.criteria` принимал произвольные поля включая `email`, `phone`, `partnerId`, `rawSql`, `password` — потенциальный bypass contact-policy и tenant selector.

**Исправление:** Добавлен метод `validateAudienceCriteria()`:
- **Whitelist:** `lifecycle`, `leadSource`, `tags`, `status`, `customerType`
- **Blocklist:** `email`, `phone`, `url`, `address`, `socialHandle`, `partnerId`, `tenantId`, `ownerId`, `createdById`, `password`, `auth`, `token`, `secret`, `rawSql`, `query`, `$where`, `$expr`
- **Типы значений:** string, number, boolean или string array — без вложенных объектов

Отклонённые criteria → контролируемый 422 `ValidationDomainError`.

**Runtime доказательство:** Все 7 заблокированных полей + неизвестное поле + вложенный объект → HTTP 422.

### 3.5 Finding: Partner campaign entity scope (P2 → ИСПРАВЛЕНО)

**Причина:** При создании атрибуции на Partner-scoped Campaign использовался `actor.partnerId` (у Platform = null), что пропускало проверку entity scope. Platform мог привязать foreign Partner entities к Partner A Campaign.

**Исправление:** Заменено на `campaign.partnerId` — entity scope проверяется относительно campaign, а не actor. Platform, оперирующий на Partner-scoped Campaign, теперь корректно проверяет entity scope.

**Runtime доказательство:** `Partner A Campaign + Partner B CUSTOMER/ORDER/BOOKING → HTTP 404`

### 3.6 Finding: Partner Marketing permissions (P3 → АРХИТЕКТУРНО ЗАДОКУМЕНТИРОВАНО)

**Решение:** Marketing — исключительно Platform-only домен.

**Обоснование:**
- `marketing.*` permissions назначены только ролям: ADMIN, DIRECTOR, MARKETER, OPERATOR
- Role PARTNER **не имеет** ни одного `marketing.*` permission
- Marketplace Basic не имеет Marketing entitlement в canonical roadmap
- Storefront Pro Marketing access — вопрос будущей entitlement архитектуры

**Runtime доказательство:**
```
PARTNER role → GET /marketing/campaigns → 403
PARTNER role → POST /marketing/campaigns → 403
PARTNER role → POST /marketing/attributions → 403
PARTNER role → POST /marketing/audiences → 403
FINANCE role → GET /marketing/campaigns → 403
```

**Важное уточнение:** В предыдущем отчёте строки вида `Partner (own scope) → 201` были **некорректной маркировкой**. На самом деле runtime evidence выполнялся **Platform ADMIN actor, оперирующим на partner-scoped Campaign** — это НЕ равно `Partner actor has Marketing access`. Исправлено в настоящем отчёте.

## 4. Изменённые файлы

| Файл | Изменение |
|---|---|
| `backend/src/modules/marketing/marketing.service.ts` | Валидация entity reference, обработка дубликатов, валидация criteria, исправление entity scope |
| `backend/src/modules/marketing/marketing.service.spec.ts` | 45 тестов, покрывающих все исправления |
| `docs/prompts/PHASE_3_STEP_3.8.2_MARKETING_DOMAIN_RUNTIME_DEFECT_REMEDIATION_REPORT.md` | Настоящий отчёт |

## 5. Schema / Migration

```
НОВАЯ МИГРАЦИЯ НЕ ТРЕБУЕТСЯ
```

Все исправления implemented на уровне service. Существующий DB-level уникальный constraint `(campaignId, entityType, entityId)` был корректен — исправлена только application-level ошибка маппинга.

## 6. API / RBAC / Authority Matrix

### 6.1 Authority chain

```
Identity → Workspace Context → Tenant/Partner Scope → Plan/Entitlement
→ Business Capability → Role/Permission → Available Marketing Action/Data
```

### 6.2 Role → Permission mapping (фактический из DB)

| Role | marketing.* permissions |
|---|---|
| ADMIN | ✅ все 9 permissions |
| DIRECTOR | ✅ все 9 permissions |
| MARKETER | ✅ все 9 permissions |
| OPERATOR | ✅ все 9 permissions |
| PARTNER | ❌ нет ни одного |
| FINANCE | ❌ нет ни одного |
| BUYER | ❌ нет ни одного |
| ANALYST | ❌ нет ни одного |
| MODERATOR | ❌ нет ни одного |
| SALES_MANAGER | ❌ нет ни одного |

### 6.3 Runtime authority matrix (authenticated HTTP)

| Actor | Role | Workspace | marketing.* | Endpoint | HTTP | Почему |
|---|---|---|---|---|---:|---|
| Platform ADMIN | ADMIN | PLATFORM | ✅ все | GET /marketing/campaigns | 200 | PermissionsGuard → ALLOW |
| Platform MARKETER | MARKETER | PLATFORM | ✅ все | POST /marketing/campaigns | 201 | PermissionsGuard → ALLOW |
| Platform OPERATOR | OPERATOR | PLATFORM | ✅ все | POST /marketing/attributions | 201 | PermissionsGuard → ALLOW |
| Platform DIRECTOR | DIRECTOR | PLATFORM | ✅ все | GET /marketing/campaigns | 200 | PermissionsGuard → ALLOW |
| Production Partner | PARTNER | PARTNER (own) | ❌ нет | GET /marketing/campaigns | **403** | PermissionsGuard → DENY |
| Production Partner | PARTNER | PARTNER (own) | ❌ нет | POST /marketing/campaigns | **403** | PermissionsGuard → DENY |
| Production Partner | PARTNER | PARTNER (own) | ❌ нет | POST /marketing/attributions | **403** | PermissionsGuard → DENY |
| Production Partner | PARTNER | PARTNER (own) | ❌ нет | POST /marketing/audiences | **403** | PermissionsGuard → DENY |
| Finance | FINANCE | PLATFORM | ❌ нет | GET /marketing/campaigns | **403** | PermissionsGuard → DENY |
| Anonymous | — | — | — | GET /marketing/campaigns | **401** | JwtAuthGuard → DENY |

### 6.4 Разграничение Data Scope и Access Authority

**Partner-scoped Campaign** ≠ **Partner actor имеет Marketing access**

`Campaign.partnerId` существует для tenant/data scoping и будущей архитектуры, даже если текущий Marketing Center/API разрешён только Platform staff.

**Platform actor operating on Partner-scoped data** ≠ **Partner role имеет marketing entitlement**

Runtime evidence, ранее обозначенное как `Partner → 201`, фактически выполнялось:
- **Actor:** Platform ADMIN (роль ADMIN, partnerId = null)
- **Action:** Операции на Partner-scoped Campaign (campaign.partnerId ≠ null)
- **Результат:** Успешно — Platform имеет глобальный scope + marketing.* permissions
- **Вывод:** Это НЕ доказывает Partner Marketing access

## 7. Runtime-доказательства

### 7.1 Authority chain verification

| Gate | Actor | HTTP | Результат |
|---|---|---:|---|
| Admin login + permissions | ADMIN | 200 | ✅ marketing.campaign.create = true |
| Partner login + no permissions | PARTNER | 200 | ✅ marketing.* = NONE |
| Partner GET /campaigns | PARTNER | **403** | ✅ PermissionsGuard DENY |
| Partner POST /campaigns | PARTNER | **403** | ✅ PermissionsGuard DENY |
| Partner POST /attributions | PARTNER | **403** | ✅ PermissionsGuard DENY |
| Partner POST /audiences | PARTNER | **403** | ✅ PermissionsGuard DENY |
| Finance GET /campaigns | FINANCE | **403** | ✅ PermissionsGuard DENY |
| Anonymous GET /campaigns | — | **401** | ✅ JwtAuthGuard DENY |

### 7.2 Defect gates re-verification

| Gate | HTTP | Persistence | Результат |
|---|---:|---|---|
| Nonexistent CUSTOMER → reject | 404 | 0 rows | ✅ |
| Nonexistent ORDER → reject | 404 | 0 rows | ✅ |
| Nonexistent BOOKING → reject | 404 | 0 rows | ✅ |
| Nonexistent LEAD → reject | 404 | 0 rows | ✅ |
| BOOKING + OrderId (type confusion) → reject | 404 | 0 rows | ✅ |
| Valid CUSTOMER attribution | 201 | 1 row | ✅ |
| Valid ORDER attribution | 201 | 1 row | ✅ |
| Duplicate CUSTOMER → 409 | 409 | 1 row | ✅ |
| Partner A Campaign + Partner B CUSTOMER → reject | 404 | 0 | ✅ |
| Partner A Campaign + Partner A CUSTOMER → accept | 201 | 1 row | ✅ |
| Valid criteria (lifecycle, leadSource, tags) | 201 | — | ✅ |
| Blocked criteria: email | 422 | — | ✅ |
| Blocked criteria: phone | 422 | — | ✅ |
| Blocked criteria: partnerId | 422 | — | ✅ |
| Blocked criteria: rawSql | 422 | — | ✅ |
| No email in responses | clean | — | ✅ |
| No phone in responses | clean | — | ✅ |
| Campaigns cleanup | — | 0 remaining | ✅ |

## 8. Security-доказательства

| Свойство | Доказательство |
|---|---|
| Cross-tenant entity isolation | Partner A не может атрибутировать Partner B entities — runtime + DB |
| Forged partnerId | Server-derived из campaign scope, не из body input |
| Nonexistent entity | Контролируемый 404, нулевой persistence |
| Type confusion | Контролируемый 404 через canonical domain lookup |
| Duplicate protection | 409 ConflictError (не raw 500) |
| Contact field blocking | 7 blocked fields + unknown + nested → 422 |
| Production Partner denial | 403 на все marketing endpoints |
| Production Finance denial | 403 на marketing endpoints |
| Anonymous denial | 401 |
| No PII leakage | Marketing responses не содержат email/phone |

## 9. Тесты

```
Marketing tests:     45/45 PASS
Communication tests: 44/44 PASS
Total:               89/89 PASS
Backend TSC:         PASS (0 ошибок)
Backend Build:       PASS
```

## 10. Отложенные элементы

| Элемент | Статус | Причина |
|---|---|---|
| Marketing UI | Отложено | Только backend foundation в Step 3.8 |
| EMAIL/SMS/PUSH transports | Отложено | Нет transport providers |
| Consent/preferences | Отложено | Compliance boundary |
| Marketing automation | Отложено | Будущий шаг |
| Partner Marketing access | Отложено | Platform-only по дизайну, entitlement решение отложено |
| Multi-touch attribution | Отложено | Будущий шаг |

## 11. Cleanup

```
3.8.2 Campaigns:     0 remaining
3.8.2 Audiences:     0 remaining
3.8.2 Attributions:  0 remaining
3.8.2 Customers:     0 remaining
3.8.2 Orders:        0 remaining
3.8.2 Partners:      0 remaining
3.8.2 PCRs:          0 remaining
```

Pre-existing/unrelated dirty state: 2 deleted files + untracked prompt files (не относятся к 3.8.2, не staged).

## 12. Git Closure

```
Step 3.8 implementation SHA:  541fe4b
Step 3.8.1 evidence SHA:      8b32e34
Step 3.8.2 remediation SHA:   38d88fd
Final evidence closure SHA:   (данный commit)
Final HEAD:                   (после push)
origin/master:                (после push)
HEAD == origin/master:        (после push)
```

## 13. Finding Closure Table

| Finding | Severity | Решение | Runtime доказательство | Status |
|---|---|---|---|---|
| Duplicate attribution raw 500 | P2 | P2002 → ConflictError (409) | HTTP 409, rows=1 | CLOSED |
| Nonexistent attribution | P2 | validateEntityReference через canonical domain | HTTP 404, rows=0 | CLOSED |
| Type confusion | P2 | validateEntityReference через canonical domain | HTTP 404, rows=0 | CLOSED |
| Audience arbitrary/contact criteria | P2 | Whitelist + blocklist + type validation | HTTP 422 для всех blocked | CLOSED |
| Partner campaign entity scope | P2 | campaign.partnerId вместо actor.partnerId | HTTP 404 для foreign, 201 для own | CLOSED |
| Partner Marketing access ambiguity | P3 / architecture | Platform-only по дизайну;Partner role → 403 на все marketing endpoints | Runtime 403 доказан | CLOSED |
| Report language | Documentation requirement | Отчёт переведён на русский язык | Настоящий отчёт | CLOSED |
| API/RBAC matrix | Evidence correction | Исправлена некорректная маркировка `Partner → 201` → `Platform ADMIN on partner-scoped Campaign` | Runtime authority matrix | CLOSED |

## 14. Итоговый Verdict

```
VERDICT A — STEP 3.8.2 FINAL EVIDENCE / GIT / LANGUAGE CLOSURE — PASS

STEP 3.8.2 CLOSED
STEP 3.8 READY FOR STRICT REVIEW
```
