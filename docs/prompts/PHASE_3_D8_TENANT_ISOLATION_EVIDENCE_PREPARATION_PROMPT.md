# PHASE 3 — D8 TENANT ISOLATION EVIDENCE PREPARATION
## Positive Scoped-Dataset Qualification

## 1. Назначение

Это промежуточная техническая задача для закрытия **единственного оставшегося D8 evidence gap**.

Текущий D8 security/tenant final re-qualification завершился:

**VERDICT B — VALID SYSTEM FAIL**

Причина не в найденном security-дефекте и не в RBAC bypass. Причина в отсутствии положительного доказательства tenant isolation для пользователя, который одновременно:

- имеет легитимный доступ к D8 registry;
- ограничен отдельным tenant/scope.

Текущий evidence подтверждает только denial (`403`) для BUYER/PARTNER, а не положительный scoped-dataset behavior.

### Цель

Получить воспроизводимую тестовую fixture, позволяющую доказать:

`authorized role + D8 permission + tenant A`
→ видит только tenant A;

`authorized role + D8 permission + tenant B`
→ видит только tenant B;

при этом:

`tenant A + temporal filter`
→ не расширяет scope до tenant B.

Эта задача **не закрывает D8 автоматически**. После получения fixture и evidence нужно отдельно выполнить финальный D8 security/tenant re-qualification.

---

# 2. Обязательная governance-база

Перед началом прочитать:

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- `docs/prompts/TRAVELHUB_MASTER_ROADMAP.md`
- `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`
- `docs/architecture/temporal-readiness.md`
- `docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_IMPLEMENTATION_QUALIFICATION_REPORT.md`
- `docs/reports/PHASE_3_D8_FINAL_REQUALIFICATION_REPORT.md`
- `docs/reports/PHASE_3_D8_SECURITY_TENANT_FINAL_REQUALIFICATION_REPORT.md`

Проверить:

- canonical branch;
- current HEAD;
- origin parity;
- clean/dirty tree;
- существующие test fixtures;
- существующую tenant/scope model;
- существующие seed/test users;
- существующие permissions.

Не выбирать следующий roadmap stage.

---

# 3. Главный принцип

**Не менять production authorization ради получения PASS.**

Сначала исследовать существующую архитектуру.

Идентифицировать фактическую цепочку:

`User`
→ `Role`
→ `Permissions`
→ `Tenant / Workspace / Scope`
→ `Policy / Guard`
→ `Repository / Prisma filter`
→ `D8 temporal predicate`

Зафиксировать, где именно tenant/scope уже применяется.

Не предполагать tenant model по названию таблиц или ролей — доказать её кодом и существующими tests/fixtures.

---

# 4. Fixture Discovery

Найти в проекте:

- tenant entities;
- workspace entities;
- partner/store entities;
- organization/account entities;
- membership relations;
- access scopes;
- policy helpers;
- authorization guards;
- seed users;
- seed roles;
- test factories;
- e2e fixtures;
- isolated database setup.

Идентифицировать, какие существующие D8 registries реально поддерживают tenant/scoped isolation.

Не создавать новую параллельную authorization model.

---

# 5. Fixture Design

Выбрать **самый маленький существующий и архитектурно корректный сценарий**, который позволяет получить два разных scope.

Минимальная целевая конфигурация:

### Tenant A

- authorized user;
- role with D8 registry permission;
- tenant/scope A;
- test records belonging to A.

### Tenant B

- authorized user;
- same or equivalent authorized capability;
- tenant/scope B;
- test records belonging to B.

### Temporal overlap

Создать/использовать records так, чтобы A и B имели записи в одном и том же temporal window.

Например:

`dateFrom = 2026-09-01`
`dateTo   = 2026-10-01`

Это необходимо, чтобы temporal filter не мог случайно скрыть cross-tenant leakage.

---

# 6. Что запрещено

Не делать:

- изменение production tenant predicates;
- изменение guards;
- изменение permissions;
- добавление нового RBAC role только для теста;
- изменение D8 parser;
- изменение lifecycle authority;
- schema redesign;
- migration;
- изменение существующего tenant model.

Допускается только:

- test-only fixture;
- test seed;
- isolated database data;
- e2e/integration test fixture;
- безопасные тестовые account/member records.

Если для доказательства требуется production-code change, **остановить работу и зафиксировать GAP**, не считать его PASS.

---

# 7. Обязательный Proof Scenario

После создания/подготовки fixture выполнить:

## T1 — Tenant A own data

Пользователь A:

`tenant=A`

запрашивает D8 registry с широким периодом.

Ожидается:

- authorized;
- records A присутствуют;
- records B отсутствуют.

## T2 — Tenant B own data

Пользователь B:

`tenant=B`

тот же запрос.

Ожидается:

- authorized;
- records B присутствуют;
- records A отсутствуют.

## T3 — Same temporal window

Для A и B использовать одинаковые:

`dateFrom`
`dateTo`

Ожидается:

- различие dataset объясняется tenant/scope;
- temporal filtering одинаково применён;
- tenant boundary сохраняется.

## T4 — Broad range

У пользователя A установить максимально широкий разумный temporal range.

Ожидается:

- все доступные A records;
- ни одной B record.

## T5 — Known B record window

Выбрать временной диапазон, где заведомо есть B records.

Пользователь A делает запрос.

Ожидается:

- B record count = 0 в ответе;
- никакие aggregate/KPI значения не раскрывают B data.

