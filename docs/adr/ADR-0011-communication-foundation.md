# ADR-0011: Communication Foundation — canonical cross-domain Communication model (Step 1.16)

- **Status:** Accepted (Phase 1 Step 1.16)
- **Date:** 2026-08-09
- **Related:** ADR-0001 (modular monolith, cross-schema rules), ADR-0009 (correlation/request context), ADR-0010 (business event envelope), ADR-0007 (Partner CRM & acquisition boundary), ADR-0008 (behavioral instrumentation)

## Context

Roadmap: `Communication = CML-*` — cross-domain communication model для
CRM / Order / Booking / Support вместо legacy message fragments.

Inventory (Step 1.16 §2) показал: **legacy Message/ChatRoom/ChatMember таблиц в
проекте НЕТ**. `crm.Contact` — контактное лицо CRM (не communication);
`events.InboxEvent` — инфраструктура идемпотентности; `security.AuditLog` —
журнал действий; `catalog.StorefrontBehavioralEvent` /
`catalog.MarketplaceBehavioralEvent` — поведенческая телеметрия. Ни одна из них
не является communication-моделью и не может быть «переобъявлена» canonical без
нарушения владения.

Communication ссылается на CUSTOMER/PARTNER/ORDER/BOOKING — четыре разных
bounded context. Ни один существующий контекст не может владеть ею, не начав
владеть чужим lifecycle (CRM → владеет только клиентскими мастер-данными;
Order/Booking → владеют только своим lifecycle; security → identity/RBAC/audit;
catalog → product/storefront; events → инфраструктура).

## Decision

1. **Новый минимальный bounded context `communication.*`** (отдельная схема
   PostgreSQL, по конвенции проекта «одна схема = один домен»). Это
   единственный вариант без нарушения существующих границ владения: любое
   размещение в существующей схеме сделало бы её владельцем cross-domain
   модели. Решение аддитивно: существующие домены не меняются.

2. **Communication НЕ является** event bus, AuditLog, behavioral event store,
   Ticket/SupportCase. Она не пишет в чужие таблицы и не владеет
   Customer/Partner/Order/Booking lifecycle (Step 1.16 §3). Связь с бизнес-
   контекстами — **только typed context reference** `contextType + contextId`
   (БЕЗ cross-schema FK, ADR-0001; БЕЗ raw Prisma snapshot).

3. **Identity:** immutable `CML-*` code (атомарный `BusinessSequence`),
   генерируется сервером; клиент не может передать code/id/ownership.

4. **Semantics:**
   - `type` — MESSAGE (факт переписки/звонка) | NOTE (внутренняя заметка
     персонала, никогда не отдаётся BUYER/PARTNER, §36);
   - `channel` — только PLATFORM (EMAIL/PHONE/WHATSAPP не объявляются, пока
     TravelHub реально не отправляет/не принимает их — без имитации, §7);
   - `direction` — INBOUND/OUTBOUND/INTERNAL (для NOTE — INTERNAL);
   - `status` — ACTIVE/ARCHIVED: lifecycle самой Communication, НЕ Order/
     Booking/Lead/Support (§9). READ/DELIVERED не создаются (§43);
   - `occurredAt`/`createdAt` — server-side UTC; client-supplied occurredAt не
     принимается (§16/§17); `updatedAt` — только row-level tracking, никогда
     milestone (§16/§58);
   - actor (actorUserId) ≠ sender/recipient (§13): actor — кто совершил
     system action; participants — typed refs (USER/CUSTOMER/PARTNER/SYSTEM +
     canonical ID), без raw User/CRM copy (§12/§22).

5. **Correlation:** requestId/correlationId сохраняются из активного request
   context (Step 1.15, ADR-0009) как диагностическая reference — НЕ competing
   tracing model (§18).

6. **Business event:** `CommunicationCreated` **НЕ создаётся** — нет реального
   consumer-а (§19): создание Communication — значимый факт, но без потребителя
   event taxonomy «на будущее» запрещена. Если появится реальный consumer —
   событие добавляется в canonical registry (Step 1.15A envelope, ADR-0010) с
   payload из references/minimal metadata, БЕЗ body/PII (§21/§54).

7. **PII/data minimization (§21/§22):** body — единственное хранилище контента.
   Body не дублируется в AuditLog, Outbox, logs, errors. Не сохраняются raw
   Customer/Partner/User snapshot, email/phone (если не являются частью
   communication fact — на foundation не являются), IP, headers, auth data.

8. **Audit (§20):** create/status-transition мутации аудируются в
   `security.AuditLog` (action, actor, code, context refs) — БЕЗ body.

9. **Scope/RBAC (§31–§36):** узкие права `communication.read` (internal staff),
   `communication.create` (internal staff), `communication.read_own` (BUYER/
   PARTNER own-scope). BUYER видит только context=CUSTOMER==actor.customerId,
   PARTNER — context=PARTNER==actor.partnerId, и только не-NOTE/не-INTERNAL.
   Внутренние заметки BUYER/PARTNER не отдаются; forged contextId/participant/
   actor отклоняются server-side.

