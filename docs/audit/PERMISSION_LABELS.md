# Отображаемые названия разрешений

Технические коды ниже — стабильные идентификаторы RBAC/БД; они не изменялись.
Отображаемые названия задаются централизованно в `frontend/lib/permission-labels.ts`.

Всего: **184** разрешения.

## Личный кабинет

| Технический код | Отображаемое название |
|---|---|
| `account.profile.read` | Просмотр собственного профиля |
| `account.profile.update` | Изменение собственного профиля |
| `account.order.read_own` | Просмотр собственных заказов |
| `account.booking.read_own` | Просмотр собственных бронирований |
| `account.payment.read_own` | Просмотр собственных платежей |
| `account.document.read_own` | Просмотр собственных документов |
| `account.support.read_own` | Просмотр собственных обращений в поддержку |

## Аналитика

| Технический код | Отображаемое название |
|---|---|
| `analytics.read` | Просмотр аналитики |

## Аудит

| Технический код | Отображаемое название |
|---|---|
| `audit.read` | Просмотр журнала аудита |

## Бронирования

| Технический код | Отображаемое название |
|---|---|
| `booking.read` | Просмотр бронирований |
| `booking.send_supplier` | Отправка запроса поставщику |
| `booking.confirm` | Подтверждение и отклонение бронирований |
| `booking.request_change` | Запрос изменения бронирования |
| `booking.cancel` | Отмена бронирований |
| `booking.return_to_order` | Возврат бронирования в заказ |

## Каталог

| Технический код | Отображаемое название |
|---|---|
| `catalog.dictionary.propose` | Предложение нового типа или вида в справочник |
| `catalog.product.read` | Просмотр турпродуктов |
| `catalog.product.read_for_moderation` | Просмотр турпродуктов на модерации |
| `catalog.product.write` | Создание и изменение турпродуктов |
| `catalog.product.publish` | Публикация и архивация турпродуктов |
| `catalog.product.submit_moderation` | Отправка турпродукта на модерацию |
| `catalog.product.create_own` | Создание собственных турпродуктов |
| `catalog.product.update_own_draft` | Изменение собственных черновиков турпродуктов |
| `catalog.product.read_own` | Просмотр собственных турпродуктов |
| `catalog.product.channels_own` | Управление каналами публикации собственных турпродуктов |
| `catalog.service_unit.publish` | Публикация и архивация услуг |
| `catalog.rate_plan.publish` | Архивация и активация тарифных планов |
| `catalog.category.write` | Управление категориями |
| `catalog.category_schema.read` | Просмотр схем категорий |
| `catalog.category_schema.write` | Управление схемами категорий |
| `catalog.category_schema.read_active_for_product_edit` | Просмотр активных схем категорий при редактировании турпродукта |
| `catalog.availability.write` | Управление доступностью |
| `catalog.media.upload_own` | Загрузка медиа собственных турпродуктов |
| `catalog.media.update_own` | Изменение медиа собственных турпродуктов |
| `catalog.media.delete_own` | Удаление медиа собственных турпродуктов |
| `catalog.media.reorder_own` | Изменение порядка медиа собственных турпродуктов |
| `catalog.media.set_primary_own` | Выбор главного изображения собственного турпродукта |
| `catalog.media.read_for_moderation` | Просмотр медиа на модерации |

## Коммуникации

| Технический код | Отображаемое название |
|---|---|
| `communication.read` | Просмотр внутренних сообщений |
| `communication.create` | Создание сообщений по бизнес-контексту |
| `communication.read_own` | Просмотр собственных сообщений |
| `communication.write_own` | Ведение собственных предпродажных диалогов |

## Клиенты и партнёры

| Технический код | Отображаемое название |
|---|---|
| `crm.activity.read` | Просмотр истории взаимодействий с клиентами и партнёрами |
| `crm.customer.read` | Просмотр клиентов |
| `crm.customer.write` | Создание и изменение клиентов |
| `crm.contact.write` | Управление контактами |
| `crm.company.write` | Управление компаниями |
| `crm.partner.read` | Просмотр партнёров |
| `crm.partner.write` | Управление партнёрами |
| `crm.supplier.write` | Управление поставщиками |
| `crm.customer.read_own` | Просмотр собственных клиентов |
| `crm.customer.create_own` | Добавление клиентов и лидов в собственный CRM |
| `crm.customer.update_own` | Изменение собственных клиентов, тегов и заметок |

## Рабочий стол

| Технический код | Отображаемое название |
|---|---|
| `dashboard.executive.read` | Просмотр ключевых показателей для руководства |
| `dashboard.operational.read` | Просмотр операционных показателей |
| `dashboard.financial.read` | Просмотр финансовых показателей |
| `dashboard.marketplace.read` | Просмотр показателей маркетплейса |
| `dashboard.catalog.read` | Просмотр состояния каталога |
| `dashboard.channels.read` | Просмотр показателей каналов продаж |
| `dashboard.attention.read` | Просмотр задач, требующих внимания |
| `dashboard.insights.read` | Просмотр ленты рекомендаций и рисков |
| `dashboard.customize` | Настройка рабочего стола |

