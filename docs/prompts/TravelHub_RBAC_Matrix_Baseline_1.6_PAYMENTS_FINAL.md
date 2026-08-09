# TravelHub --- RBAC Matrix — Baseline 1.6 PAYMENTS FINAL

> **Источник истины:** `TravelHub_Architecture_Master_Baseline_1.6_Marketplace_Payments_Final.docx`.
> При любом расхождении приоритет имеет Master. Изменение domain ownership, lifecycle, ID policy,
> event contract или RBAC допускается только через ADR с последующей синхронизацией всех файлов комплекта.


> Канонический RBAC. Не добавлять новые роли без изменения
> мастер-архитектуры.

## 1. Роли

  Role            Назначение
  --------------- ----------------------------------------------
  ADMIN           Администрирование платформы и конфигурации
  DIRECTOR        Управленческий контроль и расширенный read
  FINANCE         Финансовые операции и Finance master data
  MARKETER        Marketing
  ANALYST         Read-only аналитика и отчеты
  MODERATOR       Модерация marketplace/Catalog
  SALES_MANAGER   Lead/Opportunity/Quote/Sale
  OPERATOR        Order/Booking/Support operations
  PARTNER         Внешний партнер, только собственный scope
  BUYER           Внешний покупатель, только собственный scope

Не использовать `Booking Agent`, `Support Agent`, `Finance Officer`.

## 2. Базовая матрица

  -----------------------------------------------------------------------------------------------------------------------------------------------
  Resource       ADMIN          DIRECTOR      FINANCE   MARKETER    ANALYST     MODERATOR    SALES_MANAGER   OPERATOR     PARTNER      BUYER
  -------------- -------------- ------------- --------- ----------- ----------- ------------ --------------- ------------ ------------ ----------
  Catalog read   ✓              ✓             ✓         ✓           ✓           ✓            ✓               ✓            own/public   public

  Catalog write  config/admin   limited       ---       ---         ---         moderation   ---             ---          own draft    ---

  Sales          admin          read/manage   read      read        read        ---          write           linked read  ---          own
                                              finance   permitted                                                                      checkout
                                              context                                                                                  context

  CRM            admin          read          read      permitted   read        limited      permitted write permitted    own profile  own
                                                        segments                                             write                     profile

  Order          admin          read/manage   finance   ---         read        ---          linked read     write        permitted    own read
                 exception                    read                                                                        linked read  

  Booking        admin          read/manage   finance   ---         read        ---          linked read     write        permitted    own read
                 exception                    read                                                                        linked read  

  Finance        admin          read          write     ---         read        ---          linked read     linked read  own          own
                                                                                                                          permitted    read/pay

  Documents      admin          read          read      ---         read        ---          linked read     linked       own          own
                                                                                                             write/read                

  Support        admin          read          linked    ---         analytics   ---          linked read     write        own          own
                                              read                  read                                                               

  Moderation     admin          read          ---       ---         read        write        ---             ---          submit own   ---

  Settings       write          read          finance   marketing   read        read         read            read         ---          ---
                                              refs      refs                                                                           

  Audit/System   admin          read          limited   ---         analytics   ---          own-action read own-action   ---          ---
                                              read                  read                                     read                      
  -----------------------------------------------------------------------------------------------------------------------------------------------

`admin` не означает обход аудита или ownership.

## 3. Критические ограничения

### SALES_MANAGER

Может управлять Sales Center.

После `OrderRequested`:

-   linked Order read;
-   комментарий/approved request;
-   без универсального `order:write`;
-   без Booking commands;
-   без Finance write.


## 3.1 Catalog Product / Media / Moderation — обязательное разделение прав

### PARTNER

PARTNER имеет object scope только на собственные Catalog Product:

``` text
product.partnerId == currentPartnerId
media.product.partnerId == currentPartnerId
```

PARTNER может при наличии granular permission:

``` text
catalog.product.create_own
catalog.product.read_own
catalog.product.update_own_draft
catalog.product.submit_moderation
catalog.media.upload_own
catalog.media.update_own
catalog.media.delete_own
catalog.media.reorder_own
catalog.media.set_primary_own
```

PARTNER не может:

- редактировать чужой Product/media;
- самостоятельно выставлять канонический published state;
- approve/reject собственную модерацию;
- менять moderation decision;
- публиковать существенное изменение уже опубликованной версии в обход повторного moderation/publish workflow.

### MODERATOR

MODERATOR получает:

``` text
moderation.review
moderation.approve
moderation.reject
moderation.request_changes
catalog.product.read_for_moderation
catalog.media.read_for_moderation
```

MODERATOR **не получает** `catalog.product.write` или `catalog.media.write` для исправления содержимого за PARTNER.

