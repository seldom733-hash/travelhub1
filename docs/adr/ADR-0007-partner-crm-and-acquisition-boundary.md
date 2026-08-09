# ADR-0007: Partner CRM Boundary, Customer Identity vs Relationship & Acquisition Sources

- **Status:** Accepted (Phase 1 Step 1.12.2)
- **Date:** 2026-08-09
- **Related:** ADR-0001 (modular monolith), ADR-0003 (Buyer↔Customer mapping), ADR-0006 (Storefront commercial model & channel boundary)

## Context

Storefront — платный SaaS-сайт PARTNER и будущий SaaS workspace, а не просто
страница. В будущих фазах paid Storefront получает Partner-scoped CRM (customers,
leads, notes, tags, lifecycle/stages, tasks/reminders, communications, customer
documents where permitted, repeat history, segmentation, assigned manager/team,
acquisition source, CRM analytics). Одновременно TravelHub имеет глобальную
идентичность `crm.Customer` (ADR-0003): один Customer может взаимодействовать с
несколькими Partner. Требуется зафиксировать границы ДО реализации: какие данные
глобальные, какие Partner-scoped, как устроено будущее acquisition-моделирование и
почему source нельзя вычислять задним числом.

## Decision

1. **Partner CRM — будущий Partner-scoped workspace, НЕ общая база.** Каждый Partner
   получает только собственную CRM-проекцию (свои leads/customers/notes/tags/
   lifecycle/tasks/manager/source/history). PARTNER **никогда** не получает общую
   CRM-базу TravelHub и чужие Customer/relationship данные. Внутренний `/app/crm`
   НЕ является Partner CRM и PARTNER-доступ к нему не выдаётся.

2. **Глобальная Customer identity ≠ Partner CRM relationship.** Одна и та же
   сущность: глобальный `crm.Customer` (identity, создаётся/link'ится по ADR-0003) и
   будущий `PartnerCustomerRelationship` (Partner-scoped: notes, tags, lifecycle,
   tasks, manager, source, history, documents). Partner-specific данные НЕ становятся
   глобальными Customer fields. Partner A не видит relationship-данные Partner B.
   Два понятия не смешиваются в одной модели; `Customer` остаётся CRM-owned,
   relationship — future Partner-scoped контракт.

3. **Acquisition source — first-class transaction context, не выводимый из Product.**
   Будущие sources: `MARKETPLACE`, `PARTNER_STOREFRONT`, `DIRECT`, позднее
   `MANUAL_CRM`. Source фиксируется в transaction/order context в момент сделки и НЕ
   вычисляется задним числом по Product (один canonical Product может быть
   опубликован в обоих каналах). Order/Sale/Payment на Step 1.12.2 не меняются;
   publication channel (`ProductPublicationChannel`) остаётся отдельным контрактом от
   acquisition channel.

4. **Analytics boundary (ссылка на ADR-0006 §8).** Analytics engine не реализуется.
   Сохраняются стабильные идентификаторы для будущих storefront views, product views,
   CTA/contact clicks, funnel, leads, conversions: `PartnerStorefront` (SF-*, slug),
   `Product` (P-*, slug), `ProductPublicationChannel`. Никаких событий analytics и
   persistence до Step 1.12.3+.

5. **Persistence сейчас не реализуется.** Ни Partner CRM, ни relationship-модель, ни
   acquisition-поля не добавляются в схему на Step 1.12.2. Этот ADR — roadmap-контракт
   для будущих фаз; реализация потребует отдельного ADR и явного разрешения.

## Consequences

- Storefront готов как будущий SaaS workspace: данные Partner остаются строго
  scoped, глобальная база недоступна PARTNER.
- Customer identity остаётся канонической и переиспользуемой между Partner;
  Partner-specific данные не «загрязняют» глобальный Customer.
- Acquisition-моделирование останется честным (source из transaction context), без
  ретроспективных догадок по Product/channel.
- Ранняя коммерческая граница (Marketplace commission vs Storefront SaaS) не
  смешивается с CRM-данными и acquisition.

## Alternatives considered

- **Partner CRM как глобальная CRM с ACL по Partner** — отклонено: риск утечки
  cross-Partner данных; shared schema поощряет coupling между конкурентами.
- **Relationship-поля прямо на `crm.Customer`** — отклонено: Partner A видел бы
  данные Partner B; смешение identity и relationship (запрещено §2).
- **Source, вычисляемый из Product publication** — отклонено: один Product в обоих
  каналах; некорректная атрибуция и комиссия.
