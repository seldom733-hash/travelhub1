# PHASE 3 — STEP 3.8.2 — FINAL EVIDENCE / GIT / LANGUAGE CLOSURE

## 0. РЕЖИМ

**FINAL EVIDENCE CLOSURE ONLY.**

Техническая remediation Step 3.8.2 уже выполнена и runtime re-qualification заявлен как PASS.

Текущий статус до этой задачи:

```text
TECHNICAL REMEDIATION: PASS
RUNTIME RE-QUALIFICATION: PASS
GIT CLOSURE: INCOMPLETE
STEP 3.8 NOT YET READY FOR STRICT REVIEW
```

Эта задача НЕ является новой remediation, НЕ является Strict Review и НЕ расширяет scope Marketing Domain.

---

## 1. LANGUAGE REQUIREMENT — MANDATORY

Все отчёты и документы, создаваемые или обновляемые в рамках этой задачи, должны быть написаны **на русском языке**.

Обязательно на русском:

- основной Remediation / Evidence Closure Report;
- названия и описания findings;
- Root Cause explanations;
- Architecture Decisions;
- Security Evidence explanations;
- Runtime Evidence descriptions;
- выводы;
- пояснения к verdict;
- deferred-item explanations;
- finding closure explanations.

Допускается оставлять на английском только:

- имена файлов и пути;
- классы, методы, DTO, модели, таблицы;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enum values;
- permission identifiers;
- технические идентификаторы;
- код;
- стандартизированные строки VERDICT.

Не переводить технические идентификаторы искусственно.

**Если итоговый отчёт преимущественно написан на английском языке, задача считается незавершённой.**

Текущий Step 3.8.2 report необходимо привести к этому языковому контракту без изменения технических фактов и истории выполнения.

---

## 2. HARD SCOPE FREEZE

Не изменять production behavior, если эта final evidence closure не обнаружит новый реальный дефект.

Не реализовывать:

```text
Marketing Center UI
EMAIL/SMS/PUSH
consent/preferences
marketing automation
campaign analytics
Partner Marketing entitlement
Storefront Marketing UI
User/Buyer/Partner suspension/deactivation lifecycle
следующий roadmap implementation step
```

Не переписывать историю Step 3.8.1.

Не скрывать ранее найденные P2.

---

