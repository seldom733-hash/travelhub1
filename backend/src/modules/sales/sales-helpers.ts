/**
 * Sales structural decomposition — shared validation helpers (ADR-0001).
 *
 * These cross-domain read-by-ID assertions are used by multiple collaborators
 * (SalesLifecycleService, SalesQuoteService, SalesService facade). Extracting
 * them avoids duplication while keeping the single-writer invariant.
 *
 * Wave 3 / Step 2.17C — behavior-preserving extraction.
 */
import { PrismaService } from "../../prisma/prisma.service";
import { RoleCode } from "../../generated/prisma/enums";
import { ValidationDomainError } from "../../shared/errors";

/**
 * Cross-domain read-by-ID (ADR-0001): crm.Customer существует.
 */
export async function assertOptionalCustomer(prisma: PrismaService, customerId?: string | null): Promise<void> {
  if (!customerId) return;
  const exists = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!exists) throw new ValidationDomainError(`Customer ${customerId} does not exist`);
}

/**
 * Cross-domain read-by-ID (ADR-0001): security.User существует и является
 * внутренним staff-пользователем (BUYER/PARTNER не могут быть назначены
 * ответственным в internal Sales-контуре; assignedToId — business reference,
 * не authorization scope).
 */
export async function assertOptionalUser(prisma: PrismaService, userId?: string | null): Promise<void> {
  if (!userId) return;
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { code: true } } },
  });
  if (!exists) throw new ValidationDomainError(`User ${userId} does not exist`);
  if (exists.role?.code === RoleCode.BUYER || exists.role?.code === RoleCode.PARTNER) {
    throw new ValidationDomainError(`User ${userId} must be an internal staff user to be assigned`);
  }
}

/**
 * Cross-domain read-by-ID (ADR-0001): catalog.Product существует.
 */
export async function assertOptionalProduct(prisma: PrismaService, productId?: string | null): Promise<void> {
  if (!productId) return;
  const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!exists) throw new ValidationDomainError(`Product ${productId} does not exist`);
}
