import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../security/auth/auth.service";
import { RoleCode } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";

/**
 * CatalogAccessPolicy (Phase 1 Step 1.3) — единый, переиспользуемый объектный
 * scope Product/ProductMedia (PARTNER object scope).
 *
 * Инвариант:
 *   PARTNER → только свои Product (product.partnerId == actor.partnerId);
 *   MODERATOR → только moderation-read (read_for_moderation), без write за PARTNER;
 *   ADMIN    → НЕ bypass ownership автоматически — действует через explicit
 *              permissions (проверяются guard-ом + здесь как defense in depth);
 *   staff (DIRECTOR/…) → catalog.product.read (внутренний read).
 *
 * ProductMedia НЕ имеет независимого владельца: ownership наследуется через
 * Product.partnerId (ProductMedia.productId → Product.partnerId).
 *
 * Используется и CatalogService (Product CRUD/list), и ProductMediaService
 * (upload/list/preview/update/delete/replace/set-primary/reorder) — object scope
 * нельзя обойти, вызвав сервис из другого модуля напрямую.
 */
@Injectable()
export class CatalogAccessPolicy {
  /** Object scope PARTNER: partnerId актора, либо null (staff/ADMIN/внутренние вызовы). */
  partnerScopeOf(actor: AuthUser | undefined): string | null {
    return actor && actor.role === RoleCode.PARTNER ? (actor.partnerId ?? null) : null;
  }

  /** PARTNER является владельцем продукта? */
  isOwner(actor: AuthUser | undefined, productPartnerId: string | null): boolean {
    return actor?.role === RoleCode.PARTNER && productPartnerId !== null && actor.partnerId === productPartnerId;
  }

  /** Write/manage access: PARTNER — только свои; ADMIN — да (permission проверяется отдельно); иначе — нет. */
  canManage(actor: AuthUser, productPartnerId: string | null): boolean {
    if (actor.role === RoleCode.ADMIN) return true;
    return this.isOwner(actor, productPartnerId);
  }

  /**
   * Assert write/manage + explicit permission (defense in depth).
   * permission — granular permission (напр. catalog.media.upload_own); для PARTNER
   * решает object scope, для ADMIN — наличие explicit permission.
   */
  assertCanManage(actor: AuthUser, productPartnerId: string | null, permission?: string): void {
    if (permission && !actor.permissions.includes(permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    if (!this.canManage(actor, productPartnerId)) {
      throw new ForbiddenException("Access to this product is not allowed (object scope)");
    }
  }

  /** Read access: владелец-PARTNER, moderation-read (MODERATOR) или staff read (catalog.product.read). */
  canRead(actor: AuthUser, productPartnerId: string | null): boolean {
    if (this.isOwner(actor, productPartnerId)) return true;
    if (
      actor.permissions.includes("catalog.product.read_for_moderation") ||
      actor.permissions.includes("catalog.media.read_for_moderation")
    ) {
      return true;
    }
    return actor.permissions.includes("catalog.product.read");
  }

  /** Assert read. actor undefined (внутренний системный вызов) — пропускаем scope. */
  assertCanRead(actor: AuthUser | undefined, productPartnerId: string | null): void {
    if (!actor) return;
    if (!this.canRead(actor, productPartnerId)) {
      throw new ForbiddenException("Access to this product is not allowed (object scope)");
    }
  }

  /**
   * Server-side list scope: PARTNER видит ТОЛЬКО свои Product (count/total тоже).
   * Применяется ДО filter/sort/pagination — saved filters не могут расширить scope.
   *
   * Step 1.10: PARTNER без partnerId (pending onboarding / сломанная связь) НЕ
   * получает unrestricted список — ему возвращается заведомо пустой scope
   * (не {}) — никакого чтения чужих/внутренних продуктов до approve.
   */
  productListScope(actor: AuthUser | undefined): Prisma.ProductWhereInput {
    if (actor?.role === RoleCode.PARTNER && !actor.partnerId) {
      return { id: "__no_partner_scope__" };
    }
    const scope = this.partnerScopeOf(actor);
    return scope ? { partnerId: scope } : {};
  }
}
