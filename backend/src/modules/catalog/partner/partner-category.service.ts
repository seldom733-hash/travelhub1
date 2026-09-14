import { Injectable, Logger } from "@nestjs/common";
import { EntityStatus } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotFoundError } from "../../../shared/errors";
import type { AuthUser } from "../../../security/auth/auth.service";
import { RoleCode } from "../../../generated/prisma/enums";

/**
 * Partner Active Service Categories — partner-scoped набор категорий,
 * в которых партнёр имеет право создавать Products.
 *
 * Модель: Master Category → Partner Active Category capability.
 * Ссылается на canonical Category (НЕ копирует).
 *
 * Lifecycle:
 * - onboarding approve → syncFromApplication (creates from PartnerApplication.serviceCategories)
 * - partner cabinet → add/remove
 * - backend enforcement → isActiveCategory check in createProduct
 */
@Injectable()
export class PartnerCategoryService {
  private readonly logger = new Logger(PartnerCategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List active categories for a partner.
   * Returns categories with their display info.
   */
  async getActiveCategories(partnerId: string) {
    const records = await this.prisma.partnerActiveCategory.findMany({
      where: { partnerId, status: EntityStatus.ACTIVE },
      include: { category: { select: { id: true, code: true, slug: true, title: true, status: true } } },
      orderBy: { activatedAt: "asc" },
    });
    return records.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      category: r.category,
      activatedAt: r.activatedAt,
    }));
  }

  /**
   * Check if a category is active for a partner.
   * Used by CatalogService.createProduct() for enforcement.
   */
  async isActiveCategory(partnerId: string, categoryId: string): Promise<boolean> {
    const record = await this.prisma.partnerActiveCategory.findUnique({
      where: { partnerId_categoryId: { partnerId, categoryId } },
    });
    return record !== null && record.status === EntityStatus.ACTIVE;
  }

  /**
   * Add an active category for a partner.
   * Idempotent: if already active, returns existing record.
   */
  async addActiveCategory(partnerId: string, categoryId: string, actor: AuthUser) {
    // Verify category exists and is ACTIVE
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.status !== EntityStatus.ACTIVE) {
      throw new NotFoundError(`Category ${categoryId} not found or not ACTIVE`);
    }

    const existing = await this.prisma.partnerActiveCategory.findUnique({
      where: { partnerId_categoryId: { partnerId, categoryId } },
    });

    if (existing && existing.status === EntityStatus.ACTIVE) {
      return existing; // already active
    }

    if (existing && existing.status === EntityStatus.INACTIVE) {
      // Reactivate
      const updated = await this.prisma.partnerActiveCategory.update({
        where: { id: existing.id },
        data: { status: EntityStatus.ACTIVE, activatedAt: new Date(), deactivatedAt: null },
      });
      this.logger.log(`Partner ${partnerId} reactivated category ${categoryId} (by ${actor.username})`);
      return updated;
    }

    const created = await this.prisma.partnerActiveCategory.create({
      data: { partnerId, categoryId, status: EntityStatus.ACTIVE, activatedAt: new Date() },
    });
    this.logger.log(`Partner ${partnerId} added category ${categoryId} (by ${actor.username})`);
    return created;
  }

  /**
   * Remove (deactivate) an active category for a partner.
   * Soft delete: sets status=INACTIVE, deactivatedAt=now().
   * Does NOT delete products in this category.
   */
  async removeActiveCategory(partnerId: string, categoryId: string, actor: AuthUser) {
    const existing = await this.prisma.partnerActiveCategory.findUnique({
      where: { partnerId_categoryId: { partnerId, categoryId } },
    });

    if (!existing || existing.status !== EntityStatus.ACTIVE) {
      throw new NotFoundError(`Active category ${categoryId} not found for partner ${partnerId}`);
    }

    const updated = await this.prisma.partnerActiveCategory.update({
      where: { id: existing.id },
      data: { status: EntityStatus.INACTIVE, deactivatedAt: new Date() },
    });
    this.logger.log(`Partner ${partnerId} removed category ${categoryId} (by ${actor.username})`);
    return updated;
  }

  /**
   * Check if partner has existing products in a category.
   * Used for UI warning when removing a category.
   */
  async hasProductsInCategory(partnerId: string, categoryId: string): Promise<boolean> {
    const count = await this.prisma.product.count({
      where: { partnerId, categoryId },
    });
    return count > 0;
  }

  /**
   * Sync active categories from onboarding application.
   * Called during PartnerApplication.approveApplication().
   * Creates PartnerActiveCategory records from application.serviceCategories.
   */
  async syncFromApplication(partnerId: string, serviceCategories: string[], actorId: string) {
    if (!serviceCategories || serviceCategories.length === 0) {
      this.logger.log(`No service categories to sync for partner ${partnerId}`);
      return [];
    }

    const created = [];
    for (const slug of serviceCategories) {
      const category = await this.prisma.category.findUnique({ where: { slug } });
      if (!category) {
        this.logger.warn(`Category slug "${slug}" not found during onboarding sync for partner ${partnerId}`);
        continue;
      }

      const existing = await this.prisma.partnerActiveCategory.findUnique({
        where: { partnerId_categoryId: { partnerId, categoryId: category.id } },
      });

      if (!existing) {
        const record = await this.prisma.partnerActiveCategory.create({
          data: { partnerId, categoryId: category.id, status: EntityStatus.ACTIVE, activatedAt: new Date() },
        });
        created.push(record);
      } else if (existing.status === EntityStatus.INACTIVE) {
        await this.prisma.partnerActiveCategory.update({
          where: { id: existing.id },
          data: { status: EntityStatus.ACTIVE, activatedAt: new Date(), deactivatedAt: null },
        });
      }
    }

    this.logger.log(`Synced ${created.length} categories for partner ${partnerId} from onboarding`);
    return created;
  }
}