Результат модерации применяется к конкретной проверенной версии/snapshot. Если PARTNER после approval существенно изменяет Product, цену/условия, category-specific content или media в пределах policy повторной модерации, публичная версия остается прежней до нового разрешенного publish transition.

### ADMIN

ADMIN может выполнять platform/admin operations только через явно определенные permissions. `ADMIN` не означает скрытый обход moderation history. Override, если разрешен policy, требует reason + audit.

### Public / BUYER

Anonymous/BUYER получают только published Product/media через public read contract. Draft, pending moderation, rejected и unpublished media не должны утекать через API, CDN URL policy или frontend state.


### OPERATOR

Основная операционная роль:

-   Order lifecycle;
-   Booking lifecycle;
-   Support cases;
-   linked CRM read/write в разрешенном объеме.

Не управляет Finance master data.

### FINANCE

Владеет операциями:

-   Payment;
-   Refund;
-   Invoice;
-   Commission;
-   Currency;
-   ExchangeRate;
-   Tax;
-   TaxRule.

### PARTNER

Object scope обязателен:

``` text
resource.partnerId == currentPartnerId
```

Исключения только через explicit platform permission.

### BUYER

Object scope:

``` text
resource.buyer/customer identity == current user identity
```

Никогда не доверять buyerId из request body без server-side validation.

## 4. Permission naming

Использовать granular permissions, например:

``` text
sales.lead.read
sales.lead.write
sales.quote.approve
sales.sale.complete

order.read
order.accept
order.edit_noncritical
order.request_booking
order.suspend
order.cancel
order.close

booking.read
booking.send_supplier
booking.confirm
booking.request_change
booking.cancel

finance.payment.read
finance.payment.write
finance.refund.approve
finance.currency.manage
finance.tax.manage

catalog.product.read
catalog.product.write
catalog.product.submit_moderation
catalog.product.publish
catalog.product.create_own
catalog.product.update_own_draft
catalog.media.upload_own
catalog.media.update_own
catalog.media.delete_own
catalog.media.reorder_own
catalog.media.set_primary_own

moderation.review
moderation.approve
moderation.reject
moderation.request_changes
catalog.product.read_for_moderation
catalog.media.read_for_moderation
```

Не заменять все одним `domain:write`.

## 5. Audit

Всегда аудитировать:

-   role/permission changes;
-   Sale completion;
-   Order status commands;
-   Booking confirm/change/cancel;
-   Payment/refund;
-   Currency/Tax changes;
-   moderation decisions;
-   Product/media submit-for-moderation and publish transitions;
-   primary-image changes on published Product;
-   admin moderation overrides;
-   manual overrides;
-   reopening closed Order;
-   admin exceptions.


## 6. Dashboard / Analytics / Reports

- `ANALYST` — read-only Analytics/Reports; не получает write к операционным доменам.
- `DIRECTOR` — management read, dashboard и разрешенные управленческие commands только явно.
- `DashboardLayout (DSH-*)` изменяется владельцем layout либо ADMIN в пределах policy.
- `MetricDefinition (MET-*)` изменяется только явно уполномоченной аналитической/административной ролью.
- `Report (RPT-*)` создается/исполняется в пределах доступа к исходным данным; экспорт не расширяет object scope.
- Drill-down из Dashboard/Analytics/Reports повторно проверяет permission на исходный объект.

## 7. System

System не получает отдельный business ID по Baseline. Доступ к Audit Log, logs, traces, DLQ, jobs, incidents и security events разделяется отдельными permissions. Replay/retry/override/acknowledge требуют причины и аудита.


## 8. Finance Marketplace Settlement Permissions

- `FINANCE` управляет Payment reconciliation, ProviderFee, Settlement, Payout, CommissionAccrual, ledger adjustments и refund operations через granular permissions.
- `PARTNER` читает только собственные settlement/payout statements, commission accruals и разрешенные payment summaries; не меняет ProviderFee, Commission policy или ledger.
- `BUYER` видит только собственные Payment/Refund и payment schedule; не видит partner settlement/commission.
- `ADMIN` не получает скрытого финансового bypass: manual adjustment/override требует отдельного permission, reason и audit.
- Bank/payout account access отделяется от обычного CRM read; секретные/полные банковские реквизиты не выдаются через generic Partner API.

### Settlement-mode access

- `SPLIT_AT_PAYMENT`: PARTNER видит собственную allocation/settlement summary, но не меняет platform commission/provider allocation.
- `PLATFORM_COLLECT`: PARTNER видит собственный payable/payout status; создание/retry Payout — FINANCE only.
- `PARTNER_COLLECT`: PARTNER видит собственный CommissionAccrual/amount due; ручное списание/корректировка — FINANCE only.
