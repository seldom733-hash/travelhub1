import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { RoleCode } from "../../../generated/prisma/enums";
import { ForbiddenError, ValidationDomainError } from "../../../shared/errors";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";
import type { AuthedRequest } from "../../../security/auth/jwt-auth.guard";
import { CatalogService } from "../catalog.service";

/**
 * Partner-safe read surface (Step 1.8 clarification).
 *
 * PARTNER НЕ получает внутреннее `catalog.category_schema.read` (internal/admin
 * schema management) — только отдельное право
 * `catalog.category_schema.read_active_for_product_edit` и этот read-контракт для
 * dynamic Product form/editor (`/partner/products/new`, editor).
 *
 * Контракт отдаёт ТОЛЬКО ACTIVE Category Schema категории (editor-данные):
 *   - category id/code/slug/title;
 *   - активная версия schema (attributes: type/required/options/min/max/pattern);
 *   - availability/tariff/media requirements + pdpSections.
 * НЕ отдаёт: DRAFT/DEPRECATED схемы, версии по id, admin/internal metadata,
 * createdBy/audit-поля, raw Prisma-объект, storage keys.
 *
 * Безопасность:
 *   - только authenticated PARTNER (роль проверяется ЯВНО — ADMIN/MODERATOR/BUYER
 *     продолжают использовать свои существующие contracts);
 *   - schema write отсутствует (этот контроллер read-only);
 *   - чтение конкретной DRAFT/DEPRECATED версии через обход (?version=/&schemaId=)
 *     отклоняется (422) — контракт exposes только ACTIVE;
 *   - category должна быть ACTIVE и иметь ACTIVE schema (иначе neutral 404);
 *   - read НЕ требует Product ownership (schema категории нужна ДО создания Product).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("partner")
export class PartnerCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** GET /api/v1/partner/categories/:slug/schema — ACTIVE schema для Product editor. */
  @Get("categories/:slug/schema")
  @RequirePermissions("catalog.category_schema.read_active_for_product_edit")
  getEditorSchema(
    @Param("slug") slug: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    if (actor.role !== RoleCode.PARTNER) {
      throw new ForbiddenError("Only PARTNER can use the partner editor schema contract");
    }
    // Endpoint не поддерживает выбор конкретной версии/схемы — только ACTIVE
    // категории. Обход через version/schemaId → deny (не 404-нейтральный, а явный).
    if (query.version !== undefined || query.schemaId !== undefined) {
      throw new ValidationDomainError(
        "Versioned schema access is not supported; the partner editor contract exposes the ACTIVE schema only",
      );
    }
    return this.catalog.getActiveCategorySchemaForProductEdit(slug);
  }
}
