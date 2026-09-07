# PHASE 3 — UI-C2 — FINAL CLOSURE INSTRUCTION

## APPROVE ADDENDA — FINAL CLOSURE

Оба ранее выявленных evidence gaps принимаются.

### 1. Cardinality — PASS

Подтверждено:

```text
DB truth:
Order → Booking = 0..N

D5 / Current Canonical V1 presentation:
Order → Booking = 0..1

Selection:
earliest Booking, createdAt ASC
```

Это является сознательным V1 presentation limitation, а не дефектом UI-C2.

При Order с несколькими Booking:
- UI-C2 показывает один deterministic representative Booking;
- остальные Booking не удаляются и не теряются из canonical data model;
- отдельная N-node presentation является будущим scope.

### 2. Security — PASS

Принята runtime evidence matrix:

```text
same tenant                    → 200
role-limited                   → 200
missing permission             → 403
wrong tenant/workspace         → 404
direct access                  → deterministic
linked entity NOT_CREATED      → 200 + null relation
```

Подтверждено отсутствие cross-context existence leakage.

---

# FINAL CLOSURE RULES

Теперь:

1. Закоммить **только docs-only изменение** qualification report.
2. НЕ менять production code.
3. НЕ менять tests.
4. НЕ менять backend/domain/schema.
5. НЕ менять relation cardinality.
6. НЕ делать functional commits.
7. НЕ начинать следующий stage.

Изменение должно содержать только:
- cardinality evidence addendum;
- security runtime evidence addendum;
- необходимые qualification/provenance corrections.

---

# GIT HARD CLOSURE

После commit выполнить:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
git diff --check
```

Затем:

```bash
git push origin master
```

И повторно:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Требование:

```text
WORKTREE = CLEAN
HEAD == origin/master
```

Final SHA должен быть actual 40-character SHA.

---

# FINAL REPORT

Qualification report:

```text
docs/reports/PHASE_3_UI_C2_COMMERCE_RELATION_CHAIN_QUALIFICATION_REPORT.md
```

Должен содержать:

- cardinality addendum;
- security runtime addendum;
- provenance/evidence;
- documented pre-existing Vitest failure;
- final implementation SHA;
- final docs closure SHA where applicable;
- HEAD == origin/master;
- WORKTREE CLEAN.

Не переписывать историю.

Не делать reset/restore.

---

# FINAL VERDICT

При выполнении всех closure gates:

```text
PHASE 3 — UI-C2
COMMERCE RELATION CHAIN

VERDICT A — ACCEPTED
```

Итоговое состояние:

```text
D5                 ACCEPTED
D6                 ACCEPTED
D7                 ACCEPTED

UI-C1              ACCEPTED
UI-C1.1            ACCEPTED
UI-C1.2            ACCEPTED
UI-C1.2H.2         ACCEPTED
UI-C2              ACCEPTED

Finance Center     NOT STARTED
D8                 NOT STARTED
```

После final verdict:

```text
STOP
```

Следующий stage НЕ начинать в этом run.
