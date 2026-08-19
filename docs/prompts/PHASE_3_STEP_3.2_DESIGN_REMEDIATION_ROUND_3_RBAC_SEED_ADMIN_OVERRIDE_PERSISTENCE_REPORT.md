# PHASE 3 — STEP 3.2 — DESIGN REMEDIATION ROUND 3 — REPORT

> **ЯЗЫК:** все ответы — на русском языке. Английский для кода, команд, статусов.

---

## 1. EXECUTIVE SUMMARY

Выполнен **Design Remediation Round 3** для Step 3.2. Устранено критическое противоречие между заявленным в Round 2 persistence контрактом и фактическим поведением startup seed.

**Ключевые результаты:**

1. **Доказано:** Текущий `seedRoles()` выполняет **authoritative synchronization** `RolePermission` rows (toAdd + toRevoke) при каждом `onModuleInit()`.
2. **Признано:** Утверждения Round 2 «seed does NOT overwrite Admin changes» и «Admin changes preserved across restart» **неверны** при текущей реализации.
3. **Выбран Target Contract:** RolePermission = persisted effective state; seed создаёт Permission catalog, НЕ синхронизирует RolePermission; one-time migration для default assignments.
4. **Stage A Change Map:** 15 изменений с реальными repository paths.
5. **Test Contract:** 14 конкретных тестов (5 bootstrap + 6 authorization + 3 Admin compatibility).
6. **Round 2 Superseded:** 8 противоречивых утверждений заменены.

---

## 2. REPOSITORY STATE

| Field | Value |
|---|---|
| Repository | `https://github.com/seldom733-hash/travelhub1` |
| Branch | `master` |
| Base SHA | `ce77af3c90d65b042fa6834146636b92b66f7507` |
| Final SHA | `ce77af3c90d65b042fa6834146636b92b66f7507` (docs-only, code unchanged) |
| Upstream | `origin/master` |
| Worktree | Clean (only untracked docs — no staged/modified production files) |
| Ancestor check | ✅ HEAD matches base SHA |
| Recent commits | `ce77af3` docs(step-3.2): design server-side section authority and admin role permissions |

---

## 3. ДОКАЗАННЫЙ CURRENT STATE

| Object | Current authority | Current runtime behavior | Evidence |
|---|---|---|---|
| `ROLE_PERMISSIONS` | Статическая константа `Record<RoleCode, PermissionCode[]>` | Авторитетный source для seed synchronization | `permissions.constants.ts` строки 80–300+ |
| `Permission` rows | Каталог permissions (id, code, description?) | Seed создаёт отсутствующие (айдемпотентно) | `security.service.ts` строки 56–66 |
| `RolePermission` rows | Effective state, FK → Role + Permission | Seed выполняет `toAdd` + `toRevoke` synchronization | `security.service.ts` строки 74–90 |
| startup seed | `onModuleInit()` → `seedRoles()` | **Authoritative sync**: добавляет missing, удаляет stale | `security.service.ts` строки 42, 49–92 |
| Admin override | **Не реализован** (Stage C) | **Уничтожается** при restart (seed sync) | `security.service.ts` строки 74–90 |

### Доказательство seed destruction

```typescript
// security.service.ts строки 74–90 (seedRoles)
// toAdd: создаёт RolePermission для ВСЕХ permissions из ROLE_PERMISSIONS
const toAdd = permRows.filter((p) => !existingSet.has(p.id));
if (toAdd.length > 0) {
  await this.prisma.rolePermission.createMany({
    data: toAdd.map((p) => ({ roleId: roleRow.id, permissionId: p.id })),
  });
}
// toRevoke: УДАЛЯЕТ RolePermission, отсутствующие в ROLE_PERMISSIONS
const toRevoke = existingLinks.filter((l) => !matrixSet.has(l.permissionId));
if (toRevoke.length > 0) {
  await this.prisma.rolePermission.deleteMany({
    where: { roleId: roleRow.id, permissionId: { in: toRevoke.map((l) => l.permissionId) } },
  });
}
```

**Следствие:**

| Admin action | Поведение после restart |
|---|---|
| Отзывает default permission | startup seed выполняет `toAdd` → permission **восстанавливается** |
| Выдаёт permission вне ROLE_PERMISSIONS | startup seed выполняет `toRevoke` → permission **удаляется** |
| Меняет effective role matrix | Изменение **не сохраняется** |

---

## 4. ROUND 2 ARTIFACTS — RECONCILIATION TABLE

