# 0001 — ECC → DSH: curated skills, без hooks

- Статус: accepted
- Дата: 2026-11-23

## Контекст

ECC — зрелый набор инженерных практик, skills и hooks для Claude Code и других
harness. DSH использует другой lifecycle инструментов и hooks. Полная установка
ECC в DSH принесла бы непроверенные install-скрипты, hooks и MCP-конфигурации,
которые могут менять окружение и конфликтовать с текущими настройками.

## Решение

Берём из ECC только инженерный процесс и адаптируем его в пять проектных DSH
skills:

```text
navitravel-backend
navitravel-frontend
navitravel-verify
navitravel-security
navitravel-review
```

Hooks, AgentShield runtime, MCP, install-скрипты и marketplace lifecycle не
переносятся. Upstream пин и лицензия зафиксированы в
`tools/ecc-dsh/catalog.json` и `tools/ecc-dsh/NOTICE.md`.

## Последствия

Плюсы:

- нет исполнения стороннего install/hook-кода;
- навыки сразу доступны через проектный каталог `.agents/skills`;
- процесс можно менять под Navitravel;
- низкий контекстный overhead по сравнению с полным ECC.

Минусы:

- не будет полной parity с Claude Code hooks;
- обновления ECC нужно переносить вручную;
- skills не являются автоматическим enforcement — нужен Definition of Done.

## Альтернативы

1. Полная установка ECC в DSH — отклонено из-за несовместимого lifecycle и
   риска исполнения сторонних скриптов.
2. Использовать ECC только в Claude Code/Codex — возможно, но не даёт процесс
   внутри текущей DSH-сессии.
3. Ничего не внедрять — отклонено: повторяющиеся проблемы с проверкой,
   локализацией и финансовыми расчётами.