10. **Legacy boundary (§23/§24/§47):** legacy chat-таблиц нет; `/account/support`
    (Step 1.13) остаётся controlled empty — НЕ превращается в fake Support
    system (§30). No startup backfill (§25): новые records создаются только
    явным API.

## Consequences

- Communication готова связывать CRM/Order/Booking контексты без владения ими;
  будущий Support domain сможет ссылаться на CML-* records (Ticket lifecycle/
  SLA/assignee — НЕ в этой модели, §45).
- Один новый bounded context + одна таблица; аддитивная миграция; существующие
  домены не затронуты.
- Internal CRM note не становится buyer-visible communication (type=NOTE +
  visibility rules, §6/§36).
- Communication ≠ Notification (§44): email/push/SMS/templates/queues не
  реализуются.

---

# ADR-0011 Amendment (Step 1.16 STRICT REVIEW FIXES)

- **Status:** Accepted (Phase 1 Step 1.16 strict review)
- **Date:** 2026-08-09

## Context

Строгий review подтвердил ownership и base-модель, но потребовал закрыть
impersonation/authorization gaps и явно зафиксировать policy.

## Decisions (review fixes)

1. **Direction ↔ participant policy (impersonation closure, §7).** Internal staff
   могут фиксировать внешние факты «от имени» Customer/Partner ТОЛЬКО с
   сохранением actor (audit фиксирует внутреннего USER) и direction-валидацией:
   - NOTE (INTERNAL): sender — внутренний USER (по умолчанию actor), recipient
     отсутствует;
   - MESSAGE INBOUND: sender — внешняя сторона (CUSTOMER|PARTNER), recipient —
     внутренний USER (по умолчанию actor);
   - MESSAGE OUTBOUND: sender — внутренний USER (по умолчанию actor), recipient
     — внешняя сторона (CUSTOMER|PARTNER).
   Нарушение → 422. SYSTEM participant НЕ может быть задан через HTTP create
   (системные факты пока не создаются; SYSTEM — reserved).

2. **Participant ↔ context consistency (existence ≠ authorization, §6/§38).**
   CUSTOMER/PARTNER participants должны соответствовать контексту:
   - context CUSTOMER: CUSTOMER participant == contextId; PARTNER participant
     на CUSTOMER-контексте — mismatch (422);
   - context PARTNER: PARTNER participant == contextId; CUSTOMER — mismatch;
   - context ORDER: CUSTOMER == order.customerId; PARTNER — владелец продукта
     заказа (items → product.partnerId);
   - context BOOKING: CUSTOMER == booking→order.customerId; PARTNER — владелец
     booking.productId.
   Для ORDER/BOOKING без продуктов/товаров — skip (нет authoritative linkage,
   не угадываем). Нарушение → 422.

3. **Internal create scope (matrix).** `communication.create` — глобальный для
   staff-ролей (OPERATOR/SALES_MANAGER/ADMIN): TravelHub — централизованный
   оператор, персонал легитимно ведёт любые Customer/Order/Booking/Partner.
   Authorization = role-permission + server-side context existence +
   participant↔context consistency. BUYER/PARTNER create запрещены (403);
   MODERATOR/FINANCE и др. — без прав (403).

4. **Buyer/Partner own-scope limitation.** BUYER видит ТОЛЬКО context=CUSTOMER
   == actor.customerId; PARTNER — context=PARTNER == actor.partnerId (не-NOTE/
   не-INTERNAL). Communications по собственным ORDER/BOOKING BUYER/PARTNER
   СЕЙЧАС НЕ видят — intentional limitation foundation (extension point при
   появлении buyer-facing support/chat flow; linkage Order.customerId доказуем).

5. **ARCHIVED — reserved state.** `status=ARCHIVED` объявлен, но producer/
   endpoint отсутствуют (archive — future retention/privacy flow). Client forged
   status заблокирован (forbidden key). Не мёртвый lifecycle — явно
   документированный reserved state.

6. **Stale references.** Communication — historical record: БЕЗ FK, target
   (Customer/Order/Booking/Partner/User) может быть удалён/деактивирован —
   Communication и её участники не каскадятся и не уничтожаются (§35).
   Ограничение: хранятся canonical IDs, не snapshots — будущий display может
   показывать текущую identity, а не historical name (§36; snapshots не
   добавляются без need).

## Alternatives considered

- **Разместить в существующей схеме (crm/security/catalog)** — отклонено:
  сделало бы домен владельцем cross-domain модели или смешало с
  identity/audit/behavioral (нарушение §3).
- **events.Outbox как хранилище** — отклонено (communication ≠ business event;
  §19).
- **AuditLog как хранилище** — отклонено (AuditLog — журнал действий, §20/§66).
- **Legacy Chat → canonical** — неприменимо (таблиц нет; §23/§66).
- **CommunicationCreated event** — отложено до реального consumer (§19).