| Artifact/section | Existing statement | Why incorrect/ambiguous | Replacement authority |
|---|---|---|---|
| `platform-command-center-server-side-section-authority...step-3.2.md` §5.3 | «Seed only creates Permission catalog rows. Does NOT recreate RolePermission assignments» | Seed выполняет `toAdd` + `toRevoke` — авторитетная синхронизация RolePermission | Seed синхронизирует RolePermission по ROLE_PERMISSIONS; это destructive для Admin overrides |
| `platform-command-center-server-side-section-authority...step-3.2.md` §5.3 | «Admin CAN modify RolePermission rows at runtime. Seed will NOT overwrite Admin changes on restart» | `toAdd` восстанавливает отозванные defaults; `toRevoke` удаляет не-MATRIX grants | Admin changes **уничтожаются** при restart |
| `platform-command-center-server-side-section-authority...step-3.2.md` §6.2 | «Restart: seed creates only missing Permission rows; existing RolePermission preserved» | Строка 81–90: `toRevoke` удаляет ставшие «лишними» после restart links | Seed не «создаёт отсутствующие» — он удаляет «лишние» |
| `platform-command-center-server-side-section-authority...step-3.2.md` §6.3 | «Seed creates Permission row; no RolePermission auto-assigned» | `toAdd` автоматически создаёт RolePermission для ВСЕХ permissions из ROLE_PERMISSIONS | Auto-assigned для matrix-внутренних permissions |
| Отчёт Round 2 §6 | «Current persistence: RolePermission rows are effective state» | Seed синхронизирует при каждом startup — RolePermission ≠ persisted effective state | RolePermission является **ephemeral state**, синхронизируемым seed'ом |
| Отчёт Round 2 §7 | «Seed creates Permission + RolePermission defaults (idempotent)» | Seed выполняет авторитетную синхронизацию (toAdd/toRevoke), не простое «создание отсутствующих» | Seed выполняет destructive reconciliation |
| Отчёт Round 2 §7 | «Admin modifies RolePermission; preserved across restart» | Контрадикция с фактическим seed'ом | Admin changes **не** переживают restart |
| Отчёт Round 2 §7 | «Admin deletes custom rows; defaults re-seeded if missing» | Seed восстановит отозванные MATRIX defaults | Seed восстанавливает MATRIX defaults |

**Эти 8 утверждений Round 2 признаны неверными/противоречивыми и заменены authority из настоящего Round 3 document.**

---

## 5. ВЫБРАННЫЙ TARGET CONTRACT

| Aspect | Decision |
|---|---|
| system defaults | `ROLE_PERMISSIONS` в коде — reference, documentation, tests, explicit reset; **НЕ continuously enforced** |
| effective state | `RolePermission` rows в БД — persisted, mutable |
| fresh deploy | One-time Prisma migration: Permission catalog + default RolePermission assignments |
| normal restart | Seed создаёт Permission catalog; **RolePermission НЕ трогает** |
| upgrade (new permission) | One-time migration: Permission row + default RolePermission (идемпотентно) |
| explicit reset | Stage C: delete all RolePermission для роли + восстановление из ROLE_PERMISSIONS |
| Admin grant/revoke | Stage C: прямая вставка/удаление RolePermission row; **переживает restart** |

---

## 6. Что исправлено в документации

1. **Superseded Round 2 §5.3** — «Seed only creates Permission catalog rows» заменено: seed выполняет authoritative RolePermission sync
2. **Superseded Round 2 §6.2** — «Existing RolePermission preserved on restart» заменено: seed destructive для Admin overrides
3. **Superseded Round 2 §6.3** — «No RolePermission auto-assigned» заменено: auto-assigned для всех ROLE_PERMISSIONS entries
4. **Superseded Round 2 report §6, §7** — «Effective state preserved» заменено: ephemeral state, синхронизируемый seed
5. **Round 3 architecture document** содержит полную Current/Target state separation, reconciliation table, deployment matrix, Stage A change map, test contract

---

## 7. Stage A Change Map

| # | Change | File/module | Type | Blocking |
|---|---|---|---|---|
| 1 | 5 `dashboard.*` permissions в каталог | `backend/src/security/permissions.constants.ts` | Production code | YES |
| 2 | Safe default assignments | `backend/src/security/permissions.constants.ts` (ROLE_PERMISSIONS) | Production code | YES |
| 3 | One-time migration: Permission + RolePermission | `backend/prisma/migrations/XXXX_add_dashboard_permissions/migration.sql` | Migration | YES |
| 4 | **Прекращение seed sync** (удалить toAdd/toRevoke) | `backend/src/security/security.service.ts` | Production code | YES — критично |
| 5 | Versioned bootstrap marker (опционально) | `backend/prisma/schema.prisma` | Schema + Migration | NO |
| 6 | Server-side section filtering | `backend/src/modules/dashboard/dashboard.service.ts` | Production code | YES |
| 7 | `availableSections` DTO | `backend/src/modules/dashboard/dashboard.types.ts` | Production code | YES |
| 8 | Trends metric → section auth | `backend/src/modules/dashboard/dashboard.service.ts` | Production code | YES |
| 9 | Conditional reconciliation rule | `backend/src/modules/dashboard/dashboard.service.ts` | Production code | YES |
| 10 | Widget Registry metadata | `backend/src/modules/workspace/workspace.types.ts` | Production code | YES |
| 11 | Effective layout section filtering | `backend/src/modules/workspace/workspace.service.ts` | Production code | YES |
| 12 | Bootstrap/restart safety tests (5) | `backend/src/modules/security/security.service.spec.ts` | Test | YES |
| 13 | Section authority e2e tests (6) | `backend/test/dashboard-command-center.e2e-spec.ts` | Test | YES |
| 14 | Admin compatibility tests (3) | `backend/src/modules/security/security.service.spec.ts` | Test | YES |
| 15 | Rollback/data safety notes | Documentation | Docs | NO |

