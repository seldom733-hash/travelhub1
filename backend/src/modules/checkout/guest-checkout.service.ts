import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityService } from "../../security/security.service";
import { CrmService } from "../crm/crm.service";
import { RequestService } from "../order/request.service";
import { resolveCustomer } from "../../shared/customer-resolver/customer-resolver";
import { normalizePhoneE164 } from "../../shared/phone/phone";
import { normalizeEmail } from "../../shared/field-validation";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";

export interface GuestCheckoutInput {
  email: string;
  phone: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  productId?: string;
  quantity?: number;
  travelerCount?: number;
  requestedServiceDate?: string;
}

export interface GuestCheckoutResult {
  customer: { id: string; created: boolean };
  request: Record<string, unknown>;
  resolvedSource: "phone" | "email" | "user" | "none";
}

/** System-актор guest-канала: audit userId = null (FK), history actorName. */
const GUEST_ACTOR = { id: null, username: "guest-checkout" } as const;

/**
 * Платформенная базовая валюта guest-заявки: convert требует commercial terms
 * (money+currency, order.service §createOrderFromRequest). Цена гостем НЕ
 * задаётся (checkout — не источник цены): она фиксируется supplier-флоу
 * (confirm/propose → customer-accept freeze). Валюта — серверная константа
 * (см. PLATFORM_REPORTING_CURRENCY в analytics); при мультивалютном каталоге
 * переезжает в конфиг.
 */
const GUEST_CHECKOUT_CURRENCY = "AZN";

@Injectable()
export class GuestCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly crm: CrmService,
    private readonly requests: RequestService,
  ) {}

  /**
   * §23: anonymous onboarding → Customer Resolver → Customer (create/reuse)
   * → Request. Дальше Request идёт штатным конвейером (supplier confirm/
   * propose → customer-accept → convert → Order) — staff-assisted flow §24.
   *
   * Эквивалентность каналов: тот же общий resolver, что Website/WhatsApp
   * (M4.2/M4.4), поэтому «guest уже зарегистрирован/забронировал раньше»
   * повторно создаёт Customer НЕ будет (reuse по телефону → по email).
   */
  async checkout(input: GuestCheckoutInput): Promise<GuestCheckoutResult> {
    // E.164: country (2-letter ISO, validated DTO) — region для локального
    // формата; без country — DEFAULT_PHONE_REGION. Невалидный номер → 422,
    // не «угадываем» (resolver-правило §5: нет canonical → не резолвим).
    const region = input.country ? input.country.trim().toUpperCase() : undefined;
    const phone = normalizePhoneE164(input.phone, region);
    if (!phone) {
      throw new ValidationDomainError("Invalid phone number");
    }

    const resolved = await resolveCustomer(this.prisma, { phone, email: input.email });
    if (resolved.status === "AMBIGUOUS") {
      // >1 владельцев canonical-телефона: не auto-merge, ручной выбор (§5).
      throw new ConflictError("Phone number matches multiple customer records — manual selection required");
    }

    // Product проверяется ДО создания Customer: невалидный productId не должен
    // оставлять осиротевший customer-запись.
    const productId = input.productId?.trim() || undefined;
    if (productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) throw new NotFoundError(`Product ${productId} not found`);
    }

    let customerId = resolved.customerId;
    let created = false;
    if (customerId === null) {
      const result = await this.crm.createCustomer(
        {
          type: "PERSON",
          firstName: input.firstName,
          lastName: input.lastName,
          email: normalizeEmail(input.email),
          phone,
        },
        GUEST_ACTOR.username,
      );
      customerId = result.customer.id;
      created = true;
    }

    // Request: цена гостем НЕ задаётся (checkout — не источник цены);
    // displayedPrice остаётся null → коммерческие условия фиксирует
    // supplier flow (confirm/propose → customer-accept freeze §D3).
    // displayedCurrency — серверная константа (см. GUEST_CHECKOUT_CURRENCY).
    const request = await this.requests.createRequest(
      {
        customerId,
        productId,
        quantity: input.quantity ?? 1,
        travelerCount: input.travelerCount ?? 1,
        requestedServiceDate: input.requestedServiceDate,
        displayedCurrency: GUEST_CHECKOUT_CURRENCY,
      },
      GUEST_ACTOR,
    );

    await this.security.audit(undefined, {
      userId: null,
      username: GUEST_ACTOR.username,
      action: "checkout.guest_created",
      resource: "Request",
      resourceId: request.id as string,
      details: {
        customerId,
        created,
        resolvedSource: resolved.source,
        productId: productId ?? null,
      },
    });

    return { customer: { id: customerId, created }, request, resolvedSource: resolved.source };
  }
}
