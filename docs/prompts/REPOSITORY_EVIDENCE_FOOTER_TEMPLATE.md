# REPOSITORY EVIDENCE FOOTER — TEMPLATE & USAGE

Документационная конвенция (prospective) для будущих implementation и
strict-review отчётов TravelHub. Лёгкая, machine-readable, без требований
невозможных значений.

Источник: `docs/prompts/TRAVELHUB_STEP_2.10B_STRICT_REVIEW_EVIDENCE_RECONSTRUCTION_AND_PROVENANCE_HARDENING.md`
(по результатам provenance-аудита и восстановления evidence Step 2.10B).

## 1. Стандартный footer

Каждый новый implementation/strict-review отчёт заканчивается блоком:

```text
REPOSITORY EVIDENCE
repository: <owner/repo или локальный canonical identity>
branch: <branch>
head: <sha или WORKTREE>
origin: <sha>
worktree_clean: true|false
migration_count: <N>
reviewed_state: COMMIT | WORKTREE
reviewed_diff_base: <sha>
reviewed_diff_head: <sha или WORKTREE>
persistence_status: NOT_PERSISTED | PERSISTED
persistence_sha: <sha или N/A>
```

Правила заполнения:

- `head` — `WORKTREE`, если ревью/отчёт выполнен на несохранённом рабочем дереве;
- `origin` — SHA `origin/master` на момент написания отчёта (или `N/A` при offline);
- `worktree_clean` — фактическое состояние `git status --short` на момент ревью
  (пусто → `true`);
- `reviewed_state` — `COMMIT`, если ревью выполнено на зафиксированном состоянии,
  иначе `WORKTREE`;
- `reviewed_diff_base/head` — диапазон просмотренного diff;
- `persistence_status` — `PERSISTED` только когда существует commit SHA,
  содержащий отревьюенные артефакты; иначе `NOT_PERSISTED` + `persistence_sha: N/A`.

## 2. Семантика статусов (status semantics hardening)

Текстовый `APPROVED` доказывает результат ревью, но НЕ Git-персистентность.
Разделять:

| Состояние | Формулировка | Условие |
|---|---|---|
| Implementation | `IMPLEMENTED IN WORKTREE` | код есть в рабочем дереве |
| Review | `STRICT REVIEW APPROVED IN WORKTREE` | ревью на несохранённом дереве |
| Persistence | `PERSISTED @ <SHA>` | коммит с артефактами существует |
| Remote (optional) | `PUSHED TO origin/<branch> @ <SHA>` | запушено |
| CI (optional) | `CI VERIFIED @ <SHA>` | CI-прогон зелёный |

Roadmap `✅ APPROVED` не подразумевает персистентность, если явно не записано
`PERSISTED @ <SHA>`.

## 3. Правило будущего одобрения (future approval rule)

> Текстовый вердикт `APPROVED` доказывает результат ревью, а не Git-персистентность.
> Шаг считается repository-persistent только когда записан commit SHA,
> содержащий отревьюенные артефакты.

Если ревью выполнено на грязном worktree — финальный ответ ревью обязан содержать:

`APPROVED IN WORKTREE — NOT YET PERSISTED`

пока не появится commit evidence.

## 4. Проверка существования артефактов (artifact existence check)

Перед тем как Roadmap ссылается на путь отчёта — путь обязан существовать.

Для каждого шага, помеченного APPROVED, проверяется:

- implementation report path существует;
- strict-review report path существует;
- упомянутый architecture doc существует;
- заявленная миграция существует (если заявлена);
- заявленный тест-файл существует (если заявлен).

Сейчас — manual/documented процесс; CI-автоматизация не входит в этот проход.

## 5. Scope

- Применяется **prospectively** (к новым шагам/отчётам). Массовый ретроактивный
  пересмотр исторических статусов — отдельная задача, требующая одобрения.
- Не изменяет verdicts, доменную логику, схему, миграции, тесты или CI.
