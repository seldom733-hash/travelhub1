import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { IdsService } from "../shared/ids.service";
import { CrmService } from "../modules/crm/crm.service";
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  type PermissionCode,
} from "./permissions.constants";
import { RoleCode, UserStatus } from "../generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationDomainError } from "../shared/errors";
import { normalizeEmail } from "../shared/field-validation";
import { buildSortClause } from '../shared/sort';
import { getRequestContext } from "../shared/request-context";
import type { Prisma } from "../generated/prisma/client";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? "Administrator";

/**
 * SecurityModule (Phase 2, RBAC Matrix Baseline 1.3):
 *  - владелец security.* (User/Role/Permission/AuditLog);
 *  - канонический набор ролей ADMIN..BUYER + granular permissions;
 *  - seed ролей/прав выполняется при старте (идемпотентно, через upsert);
 *  - аудит действий безопасности (AuditLog).
 */
@Injectable()
export class SecurityService implements OnModuleInit {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly crm: CrmService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedRoles();
    await this.seedAdmin();
    // НЕ выполняем legacy Buyer↔Customer reconciliation при старте (review
    // Step 1.9): runtime startup backfill не нужен — новые BUYER всегда
    // получают Customer внутри registration orchestration (AuthService.register).
    // Legacy repair — отдельная явная idempotent command (dry-run/report):
    //   POST /api/v1/users/reconcile-buyer-customers  (см. repairBuyerCustomers).
  }

  /** Создание канонических ролей и прав (идемпотентно). */
  private async seedRoles(): Promise<void> {
    const roles = Object.values(RoleCode);
    for (const code of roles) {
      await this.prisma.role.upsert({
        where: { code },
        update: {},
        create: { code, title: ROLE_TITLES[code] },
      });
    }

    const existing = await this.prisma.permission.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((p) => p.code));
    const missing = ALL_PERMISSIONS.filter((c) => !existingCodes.has(c));
    if (missing.length > 0) {
      await this.prisma.permission.createMany({
        data: missing.map((code) => ({ code, description: PERMISSION_DESCRIPTIONS[code] ?? null })),
      });
    }

    // Step 3.2: RolePermission rows = persisted effective state.
    // Startup seed НЕ выполняет toAdd/toRevoke для RolePermission.
    // Default assignments создаются one-time Prisma migration.
    // Admin grant/revoke (Stage C) сохраняется между restarts.
    this.logger.log("RBAC roles/permissions seeded");
  }

  /** Создание администратора по умолчанию (идемпотентно). */
  private async seedAdmin(): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { username: ADMIN_USERNAME },
      select: { id: true },
    });
    if (existing) return;

    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } });
    const code = await this.ids.nextCode(this.prisma as unknown as Prisma.TransactionClient, "USR");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    try {
      await this.prisma.user.create({
        data: {
          code,
          username: ADMIN_USERNAME,
          passwordHash,
          fullName: ADMIN_FULL_NAME,
          status: UserStatus.ACTIVE,
          roleId: role.id,
        },
      });
      this.logger.log(`Seeded admin user '${ADMIN_USERNAME}' (role ADMIN)`);
    } catch (err: any) {
      // P2002 = unique constraint — another suite or concurrent init already created it.
      if (err?.code === "P2002") {
        // Re-verify: the admin user MUST exist after P2002.
        // If another field conflicted (not username), rethrow.
        const recheck = await this.prisma.user.findUnique({
          where: { username: ADMIN_USERNAME },
          select: { id: true },
        });
        if (recheck) {
          this.logger.log(`Admin user '${ADMIN_USERNAME}' already exists (P2002), skipping seed`);
          return;
        }
        // P2002 fired but admin not found — unexpected conflict, rethrow.
        throw err;
      }
      throw err;
    }
  }

  /** Права пользователя (из его роли). */
  async permissionsOf(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
    });
    return (user?.role?.permissions ?? []).map((rp) => rp.permission.code);
  }

  /** Проверка права у пользователя. */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.permissionsOf(userId);
    return perms.includes(permission);
  }

  private static readonly USER_SORT_ALLOWLIST: Record<string, string> = {
    code: 'code',
    username: 'username',
    email: 'email',
    fullName: 'fullName',
    status: 'status',
    lastLoginAt: 'lastLoginAt',
    createdAt: 'createdAt',
  };

  /** Список пользователей (ADMIN/DIRECTOR) — серверная пагинация. */
  async listUsers(query: { search?: string; status?: string; roleCode?: string; sortBy?: string; sortDirection?: string; page?: number; pageSize?: number; dateFrom?: string; dateTo?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.roleCode ? { role: { code: query.roleCode as any } } : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
              { fullName: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    // Date range filtering on createdAt (inclusive end-of-day)
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(new Date(query.dateTo).getTime() + 86400000 - 1) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: buildSortClause(query.sortBy, query.sortDirection, SecurityService.USER_SORT_ALLOWLIST, { createdAt: 'desc' }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          code: true,
          username: true,
          email: true,
          fullName: true,
          status: true,
          role: { select: { code: true, title: true } },
          partnerId: true,
          customerId: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    // KPI aggregates
    const [countActive, countInactive, countLocked] = await Promise.all([
      this.prisma.user.count({ where: { ...where, status: 'ACTIVE' as any } }),
      this.prisma.user.count({ where: { ...where, status: 'INACTIVE' as any } }),
      this.prisma.user.count({ where: { ...where, status: 'LOCKED' as any } }),
    ]);
    return { items, total, page, pageSize, aggregates: { active: countActive, inactive: countInactive, locked: countLocked } };
  }

  /** Смена роли пользователя (audit обязателен). */
  async assignRole(userId: string, roleCode: RoleCode, actorId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new NotFoundError(`Role ${roleCode} not found`);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError(`User ${userId} not found`);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { roleId: role.id, version: { increment: 1 } } });
      await this.audit(tx, {
        userId: actorId,
        username: null,
        action: "user.role_changed",
        resource: "User",
        resourceId: user.id,
        details: { fromRole: user.roleId, toRole: role.code, username: user.username },
      });
    });
  }

  /** Смена статуса пользователя (lock/unlock). */
  async setStatus(userId: string, status: UserStatus, actorId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError(`User ${userId} not found`);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status, version: { increment: 1 } } });
      await this.audit(tx, {
        userId: actorId,
        username: null,
        action: "user.status_changed",
        resource: "User",
        resourceId: user.id,
        details: { from: user.status, to: status, username: user.username },
      });
    });
  }

  /**
   * Запись в журнал аудита. Может выполняться в рамках транзакции вызывающего
   * (передать tx) либо отдельной записью (tx опущен).
   *
   * Step 1.15 §10: если активен request context — в details безопасно добавляется
   * ссылка { requestId, correlationId } для связи AuditLog с logs/outbox chain.
   * Это reference, а не event store: AuditLog остаётся журналом действий.
   */
  async audit(
    tx: Prisma.TransactionClient | undefined,
    entry: {
      userId?: string | null;
      username?: string | null;
      action: string;
      resource?: string | null;
      resourceId?: string | null;
      details?: Record<string, unknown>;
      ip?: string | null;
    },
  ): Promise<void> {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    const ctx = getRequestContext();
    // Step 1.15: correlation — безопасный reference в details (только когда
    // контекст активен). Без details и без контекста — SQL NULL (как раньше),
    // никакой пустой object/backfill.
    const correlation = ctx ? { correlation: { requestId: ctx.requestId, correlationId: ctx.correlationId } } : undefined;
    const details: Prisma.InputJsonValue | undefined =
      entry.details || correlation ? ({ ...(entry.details ?? {}), ...(correlation ?? {}) } as Prisma.InputJsonValue) : undefined;
    await client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        username: entry.username ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        resourceId: entry.resourceId ?? null,
        ...(details !== undefined ? { details } : {}),
        ip: entry.ip ?? null,
      },
    });
  }

  /**
   * Step 1.9 (Clarification §7, review fix) — ЯВНАЯ idempotent migration/repair
   * command для legacy BUYER без валидного customerId. НЕ вызывается из
   * runtime lifecycle (onModuleInit): новые BUYER всегда получают Customer в
   * registration orchestration, поэтому startup backfill не нужен.
   *
   * Контракт (сохраняет все требования Clarification):
   *  - deterministic matching: link только по нормализованному email
   *    (однозначный Customer.email UNIQUE);
   *  - no guessing: BUYER без email — skippedNoEmail (нет канонического ключа),
   *    Customer «наугад» не создаётся;
   *  - ambiguous match → NO auto-merge: имя/телефон не являются ключом связи;
   *  - broken reference: customerId указывает на несуществующий Customer —
   *    однозначно мёртвая ссылка (не guessing), очищается и ремонтируется по
   *    email в том же прогоне;
   *  - transaction safety: create + link одной транзакцией на пользователя
   *    (нет окна «Customer создан, User не связан»);
   *  - dry-run/report: при dryRun=true выполняются ТОЛЬКО чтения и возвращается
   *    отчёт { scanned, linked, created, skippedNoEmail, brokenRefs, dryRun }
   *    без каких-либо изменений;
   *  - audit: реальный прогон аудируется вызывающим (контроллер пишет AuditLog
   *    с полным результатом).
   */
  async repairBuyerCustomers(dryRun = false): Promise<{
    scanned: number;
    linked: number;
    created: number;
    skippedNoEmail: number;
    brokenRefs: number;
    dryRun: boolean;
  }> {
    const buyers = await this.prisma.user.findMany({
      where: { role: { code: RoleCode.BUYER } },
      select: { id: true, username: true, email: true, customerId: true },
    });
    let linked = 0;
    let created = 0;
    let skippedNoEmail = 0;
    let brokenRefs = 0;
    for (const b of buyers) {
      // Уже валидная связь (Customer существует) — пропускаем.
      if (b.customerId) {
        const exists = await this.prisma.customer.findUnique({ where: { id: b.customerId }, select: { id: true } });
        if (exists) continue;
        // Мёртвая ссылка: Customer не существует (однозначно). Чистим и ремонтируем.
        brokenRefs += 1;
        if (!dryRun) {
          await this.prisma.user.update({ where: { id: b.id }, data: { customerId: null } });
        }
      }
      if (!b.email) {
        skippedNoEmail += 1; // без email нет канонического ключа — no guessing
        continue;
      }
      const email = normalizeEmail(b.email);
      const linkedCustomer = await this.prisma.customer.findUnique({ where: { email }, select: { id: true } });
      if (linkedCustomer) {
        linked += 1;
        if (!dryRun) {
          await this.prisma.user.update({ where: { id: b.id }, data: { customerId: linkedCustomer.id } });
        }
        continue;
      }
      created += 1;
      if (!dryRun) {
        // Create + link ОДНОЙ транзакцией через CRM-owned command.
        await this.prisma.$transaction(async (tx) => {
          const { customerId } = await this.crm.ensureCustomerForBuyer(tx, { email, actorUserId: b.id });
          await tx.user.update({ where: { id: b.id }, data: { customerId } });
        });
      }
    }
    if (!dryRun && buyers.length > 0) {
      this.logger.log(
        `Buyer↔Customer repair: scanned=${buyers.length} linked=${linked} created=${created} skippedNoEmail=${skippedNoEmail} brokenRefs=${brokenRefs}`,
      );
    }
    return { scanned: buyers.length, linked, created, skippedNoEmail, brokenRefs, dryRun };
  }

  /** Создание пользователя персонала (ADMIN). */
  async createStaff(input: {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    roleCode: RoleCode;
    partnerId?: string;
    customerId?: string;
  }): Promise<{ id: string; code: string; username: string }> {
    if (input.password.length < 8) {
      throw new ValidationDomainError("Password must be at least 8 characters");
    }
    const existing = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictError(`Username '${input.username}' already taken`);
    const role = await this.prisma.role.findUnique({ where: { code: input.roleCode } });
    if (!role) throw new NotFoundError(`Role ${input.roleCode} not found`);

    const code = await this.ids.nextCode(this.prisma as unknown as Prisma.TransactionClient, "USR");
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        code,
        username: input.username,
        email: input.email ?? null,
        passwordHash,
        fullName: input.fullName ?? null,
        status: UserStatus.ACTIVE,
        roleId: role.id,
        partnerId: input.partnerId ?? null,
        customerId: input.customerId ?? null,
      },
      select: { id: true, code: true, username: true },
    });
  }
}

