import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { RoleCode } from "../../../generated/prisma/enums";
import { ForbiddenError, NotFoundError, ValidationDomainError } from "../../../shared/errors";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";
import type { AuthedRequest } from "../../../security/auth/jwt-auth.guard";
import { PartnerCategoryService } from "./partner-category.service";

/**
 * Partner Active Service Categories controller.
 *
 * PARTNER manages own active categories (add/remove).
 * Backend enforcement: CatalogService.createProduct() checks isActiveCategory().
 *
 * Security:
 * - only authenticated PARTNER (role checked)
 * - partnerId from actor context (never from body)
 * - own-scope only (IDOR protection)
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("partner")
export class PartnerCategoryController {
  constructor(private readonly partnerCategoryService: PartnerCategoryService) {}

  /** GET /api/v1/partner/active-categories — list partner's active service categories. */
  @Get("active-categories")
  @RequirePermissions("catalog.partner_active_category.read")
  async listActiveCategories(@CurrentUser() actor: AuthedRequest["user"]) {
    this.assertPartner(actor);
    return this.partnerCategoryService.getActiveCategories(actor.partnerId!);
  }

  /** POST /api/v1/partner/active-categories — add a category to partner's active set. */
  @Post("active-categories")
  @RequirePermissions("catalog.partner_active_category.manage")
  async addActiveCategory(
    @Body() body: { categoryId: string },
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    this.assertPartner(actor);
    if (!body.categoryId) {
      throw new ValidationDomainError("categoryId is required");
    }
    return this.partnerCategoryService.addActiveCategory(actor.partnerId!, body.categoryId, actor);
  }

  /** DELETE /api/v1/partner/active-categories/:categoryId — remove a category from partner's active set. */
  @Delete("active-categories/:categoryId")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("catalog.partner_active_category.manage")
  async removeActiveCategory(
    @Param("categoryId") categoryId: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    this.assertPartner(actor);
    const hasProducts = await this.partnerCategoryService.hasProductsInCategory(actor.partnerId!, categoryId);
    const result = await this.partnerCategoryService.removeActiveCategory(actor.partnerId!, categoryId, actor);
    return { ...result, hasProducts };
  }

  /** GET /api/v1/partner/active-categories/:categoryId/has-products — check if partner has products in category. */
  @Get("active-categories/:categoryId/has-products")
  @RequirePermissions("catalog.partner_active_category.read")
  async checkHasProducts(
    @Param("categoryId") categoryId: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    this.assertPartner(actor);
    const hasProducts = await this.partnerCategoryService.hasProductsInCategory(actor.partnerId!, categoryId);
    return { categoryId, hasProducts };
  }

  private assertPartner(actor: AuthedRequest["user"]) {
    if (actor.role !== RoleCode.PARTNER || !actor.partnerId) {
      throw new ForbiddenError("Only approved PARTNER can manage active categories");
    }
  }
}
