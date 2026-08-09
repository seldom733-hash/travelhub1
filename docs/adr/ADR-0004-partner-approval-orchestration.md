# ADR-0004: Partner approval — Security↔CRM orchestration contract (Step 1.10)

**Статус:** Принят · **Дата:** 2026-08-08
**Домен:** security.* (PartnerApplication/User) ↔ crm.* (Partner)
**Промпт:** `TravelHub_Phase_1_Step_1.10_Partner_Registration_Onboarding.md` §8/§15

## Контекст

Публичная регистрация PARTNER создаёт User (role PARTNER) + DRAFT
PartnerApplication. Активация продавца происходит ТОЛЬКО на approve:

```text
Approve ⇒ validate application ⇒ CRM Partner create-or-link ⇒ set User.partnerId
        ⇒ application APPROVED ⇒ Partner Cabinet enabled
```

Инвариант (Step 1.10 §7):

```text
Partner selling capabilities ⇒ approved onboarding ⇒ valid User.partnerId
⇒ existing CRM Partner
```

## Существующие правила

- **ADR-0001:** интеграция доменов — события + чтение по ID; домен пишет только
  в свою схему.
- **ADR-0002:** `security.*` владеет User/Role/Permission/AuditLog;
  `POST /auth/register` — самозапись.
- **ADR-0003:** синхронная orchestration Security↔CRM для **BUYER registration**
  — узкое исключение из ADR-0001. **Автоматически на PARTNER НЕ
  распространяется** (Step 1.10 §8): для Partner approval требуется ОТДЕЛЬНЫЙ
  разрешённый contract — настоящий ADR.

## Решение

Отдельное узкое исключение из ADR-0001 — **только для команды Partner approval**
(активация продавца), по тем же ownership-правилам, что ADR-0003, но как
самостоятельный contract:

```text
PartnerOnboardingService.approveApplication(id, reviewer)
  → tx:
      CAS: PartnerApplication IN_REVIEW → APPROVED (единственный победитель)
      → CrmService.createOrLinkPartner(tx, …)   // CRM-owned write в crm.Partner
      → set security.User.partnerId              // security пишет security.User
      → set PartnerApplication.partnerId (reference, retry-safe)
      → journal (PartnerApplicationHistory) + AuditLog
  → commit → publishPending (PartnerCreated → outbox)
```

Границы и гарантии:

1. **Узкий сценарий.** Контракт покрывает ТОЛЬКО approve (activation). ВСЕ
   остальные междоменные flows продолжают подчиняться ADR-0001 (события +
   чтение по ID) в полном объёме. Новый синхронный cross-domain orchestration
   вне этого сценария требует отдельного ADR.
2. **Ownership не нарушается.** Security пишет `security.*` (User,
   PartnerApplication, AuditLog); `crm.Partner` пишет ТОЛЬКО CRM-owned service
   (`CrmService.createOrLinkPartner`) — никаких `tx.partner.*` из security.
3. **Event-контракт сохраняется.** `PartnerCreated` пишется в outbox в той же
   транзакции и публикуется штатным `publishPending()` — подписчики работают
   как раньше.
4. **Deterministic create-or-link** (Step 1.10 §9): reuse только по
   authoritative business identifier (INDIVIDUAL → контактный email; COMPANY →
   регистрационный номер; DB partial unique). Merge по brand name запрещён;
   ambiguous → manual review (не guessing).
5. **Concurrency/idempotency** (§25): CAS по status (IN_REVIEW → решение) —
   только одно финальное решение побеждает; проигравший concurrent
   approve/reject получает 409 и НЕ доходит до создания Partner. Retry approve
   идемпотентен (APPROVED → no-op, без duplicate Partner). Duplicate Partner
   физически невозможен (partial unique + reuse).
6. **Self-approval protection** (§23): объектный конфликт reviewer.id ==
   applicant.userId → 403 (в т.ч. multi-role).
7. **Пользователь без активации не продаёт:** pending applicant (partnerId
   = null) заблокирован на создание Product (CatalogService gate) и не видит
   чужие продукты (пустой scope в list) — до approve.

## Обоснование

Approve должен быть атомарным: активировать продавца можно только вместе с
созданием/линковкой CRM Partner и установкой `User.partnerId` — иначе возникло
бы окно «APPROVED без Partner» (нарушение инварианта §7) или «Partner создан
без User-связи». Обе схемы в одной PostgreSQL БД — короткая транзакция
возможна без distributed transaction. Event-driven (Saga: APPROVED → событие →
CRM создаёт Partner → событие → security link) оставил бы eventual-consistency
окно, в котором APPROVED-заявка существует без действующей связи — прямо
противоречит инварианту и требованию «одно финальное решение» (§25).

Регистрация ≠ approval ≠ Product moderation ≠ Payment/KYC: регистрация
создаёт только DRAFT; активация (настоящий ADR) — только approve; модерация
продуктов — существующий Catalog/Moderation flow; Payment/KYC — отдельный
будущий финансовый этап (в Step 1.10 не реализуется).

## Последствия

- `PartnerOnboardingService.approveApplication` — единственная команда этого
  контракта; `AuthService.registerPartner` создаёт заявку без cross-domain
  write (security-only).
- Review queue (`/partner/onboarding/review`, permission
  `partner.onboarding.review`) — отдельный контур, НЕ смешивается с Product
  Moderation.
- При выносе CRM в отдельный сервис контракт заменяется на saga/outbox по
  существующему интерфейсу без изменения бизнес-кода.
- Тесты: `backend/test/partner-onboarding.e2e-spec.ts` (21 e2e) — lifecycle,
  review, IDOR, self-approval, concurrency (один победитель), retry approve,
  duplicate business identity, legacy PARTNER, аудит.

## Альтернативы

- **Только события (Saga)** — отклонено: окно неконсистентности
  (APPROVED без Partner/link) нарушает инвариант §7 и «одно финальное
  решение» §25.
- **Security пишет crm.Partner напрямую** — отклонено: нарушает ADR-0001
  ownership.
- **Создание Partner при регистрации** — отклонено: регистрация ≠ approval;
  привязало бы неодобренную заявку к CRM master data и требовало бы удаления
  при reject.
- **Применение ADR-0003 автоматически к PARTNER** — отклонено (Step 1.10
  §8): отдельный contract настоящим ADR.