## Документы

| Технический код | Отображаемое название |
|---|---|
| `documents.read` | Просмотр документов |
| `documents.write` | Управление документами |

## Финансы

| Технический код | Отображаемое название |
|---|---|
| `finance.payment.read` | Просмотр платежей |
| `finance.payment.write` | Управление платежами |
| `finance.payment.create` | Создание платежей |
| `finance.payment.manage` | Подтверждение, отмена и завершение платежей |
| `finance.refund.read` | Просмотр возвратов |
| `finance.refund.write` | Создание возвратов |
| `finance.refund.approve` | Согласование возвратов |
| `finance.refund.execute` | Исполнение возвратов |
| `finance.dispute.read` | Просмотр споров |
| `finance.dispute.write` | Управление спорами |
| `finance.invoice.read` | Просмотр счетов |
| `finance.invoice.write` | Выставление счетов |
| `finance.commission.read` | Просмотр комиссий |
| `finance.commission.write` | Управление комиссиями |
| `finance.commission.manage` | Управление политикой комиссий |
| `finance.currency.manage` | Управление валютами |
| `finance.exchange_rate.manage` | Управление курсами валют |
| `finance.tax.manage` | Управление налогами |
| `finance.fx_rate.read` | Просмотр курсов поставщиков к AZN |
| `finance.fx_rate.manage` | Управление курсами поставщиков к AZN |
| `finance.obligation.read` | Просмотр обязательств поставщиков |
| `finance.obligation.manage` | Управление обязательствами поставщиков |
| `finance.supplier_payout.read` | Просмотр выплат поставщикам |
| `finance.supplier_payout.manage` | Создание выплат поставщикам |
| `finance.supplier_payment.confirm` | Подтверждение исполнения платежа поставщику |
| `finance.overview.read` | Просмотр финансовой сводки |
| `finance.ledger.read` | Просмотр финансовых проводок |
| `finance.provider_fee.read` | Просмотр комиссий провайдеров |
| `finance.settlement.read` | Просмотр расчётов |
| `finance.payout.read` | Просмотр выплат |

## География

| Технический код | Отображаемое название |
|---|---|
| `geography.read` | Просмотр географического справочника |
| `geography.create` | Создание записей географического справочника |
| `geography.update` | Изменение записей географического справочника |
| `geography.delete` | Удаление записей географического справочника |

## Гостиничный справочник

| Технический код | Отображаемое название |
|---|---|
| `hotel_directory.read` | Просмотр гостиничного справочника |
| `hotel_directory.create` | Создание записей гостиничного справочника |
| `hotel_directory.update` | Изменение записей гостиничного справочника |
| `hotel_directory.delete` | Удаление записей гостиничного справочника |

## Маркетинг

| Технический код | Отображаемое название |
|---|---|
| `marketing.read` | Просмотр маркетинговых данных |
| `marketing.campaign.read` | Просмотр маркетинговых кампаний |
| `marketing.campaign.create` | Создание маркетинговых кампаний |
| `marketing.campaign.update` | Изменение маркетинговых кампаний |
| `marketing.campaign.delete` | Удаление маркетинговых кампаний |
| `marketing.audience.read` | Просмотр маркетинговых аудиторий |
| `marketing.audience.manage` | Управление маркетинговыми аудиториями |
| `marketing.attribution.read` | Просмотр маркетинговых атрибуций |
| `marketing.attribution.manage` | Управление маркетинговыми атрибуциями |

## Модерация

| Технический код | Отображаемое название |
|---|---|
| `moderation.review` | Рассмотрение на модерации |
| `moderation.approve` | Одобрение на модерации |
| `moderation.reject` | Отклонение на модерации |
| `moderation.request_changes` | Запрос изменений на модерации |

## Рабочие заметки

| Технический код | Отображаемое название |
|---|---|
| `operational-notes.read` | Просмотр рабочих заметок |
| `operational-notes.create` | Создание рабочих заметок |
| `operational-notes.update` | Изменение рабочих заметок |
| `operational-notes.delete` | Удаление рабочих заметок |

## Заказы

| Технический код | Отображаемое название |
|---|---|
| `order.read` | Просмотр заказов |
| `order.accept` | Принятие заказа в работу |
| `order.edit_noncritical` | Изменение некритичных данных заказа |
| `order.request_booking` | Передача заказа в бронирование |
| `order.suspend` | Приостановка заказа |
| `order.cancel` | Отмена заказов |
| `order.close` | Закрытие заказов |

## Партнёры