## 3. BASELINE / PREFLIGHT

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -15 --oneline
```

Из предыдущего отчёта известны:

```text
Step 3.8 implementation SHA: 541fe4b
Step 3.8.1 evidence SHA:     8b32e34
```

Определить фактический commit, содержащий Step 3.8.2 remediation.

Записать реальные значения:

```text
Step 3.8 implementation SHA:
Step 3.8.1 evidence SHA:
Step 3.8.2 remediation SHA:
Current HEAD:
origin/master:
HEAD == origin/master:
```

Никаких:

```text
(this commit)
(after commit)
(after push)
TBD
TODO
placeholder
```

---

## 4. ОБЯЗАТЕЛЬНО УСТРАНИТЬ ПРОТИВОРЕЧИЕ PLATFORM-ONLY VS PARTNER 201

Предыдущий Step 3.8.2 report одновременно утверждает:

```text
Marketing is currently a Platform-only domain.
Partner roles correctly lack marketing.* permissions.
```

и показывает API/RBAC/runtime формулировки вида:

```text
Partner (own scope) → POST /marketing/attributions → 201
Partner (own scope) → POST /marketing/audiences → 201
Partner (own scope) → POST /marketing/campaigns → 201
```

Эти утверждения нельзя оставлять без объяснения.

### 4.1 Проверить фактическую authority chain

Для каждого Marketing endpoint определить:

```text
authentication
workspace context
role
permission
partner scope
entitlement/capability gate, если существует
```

Проверить реальные `RolePermission` / permission resolution данные.

### 4.2 Идентифицировать actors runtime-тестов

Для runtime evidence, которое ранее называлось:

```text
Partner A
Partner B
Partner own scope
Partner foreign scope
```

записать:

```text
actor user type:
actor role:
workspace context:
partnerId:
marketing.* permissions:
entitlement:
почему request был разрешён или запрещён:
```

Нельзя называть actor просто `Partner`, если это Platform/admin test actor, искусственно работающий с partner-scoped Campaign.

### 4.3 Определить один канонический результат

Допустимы только доказанные варианты.

#### CASE A — Marketing действительно Platform-only

Тогда Partner identity без `marketing.*` должна получать:

```text
403
```

а прежние строки `Partner → 201` должны быть исправлены как неверная маркировка evidence.

Если Platform actor создавал/читал Partner-scoped Campaign, так и написать:

```text
Platform authorized actor operating on Partner-scoped Campaign
```

Это НЕ равно:

```text
Partner actor has Marketing access
```

#### CASE B — реальный Partner actor имеет разрешённый Marketing access

Тогда утверждение `Platform-only` неверно.

Нужно установить:

```text
какой role/permission это разрешает;
какой entitlement это разрешает;
Basic или Pro;
соответствует ли это canonical architecture.
```

Если доступ появился без требуемой entitlement authority — это новый security/architecture defect.

В таком случае:

```text
STOP
VERDICT B
```

Не исправлять его скрытно в evidence closure.

#### CASE C — тестовый обход / fixture напрямую дал Partner marketing permissions

Если runtime actor получил permission искусственно только для security test:

- явно это указать;
- не использовать такой runtime как доказательство production entitlement;
- отдельно доказать production Partner role denial;
- исправить формулировки API/RBAC matrix.

---

## 5. ОБЯЗАТЕЛЬНАЯ RUNTIME AUTHORITY MATRIX

Сформировать таблицу:

| Actor | Workspace | Partner scope | marketing permission | Entitlement | Endpoint | HTTP | Почему |
|---|---|---|---|---|---|---:|---|
| Platform ADMIN | PLATFORM | none | | | GET campaigns | | |
| Platform MARKETER | PLATFORM | none | | | POST campaign | | |
| Internal role without permission | PLATFORM | none | none | | GET campaigns | 403 | |
| Production Partner role | PARTNER | own | | | GET campaigns | | |
| Production Partner role | PARTNER | own | | | POST campaign | | |
| Anonymous | — | — | — | — | GET campaigns | 401 | |

Добавить другие строки, если они нужны для точного объяснения Step 3.8.2 evidence.

Таблица должна отражать реальные authenticated HTTP requests.

---

## 6. НЕ ПЕРЕПУТАТЬ DATA SCOPE И ACCESS AUTHORITY

Явно зафиксировать различие:

```text
Partner-scoped Campaign
≠
Partner actor access to Marketing
```

`Campaign.partnerId` может существовать для tenant/data scoping и будущей архитектуры даже если текущий Marketing Center/API разрешён только Platform staff.

Если это текущая архитектура, отчёт должен говорить именно это.

Аналогично:

```text
Platform actor operating on Partner-scoped data
≠
Partner role has marketing entitlement
```

---

## 7. ПОВТОРНАЯ ПРОВЕРКА КРИТИЧЕСКИХ REMEDIATION GATES

Не нужно повторять весь Step 3.8.2 с нуля, но перед финальным closure повторно доказать минимум:

```text
nonexistent attribution → controlled reject, persistence 0
type-confused attribution → controlled reject, persistence 0
duplicate attribution → controlled 409/other canonical non-500, rows=1
foreign Partner entity attribution → controlled reject
blocked Audience criteria → controlled reject
valid attribution → success
unauthorized internal role → 403
production Partner role → result consistent with resolved architecture
anonymous → 401
```

Если любой из уже закрытых P2 воспроизводится снова:

```text
STOP — VERDICT B
```

---

## 8. ОТЧЁТ НА РУССКОМ

Обновить:

```text
docs/prompts/PHASE_3_STEP_3.8.2_MARKETING_DOMAIN_RUNTIME_DEFECT_REMEDIATION_REPORT.md
```

Сохранить факты, но привести prose к русскому языку.

Рекомендуемая структура:

```text
1. Исходное состояние
2. Findings Step 3.8.1
3. Причины и исправления
4. Изменённые файлы
5. Schema / Migration
6. API / RBAC / Authority Matrix
7. Runtime-доказательства
8. Security-доказательства
9. Тесты
10. Отложенные элементы
11. Cleanup
12. Git Closure
13. Finding Closure Table
14. Итоговый Verdict
```

Названия сущностей вроде `CampaignAttribution`, `PartnerCustomerRelation`, `P2002`, endpoints и permissions оставить техническими.

---

## 9. GIT CLOSURE — HARD GATE

После обновления отчёта:

```bash
git status --short
git diff --name-only
git diff
```

Убедиться, что в этой задаче не появилось незапланированных production changes.

Stage только task-owned report/evidence changes.

Затем:

```bash
git diff --cached --name-only
git commit -m "docs(marketing): close Step 3.8.2 evidence and git state"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