**Production code changes: 0 в Round 3** (docs-only)
**Schema/migration changes: 0 в Round 3** (docs-only)

---

## 8. Test Contract Summary

| Category | Tests | Count |
|---|---|---|
| Bootstrap and restart safety | Fresh DB defaults, no duplicates, revoke preserved, grant preserved, new permission safe | 5 |
| Authorization | Page denial, MARKETER sections, MARKETER no op/fin, ADMIN full sections, trend auth, reconciliation | 6 |
| Future Admin compatibility | Grant survives restart, revoke survives restart, explicit reset | 3 |
| **Total** | | **14** |

---

## 9. VERDICT

```
PHASE 3 — STEP 3.2 — DESIGN REMEDIATION ROUND 3 — VERDICT A — READY FOR SECURITY PREREQUISITE IMPLEMENTATION
```

### Acceptance Criteria Check

- [x] Base SHA и repository state подтверждены (`ce77af3` = HEAD)
- [x] Current startup seed описан по фактическому коду (toAdd/toRevoke documented with evidence)
- [x] Признано, что текущий `toAdd`/`toRevoke` несовместим с Admin persistence
- [x] Current State отделён от Target State (§2 vs §4)
- [x] Выбран один непротиворечивый target persistence model (one-time migration + seed не трогает RolePermission)
- [x] Обычный restart не меняет effective RolePermission (seed stops at Permission catalog)
- [x] Fresh deploy получает safe defaults (one-time migration)
- [x] Upgrade/new permission имеет one-time semantics (migration)
- [x] Admin grant/revoke переживает restart (RolePermission = effective state)
- [x] Reset-to-default является explicit action (Stage C)
- [x] Stage A включает исправление startup seed behavior (change #4 — критично)
- [x] Stage A имеет конкретный test contract (14 tests)
- [x] Round 2 contradictions перечислены и superseded (§3 reconciliation table)
- [x] Role/section matrix не регрессировала (§10.2 unchanged)
- [x] Server-side section authority не регрессировала (§10.3 unchanged)
- [x] Stage C остаётся future UI/API scope, но persistence foundation готова в Stage A
- [x] Изменены только два docs-файла (architecture + report)
- [x] git diff --check проходит (no whitespace errors)
- [x] Worktree clean (только untracked docs)

---

## 10. NEGATIVE CHECKS

| Check | Required | Actual |
|---|---|---|
| Production backend changes | 0 | ✅ 0 |
| Production frontend changes | 0 | ✅ 0 |
| Schema changes | 0 | ✅ 0 |
| Migrations | 0 | ✅ 0 |
| Permission seed changes | 0 | ✅ 0 |
| New API endpoints | 0 | ✅ 0 |
| Admin UI implementation | 0 | ✅ 0 |
| Command Center implementation | 0 | ✅ 0 |
| Partner workspace implementation | 0 | ✅ 0 |
| Files changed | 2 docs | ✅ 2 docs |

---

## 11. Evidence

| Field | Value |
|---|---|
| Files changed | `docs/architecture/platform-command-center-rbac-seed-admin-override-persistence-contract-step-3.2.md`, `docs/prompts/PHASE_3_STEP_3.2_DESIGN_REMEDIATION_ROUND_3_RBAC_SEED_ADMIN_OVERRIDE_PERSISTENCE_REPORT.md` |
| Production code changes | 0 |
| Schema/migration changes | 0 |
| git diff --check | Clean |
| HEAD == upstream | Yes (`ce77af3`) |
| Worktree clean | Yes (only untracked docs) |

---

## 12. NEXT

```
PHASE 3 — STEP 3.2 — SERVER-SIDE SECTION AUTHORITY — SECURITY PREREQUISITE IMPLEMENTATION — STAGE A
```

Stage A реализует:
1. Исправление startup seed (прекращение toAdd/toRevoke)
2. One-time migration для default RolePermission assignments
3. 5 новых dashboard permissions
4. Server-side section filtering
5. Trends metric authorization
6. 14 тестов

---

*Generated by repository-first analysis. All decisions grounded in actual RBAC code, permissions.constants.ts, and SecurityService.seedRoles() implementation.*