| Технический код | Отображаемое название |
|---|---|
| `partner.onboarding.read_own` | Просмотр собственной заявки партнёра |
| `partner.onboarding.update_own` | Изменение собственной заявки партнёра |
| `partner.onboarding.submit_own` | Отправка заявки партнёра на рассмотрение |
| `partner.onboarding.review` | Рассмотрение заявок партнёров |

## Цены и наценки

| Технический код | Отображаемое название |
|---|---|
| `pricing.markup.read` | Просмотр правил наценки и матрицы наценок |
| `pricing.markup.manage` | Управление правилами наценки |

## Отчёты

| Технический код | Отображаемое название |
|---|---|
| `reports.read` | Просмотр отчётов |

## Заявки и предложения

| Технический код | Отображаемое название |
|---|---|
| `reverse.capability.read_own` | Просмотр собственных коммерческих возможностей продавца |
| `reverse.capability.write_own` | Управление собственными коммерческими возможностями продавца |
| `reverse.request.read_own` | Просмотр собственных заявок покупателя |
| `reverse.request.write_own` | Создание и изменение собственных заявок покупателя |
| `reverse.match.run` | Запуск подбора и распределения заявок покупателей |
| `reverse.distribution.read_own` | Просмотр распределённых собственных заявок покупателя |
| `reverse.proposal.read_own` | Просмотр собственных предложений продавца |
| `reverse.proposal.write_own` | Создание и изменение собственных предложений продавца |
| `reverse.proposal.select_own` | Выбор предложения продавца по собственной заявке |

## Продажи

| Технический код | Отображаемое название |
|---|---|
| `sales.lead.read` | Просмотр лидов |
| `sales.lead.write` | Управление лидами |
| `sales.opportunity.read` | Просмотр сделок |
| `sales.opportunity.write` | Управление сделками |
| `sales.quote.read` | Просмотр коммерческих предложений |
| `sales.quote.write` | Управление коммерческими предложениями |
| `sales.quote.approve` | Согласование коммерческих предложений |
| `sales.sale.read` | Просмотр продаж |
| `sales.sale.write` | Управление продажами |
| `sales.sale.complete` | Завершение продаж |
| `sales.kpi.read` | Просмотр сводных показателей продаж |
| `sales.checkout.read` | Просмотр контекста оформления заказа |
| `sales.checkout.write` | Управление контекстом оформления заказа |
| `sales.discount.grant` | Предоставление индивидуальной скидки |

## Публичные профили продавцов

| Технический код | Отображаемое название |
|---|---|
| `seller_public_profile.read_own` | Просмотр собственного публичного профиля продавца |
| `seller_public_profile.propose` | Предложение публичной идентичности продавца |
| `seller_public_profile.review` | Рассмотрение предложений публичной идентичности |
| `seller_public_profile.approve_alias` | Утверждение псевдонима продавца |
| `seller_public_profile.approve_brand` | Утверждение публичного бренда продавца |
| `seller_public_profile.request_changes` | Запрос изменений публичной идентичности |
| `seller_public_profile.hide_identity` | Скрытие и восстановление публичной идентичности продавца |

## Настройки

| Технический код | Отображаемое название |
|---|---|
| `settings.read` | Просмотр настроек |
| `settings.write` | Управление настройками |

## Витрины партнёров

| Технический код | Отображаемое название |
|---|---|
| `storefront.read_own` | Просмотр собственной витрины партнёра |
| `storefront.create_own` | Создание собственной витрины партнёра |
| `storefront.update_own` | Изменение собственной витрины партнёра |
| `storefront.activate_own` | Активация и деактивация собственной витрины партнёра |
| `storefront.entitlement.manage` | Управление доступом к витринам партнёров |

## Поставщики

| Технический код | Отображаемое название |
|---|---|
| `supplier.search.read` | Просмотр поиска и предложений поставщиков |
| `supplier.search.manage` | Синхронизация и управление кэшем поставщиков |

## Поддержка

| Технический код | Отображаемое название |
|---|---|
| `support.read` | Просмотр обращений в поддержку |
| `support.write` | Обработка обращений в поддержку |
| `support.case.create` | Создание обращений в поддержку |
| `support.case.read` | Просмотр обращений в поддержку |
| `support.case.update` | Изменение обращений в поддержку |
| `support.case.assign` | Назначение обращений в поддержку исполнителю |
| `support.case.delete` | Удаление обращений в поддержку |

## WhatsApp

| Технический код | Отображаемое название |
|---|---|
| `whatsapp.read` | Просмотр WhatsApp-интеграции |
| `whatsapp.send` | Отправка сообщений в WhatsApp |
| `whatsapp.send.recover` | Повторная отправка сообщений в WhatsApp |
| `whatsapp.manage` | Управление WhatsApp-интеграцией |
| `whatsapp.session.admin` | Администрирование сессии WhatsApp |