В отчёте записать **после push**:

```text
Step 3.8 implementation SHA: 541fe4b
Step 3.8.1 evidence SHA:     8b32e34
Step 3.8.2 remediation SHA:  <REAL SHA>
Final evidence closure SHA:  <REAL SHA>
Final HEAD:                  <REAL SHA>
origin/master:               <REAL SHA>
HEAD == origin/master:       YES
```

Если report commit сам является final evidence closure commit, корректно различить remediation SHA и report/evidence SHA.

Не оставлять placeholders.

---

## 10. DIRTY WORKTREE

Если после closure остаются pre-existing/unrelated изменения:

- перечислить их;
- доказать, что они не относятся к 3.8.2;
- не удалять;
- не stage;
- не заявлять `working tree clean`, если это неправда.

`HEAD == origin/master` и `working tree clean` — разные утверждения.

---

## 11. FINDING CLOSURE

Финальная таблица должна содержать:

| Finding | Severity | Решение | Runtime | Status |
|---|---:|---|---|---|
| Duplicate attribution raw 500 | P2 | | | |
| Nonexistent attribution | P2 | | | |
| Type confusion | P2 | | | |
| Audience arbitrary/contact criteria | P2 | | | |
| Partner campaign entity scope | P2 | | | |
| Partner Marketing access ambiguity | P3 / architecture | | | |
| Git closure placeholders | Evidence gap | | | |
| Report language | Documentation requirement | | | |

Нельзя ставить `CLOSED`, пока соответствующее доказательство отсутствует.

---

## 12. PASS CONDITIONS

PASS только если одновременно:

```text
все Step 3.8.2 P2 остаются закрыты
Platform-only vs Partner access contradiction resolved
реальный production Partner access explicitly proven
нет скрытого entitlement bypass
API/RBAC matrix corrected
report predominantly Russian
Step 3.8.2 remediation SHA recorded
final evidence SHA recorded
Final HEAD recorded
origin/master recorded
HEAD == origin/master = YES
no placeholders
no new unresolved P0/P1/P2
```

---

## 13. SUCCESS VERDICT

Только при выполнении всех условий:

```text
VERDICT A — STEP 3.8.2 FINAL EVIDENCE / GIT / LANGUAGE CLOSURE — PASS

STEP 3.8.2 CLOSED
STEP 3.8 READY FOR STRICT REVIEW
```

Это **не означает**:

```text
STEP 3.8 CLOSED
```

Step 3.8 закрывается только отдельным Strict Review.

---

## 14. FAILURE VERDICT

Если authority contradiction, Git closure или другой hard gate не закрыт:

```text
VERDICT B — STEP 3.8.2 FINAL EVIDENCE CLOSURE INCOMPLETE

STEP 3.8 NOT READY FOR STRICT REVIEW
```

Если обнаружен новый реальный security/system defect:

```text
VERDICT B — STEP 3.8.2 FINAL EVIDENCE CLOSURE FAILED
SYSTEM DEFECT ESTABLISHED
STEP 3.8 NOT READY FOR STRICT REVIEW
```

Не исправлять новый дефект скрытно.

---

## 15. STOP CONDITION

После успешного closure:

```text
STOP
```

Не:

```text
запускать Strict Review автоматически
помечать Step 3.8 CLOSED
обновлять canonical NEXT
начинать следующий implementation step
реализовывать Marketing UI
реализовывать User/Buyer/Partner suspension/deactivation lifecycle
```

Следующая отдельная задача:

```text
PHASE 3 — STEP 3.8 — STRICT REVIEW
```