## T6 — URL/query manipulation

Пользователь A меняет:

- `dateFrom`;
- `dateTo`;
- порядок параметров;
- URL вручную.

Ожидается:

- tenant A remains A;
- B не появляется.

---

# 8. Direct API Proof

Для выбранного registry выполнить прямые authenticated API requests.

Для каждого:

- authenticated identity;
- role;
- tenant/scope;
- endpoint;
- query;
- HTTP status;
- returned row identifiers/count;
- request id.

Нужно иметь возможность показать, что один и тот же endpoint и temporal window дают разные, но корректно scoped datasets для A и B.

---

# 9. Browser Proof

Если registry имеет UI, выполнить также authenticated browser proof:

### User A
- открыть registry;
- применить temporal range;
- убедиться, что видны только A records.

### User B
- открыть тот же registry;
- тот же temporal range;
- убедиться, что видны только B records.

### A broad range
- расширить period;
- убедиться, что B records не появляются.

Browser evidence не заменяет API proof.

---

# 10. Positive vs Negative Security Proof

Разделить evidence:

### Positive
Пользователь имеет permission и получает собственные tenant-scoped records.

### Negative
Пользователь не получает чужие tenant records.

Для `A` требуется **оба**.

Один только `403` для PARTNER/BUYER не является достаточным tenant-isolation proof.

---

# 11. KPI / Aggregate Safety

Если выбранный D8 registry имеет KPI/aggregate:

- проверить KPI для A;
- проверить KPI для B;
- сравнить с row dataset;
- убедиться, что aggregate A не включает B;
- проверить broad temporal range.

Не переопределять бизнес-семантику KPI.

Проверяется только scope correctness.

---

# 12. Test Automation

По возможности добавить test-only fixture и автоматизированный integration/e2e test.

Минимальная автоматизация должна проверять:

```text
tenant A + valid dates
=> authorized + A only

tenant B + valid dates
=> authorized + B only

tenant A + B-only temporal window
=> 0 B rows

tenant A + broad range
=> A only

tenant B + broad range
=> B only
```

Если существующая test infrastructure не поддерживает это без production changes, не ломать инфраструктуру. Зафиксировать limitation.

---

# 13. Validation

После fixture setup выполнить:

- relevant D8 focused tests;
- new tenant-isolation test(s), если добавлены;
- existing authorization tests;
- backend typecheck;
- production build;
- relevant frontend tests/build, если UI fixture использует frontend;
- `git diff --check`.

Не исправлять unrelated failures.

---

# 14. Evidence Report

Создать:

`docs/reports/PHASE_3_D8_TENANT_ISOLATION_EVIDENCE_REPORT.md`

Структура:

## 14.1 Executive Summary

Какой gap был обнаружен и какой proof теперь получен.

## 14.2 Tenant/Scope Architecture Used

Фактически использованная existing model с ссылками на code/fixtures.

## 14.3 Fixture

Описание:

- Tenant A;
- Tenant B;
- Users;
- Roles;
- Permissions;
- Shared temporal window;
- Records.

## 14.4 API Evidence

Таблица T1–T6:

| Case | Identity | Tenant | Query | Status | Rows | Expected Scope | Actual Scope | Result |
|---|---|---|---|---|---|---|---|---|

## 14.5 Browser Evidence

Routes/screens and observed results.

## 14.6 KPI / Aggregate Evidence

Если применимо.

## 14.7 Automated Tests

Suites / test names / counts / result.

## 14.8 Security Conclusion

Явно подтвердить:

`temporal filter is additive to tenant/policy scope`

или доказать проблему, если она найдена.

## 14.9 Limitations

Только реальные ограничения.

---

# 15. Git Rules

После работы:

```bash
git status
git diff --check
git diff --stat
git diff --name-only
git log -1 --oneline
git rev-parse HEAD
git rev-parse origin/<branch>
```

Проверить, что production authorization/temporal code не изменён.

Если изменялись только test fixtures/tests/report:

- commit;
- push;
- подтвердить final SHA;
- подтвердить `HEAD == origin/<branch>`;
- clean working tree.

---

# 16. Exit Criteria

Эта задача считается успешно выполненной только если:

- существующая tenant/scope model доказана;
- найдена корректная fixture strategy;
- Tenant A и Tenant B имеют легитимный доступ к одному D8 registry;
- temporal window пересекается;
- A получает только A;
- B получает только B;
- broad range не нарушает scope;
- B-only temporal window не раскрывает B пользователю A;
- URL/query manipulation не меняет tenant scope;
- API evidence сохранён;
- browser evidence выполнен, если UI существует;
- production authorization code не изменён;
- report создан;
- Git closure выполнен.

---

# 17. Критическое правило результата

В конце **не ставить D8 CLOSED**.

Допустимые результаты этой задачи:

### EVIDENCE READY

Положительная tenant-isolation fixture и reproducible proof получены.

или

### EVIDENCE GAP — BLOCKED

Не удалось получить fixture без изменения production authorization/model.

После `EVIDENCE READY` следующая отдельная задача:

**PHASE 3 — D8 SECURITY / TENANT FINAL RE-QUALIFICATION**

Она должна использовать полученное evidence и вынести окончательный:

**VERDICT A — D8 CLOSED**

или

**VERDICT B — VALID SYSTEM FAIL**

или

**VERDICT C — IMPLEMENTATION DEFECT**

Следующий roadmap stage до этого не выбирается.
