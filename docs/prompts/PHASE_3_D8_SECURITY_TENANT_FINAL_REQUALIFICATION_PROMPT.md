# PHASE 3 — D8 SECURITY / TENANT FINAL RE-QUALIFICATION
## Final Evidence Closure for VERDICT A

## 1. Назначение

Это **финальная узкая re-qualification D8 — Global Temporal Visibility**.

Текущий D8 implementation и temporal validation уже исправлены и повторно доказаны в runtime. Текущий оставшийся evidence gap: **полный multi-role tenant-isolation и negative-RBAC matrix**.

Цель этой задачи — закрыть только этот evidence gap и определить, может ли D8 получить:

**VERDICT A — D8 CLOSED**

Не расширять функциональный scope D8.

Не переходить к следующему этапу roadmap в рамках этой задачи.

Не изменять schema, migrations, lifecycle authority, temporal authority, RBAC model или tenant model.

---

## 2. Обязательная база перед началом

Прочитать и соблюдать:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `docs/prompts/TRAVELHUB_MASTER_ROADMAP.md`
- `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
- `docs/architecture/temporal-readiness.md`
- `docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_IMPLEMENTATION_QUALIFICATION_REPORT.md`
- `docs/reports/PHASE_3_D8_FINAL_REQUALIFICATION_REPORT.md`

Зафиксировать:

- текущий `git status`;
- текущий HEAD;
- current branch;
- `HEAD == origin/<branch>` до начала тестирования;
- baseline SHA.

Не изменять canonical roadmap.

Не создавать альтернативный roadmap.

---

## 3. Frozen D8 security contract

Проверяется уже реализованная D8-модель:

### 3.1 Temporal predicates

Temporal filters являются **additive** к существующим:

- tenant predicates;
- policy predicates;
- role/permission predicates;
- scope predicates.

Temporal query parameters не должны заменять или ослаблять существующие access-control predicates.

### 3.2 Forbidden bypasses

Нельзя получить доступ к данным, которые пользователь не имеет права видеть, только за счёт изменения:

- `dateFrom`;
- `dateTo`;
- URL;
- query string;
- route parameters, связанных с temporal filtering.

Нельзя использовать malformed dates для обхода authorization.

Нельзя использовать valid dates для расширения tenant scope.

---

# 4. Обязательная multi-role matrix

Провести реальный authenticated test минимум для следующих capability classes, используя реальные существующие роли/пользователей проекта:

### Class A — privileged internal role

Например `DIRECTOR` или другой реально разрешённый internal role.

Доказать:
- разрешённый route доступен;
- temporal filtering работает;
- данные ограничены текущим разрешённым scope.

### Class B — restricted internal role

Выбрать роль с меньшими permissions, реально существующую в проекте.

Проверить:
- route/API доступ при наличии соответствующего permission;
- отказ там, где permission отсутствует;
- temporal parameter не расширяет доступ.

### Class C — role without required permission

Использовать реального пользователя/роль без необходимого permission.

Проверить:

- UI не предоставляет незаконный доступ;
- прямой API request не даёт bypass;
- изменение `dateFrom/dateTo` ничего не меняет в authorization result.

### Class D — PARTNER / scoped external role

Если существующая среда позволяет authenticated PARTNER/scope test:

- проверить tenant/scope restrictions;
- temporal filters должны применяться внутри разрешённого scope;
- запрос другого tenant/scope должен быть denied/filtered according to existing authority.

Если реальная production-like fixture для этого класса отсутствует, **не симулировать PASS**. Зафиксировать отсутствие необходимого evidence и дать B.

---

# 5. Tenant isolation matrix

Использовать реальные tenant/scope contexts или существующую изолированную test fixture.

Минимум:

### Case T1 — same tenant, different dates

Проверить, что temporal filtering корректно сужает dataset внутри собственного tenant.

### Case T2 — different tenant, same dates

Проверить, что одинаковые:

`dateFrom + dateTo`

не позволяют получить записи другого tenant.

### Case T3 — attacker changes temporal range

Пользователь остаётся в своём authorization context, но меняет:

- широкий диапазон;
- исторический диапазон;
- будущий диапазон;
- диапазон, в котором известны записи другого tenant.

Результат должен соблюдать existing tenant scope.

### Case T4 — combined temporal + unauthorized scope

Попытаться одновременно использовать temporal params и любой существующий route/query mechanism для расширения scope.

Temporal filtering не должен обходить scope predicates.

---

# 6. Negative RBAC matrix

Для каждого реально применимого D8 surface:

- Requests
- Orders
- Bookings
- Payments
- CRM Activity
- CRM customers
- Catalog
- Analytics

проверить authorization behavior.

Не обязательно каждый surface должен иметь одинаковую UI access model. Нужно проверить существующую архитектурную authority.

Минимальная проверка:

| Scenario | Expected |
|---|---|
| Permission granted + valid dates | Authorized |
| Permission granted + invalid date | HTTP 400 canonical validation |
| Permission absent + valid dates | Existing authorization denial |
| Permission absent + invalid dates | No authorization bypass; document actual pipeline behavior |
| Unauthorized tenant + valid dates | Existing tenant denial/filtering |
| Unauthorized tenant + broad dates | Still denied/filtered |
| Unauthorized tenant + malformed dates | No bypass |

Ключевое требование: не превращать validation behavior в ложный security PASS.

Если при отсутствии permission система сначала возвращает 400 validation error, это нужно зафиксировать как реальный pipeline behavior и отдельно проверить, что unauthorized data не раскрывается.

---

# 7. Direct API qualification

Browser smoke недостаточен.

Для ключевых D8 endpoints выполнить authenticated direct API tests.

Для каждого применимого endpoint зафиксировать:

- method;
- route;
- authenticated role;
- tenant/scope;
- query;
- expected authorization;
- actual status;
- data visibility;
- request ID.

Обязательно проверить как минимум:

- valid temporal query;
- broad temporal query;
- malformed temporal query;
- unauthorized role;
- unauthorized tenant/scope.

---

# 8. Data leakage checks

Особое внимание:

Temporal filter может вернуть только subset данных, но subset должен оставаться внутри существующего authorization scope.

Доказать отсутствие:

- cross-tenant row leakage;
- cross-role restricted data leakage;
- hidden record count leakage через unauthorized endpoint;
- unauthorized aggregate/KPI leakage;
- leakage через Analytics;
- leakage через Requests KPI/table mismatch.

Для KPI/Analytics не переопределять бизнес-семантику D11. Проверяется только access scope и temporal visibility.

---

# 9. Authentication / session integrity

Проверить:

- authenticated session сохраняет expected role;
- logout / unauthenticated request не даёт temporal endpoint access;
- прямой anonymous request не даёт данных;
- повторное использование URL с `dateFrom/dateTo` без auth не bypass-ит guards.

Не менять auth model.

---

# 10. No-code-change rule

По умолчанию эта задача является **evidence-only**.

Запрещено:

- исправлять production code ради получения PASS;
- менять guards;
- менять permissions;
- менять tenant predicates;
- менять schema;
- менять DTO contracts;
- менять temporal parser;
- менять lifecycle authority.

Исключение допускается только если обнаружен новый **однозначно доказанный D8 implementation defect**, без которого невозможно выполнить frozen security contract.

В этом случае:

1. остановить qualification;
2. зафиксировать reproduction;
3. severity;
4. affected route;
5. expected;
6. actual;
7. impact;
8. не ставить `A`.

Не вносить незапланированный fix и затем автоматически считать evidence закрытым.

---

# 11. Runtime evidence

Проверки должны выполняться на реально запущенном stack.

Минимально зафиксировать:

- backend status;
- frontend status;
- database status;
- authenticated role;
- tenant/scope context;
- browser/session state;
- direct API responses.

Для каждого security/tenant case сохранять хотя бы один воспроизводимый evidence:

- API response;
- browser result;
- server/log evidence;
- screenshot, если нужен для UI.

---

# 12. Regression checks

После security/tenant matrix выполнить:

- focused D8 tests;
- существующие relevant backend tests;
- существующие relevant frontend tests;
- backend typecheck;
- backend production build;
- frontend production build;
- `git diff --check`.

Не исправлять unrelated pre-existing failures.

---

# 13. Git evidence

Перед завершением:

```text
git status
git diff --check
git diff --stat
git diff --name-only
git log -1 --oneline
git rev-parse HEAD
git rev-parse origin/<branch>
```

Если production code не менялся, explicitly state that.

Создать qualification report:

`docs/reports/PHASE_3_D8_SECURITY_TENANT_FINAL_REQUALIFICATION_REPORT.md`

Commit report-only changes, если они есть.

Push canonical branch.

Подтвердить:

- final SHA;
- `HEAD == origin/<branch>`;
- clean working tree.

---

# 14. Final Report Structure

Создать:

`docs/reports/PHASE_3_D8_SECURITY_TENANT_FINAL_REQUALIFICATION_REPORT.md`

Обязательные разделы:

## 14.1 Executive Summary

Почему проводилась эта re-qualification и какой evidence gap закрывается.

## 14.2 Baseline / Final SHA

Branch, baseline, final SHA, origin parity.

## 14.3 Environment

Frontend/backend/database/auth/session/test fixtures.

## 14.4 Role Matrix

Таблица:

| Role | Permission class | Tenant/Scope | Route/API | Expected | Actual | Result |
|---|---|---|---|---|---|---|

## 14.5 Tenant Isolation Matrix

T1–T4 с фактическими evidence.

## 14.6 Negative RBAC Matrix

Все проверенные scenarios.

## 14.7 Direct API Evidence

Routes, requests, responses, request IDs.

## 14.8 Data Leakage Checks

Cross-tenant, cross-role, aggregate/KPI, Analytics.

## 14.9 Authentication / Session Evidence

Anonymous and authenticated behavior.

## 14.10 Regression / Build

Tests, typecheck, builds, diff checks.

## 14.11 Known Limitations

Только реально существующие evidence gaps.

## 14.12 Final Verdict

Разрешены только:

### VERDICT A — D8 CLOSED

Только если:
- полный required security evidence получен;
- multi-role evidence получен;
- tenant isolation evidence получен;
- negative-RBAC evidence получен;
- no D8 defect remains;
- Git closure выполнен.

### VERDICT B — VALID SYSTEM FAIL

Использовать, если:
- implementation в целом корректна;
- но required evidence получить не удалось.

### VERDICT C — IMPLEMENTATION DEFECT

Использовать, если обнаружен реальный D8 security/tenant/RBAC defect.

---

# 15. Critical anti-false-positive rule

**Не считать отсутствие ошибки доказательством tenant isolation.**

Нужна проверяемая связь:

`identity → role → permission → tenant/scope → temporal filter → returned dataset`

Для каждого критического сценария должно быть понятно:

- кто запросил;
- что ему разрешено;
- какой temporal range указан;
- какой dataset ожидался;
- какой dataset реально получен.

---

# 16. Exit Criteria

D8 получает `VERDICT A — D8 CLOSED` только при выполнении всех условий:

- authenticated runtime evidence complete;
- multi-role matrix complete;
- negative-RBAC matrix complete;
- tenant-isolation matrix complete;
- direct API evidence complete;
- no unauthorized data leakage;
- no D8 implementation defect;
- regression/build checks passed or clearly documented;
- qualification report committed;
- pushed to canonical branch;
- `HEAD == origin`;
- clean working tree.

---

# 17. Следующий этап

Не выбирать следующий roadmap stage внутри этой задачи.

Если получен:

**VERDICT A — D8 CLOSED**

только после этого отдельной задачей провести:

**TRUE NEXT RE-QUALIFICATION**

по canonical roadmap.

До `VERDICT A` D8 считается незакрытым.