const ROLE_TITLES: Record<RoleCode, string> = {
  ADMIN: "Администратор",
  DIRECTOR: "Директор",
  FINANCE: "Финансы",
  MARKETER: "Маркетолог",
  ANALYST: "Аналитик",
  MODERATOR: "Модератор",
  SALES_MANAGER: "Менеджер продаж",
  OPERATOR: "Оператор",
  PARTNER: "Партнёр",
  BUYER: "Покупатель",
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  "communication.read": "Чтение communications (internal staff, cross-domain context)",
  "communication.create": "Создание communication по business context (internal staff)",
  "communication.read_own": "Чтение собственных communications (BUYER/PARTNER own-scope)",
  "account.profile.read": "Чтение собственного профиля/аккаунта (own-scope)",
  "account.profile.update": "Обновление собственного профиля (own-scope)",
  "partner.onboarding.read_own": "Чтение собственной PartnerApplication (own-scope)",
  "partner.onboarding.update_own": "Редактирование собственной PartnerApplication (own-scope)",
  "partner.onboarding.submit_own": "Отправка собственной PartnerApplication на review",
  "partner.onboarding.review": "Review очереди PartnerApplication (start/approve/reject/request changes)",
  "seller_public_profile.read_own": "Чтение собственного PublicSellerProfile/предложений (own-scope)",
  "seller_public_profile.propose": "Создание/редактирование/отправка предложения публичной идентичности (own-scope)",
  "storefront.read_own": "Чтение собственной Partner Storefront (own-scope)",
  "storefront.create_own": "Создание собственной Partner Storefront (own-scope, explicit provisioning)",
  "storefront.update_own": "Редактирование собственной Partner Storefront (own-scope)",
  "storefront.activate_own": "Активация/деактивация собственной Partner Storefront (own-scope)",
  "storefront.entitlement.manage": "Управление Storefront entitlement (операционная команда; граница будущего Billing domain)",
  "seller_public_profile.review": "Review очереди предложений публичной идентичности",
  "seller_public_profile.approve_alias": "Утверждение VERIFIED_ALIAS (alias продавца)",
  "seller_public_profile.approve_brand": "Утверждение PUBLIC_BRAND (реальный бренд)",
  "seller_public_profile.request_changes": "Запрос изменений в предложении публичной идентичности",
  "seller_public_profile.hide_identity": "Скрытие/восстановление публичной идентичности продавца",
  "catalog.product.read": "Чтение продуктов",
  "catalog.product.read_for_moderation": "Чтение продуктов для модерации",
  "catalog.product.write": "Создание/изменение продуктов",
  "catalog.product.publish": "Публикация/архивация продукта",
  "catalog.product.submit_moderation": "Отправка продукта на модерацию",
  "catalog.product.create_own": "Создание собственного draft Product (PARTNER)",
  "catalog.product.update_own_draft": "Редактирование собственного draft Product (PARTNER)",
  "catalog.product.read_own": "Чтение собственных продуктов (PARTNER)",
  "catalog.product.channels_own": "Управление каналами публикации собственного Product (own-scope)",
  "catalog.service_unit.publish": "Публикация/архивация Service Unit (Catalog publication authority, гейт: Product PUBLISHED)",
  "catalog.category.write": "Управление категориями",
  "catalog.category_schema.read": "Чтение Category Schema (конфигурации категорий)",
  "catalog.category_schema.write": "Управление Category Schema (только ADMIN)",
  "catalog.category_schema.read_active_for_product_edit": "Чтение ACTIVE Category Schema для формы создания Product (PARTNER)",
  "catalog.availability.write": "Управление availability",
  "catalog.media.upload_own": "Загрузка media собственного Product",
  "catalog.media.update_own": "Обновление media собственного Product",
  "catalog.media.delete_own": "Удаление media собственного Product",
  "catalog.media.reorder_own": "Изменение порядка media собственного Product",
  "catalog.media.set_primary_own": "Назначение primary image собственного Product",
  "catalog.media.read_for_moderation": "Чтение media для модерации",
  "crm.customer.read": "Чтение клиентов",
  "crm.customer.write": "Создание/изменение клиентов",
  "crm.contact.write": "Управление контактами",
  "crm.company.write": "Управление компаниями",
  "crm.partner.write": "Управление партнёрами",
  "crm.supplier.write": "Управление поставщиками",
  "crm.customer.read_own": "Чтение собственных CRM-отношений (partner own-scope)",
  "crm.customer.create_own": "Прямое добавление клиента/лида в собственный CRM (partner intake)",
  "crm.customer.update_own": "Обновление собственных CRM-отношений (lifecycle/tags/notes)",
  "order.read": "Чтение заказов",
  "order.accept": "Принятие заказа в работу",
  "order.edit_noncritical": "Редактирование некритичных данных заказа",
  "order.request_booking": "Передача заказа в Booking",
  "order.suspend": "Приостановка заказа",
  "order.cancel": "Отмена заказа",
  "order.close": "Закрытие заказа",
  "booking.read": "Чтение бронирований",
  "booking.send_supplier": "Отправка запроса поставщику",
  "booking.confirm": "Подтверждение/отклонение бронирования",
  "booking.request_change": "Запрос изменения бронирования",
  "booking.cancel": "Отмена бронирования",
  "sales.lead.read": "Чтение лидов",
  "sales.lead.write": "Управление лидами",
  "sales.opportunity.read": "Чтение сделок",
  "sales.opportunity.write": "Управление сделками",
  "sales.quote.read": "Чтение КП",
  "sales.quote.write": "Управление КП",
  "sales.quote.approve": "Согласование КП",
  "sales.sale.read": "Чтение продаж",
  "sales.sale.write": "Управление продажами",
  "sales.sale.complete": "Завершение продажи",
  "sales.kpi.read": "Чтение агрегированного Sales read model (KPI, count-based)",
  "sales.checkout.read": "Чтение checkout commercial intent context",
  "sales.checkout.write": "Управление checkout commercial intent context",
  "finance.payment.read": "Чтение платежей",
  "finance.payment.write": "Управление платежами",
  "finance.refund.read": "Чтение возвратов",
  "finance.refund.approve": "Согласование возвратов",
  "finance.dispute.read": "Чтение споров",
  "finance.dispute.write": "Управление спорами (открытие/закрытие)",
  "finance.invoice.read": "Чтение счетов",
  "finance.invoice.write": "Выставление счетов",
  "finance.commission.read": "Чтение комиссий",
  "finance.commission.write": "Управление комиссиями",
  "finance.commission.manage": "Управление Commission Policy (master data, Step 2.14E)",
  "finance.currency.manage": "Управление валютами",
  "finance.exchange_rate.manage": "Управление курсами",
  "finance.tax.manage": "Управление налогами",
  "support.read": "Чтение поддержки",
  "support.write": "Обработка поддержки",
  "documents.read": "Чтение документов",
  "documents.write": "Управление документами",
  "settings.read": "Чтение настроек",
  "settings.write": "Управление настройками",
  "audit.read": "Чтение аудита",
  "analytics.read": "Чтение аналитики",
  "reports.read": "Чтение отчётов",
  "moderation.review": "Ревью модерации",
  "moderation.approve": "Одобрение модерации",
  "moderation.reject": "Отклонение модерации",
  "moderation.request_changes": "Запрос изменений в модерации",
  "dashboard.executive.read": "Чтение Executive KPIs (GMV, Revenue, Orders, Bookings, AOV, Conversion)",
  "dashboard.operational.read": "Чтение Operational KPIs (Orders Fulfilled, Bookings Confirmed, Funnel)",
  "dashboard.financial.read": "Чтение Financial KPIs (Commission, Reconciliation, Payments)",
  "dashboard.marketplace.read": "Чтение Marketplace KPIs (Sessions, Partners, Customers)",
  "dashboard.customize": "Настройка layout Command Center (save/reset)",
  "operational-notes.read": "Чтение operational notes",
  "operational-notes.create": "Создание operational notes",
  "operational-notes.update": "Редактирование operational notes",
  "operational-notes.delete": "Удаление operational notes (soft-delete)",
};
