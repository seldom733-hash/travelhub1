import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";

/**
 * TourRequestService — creates tour requests from verified KOMPAS offers.
 *
 * Uses the existing order.Request domain (anonymous public flow).
 * No authentication required — the request is created as a public inquiry.
 */
@Injectable()
export class TourRequestService {
  private readonly logger = new Logger(TourRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly refNum: ReferenceNumberService,
  ) {}

  async createTourRequest(dto: {
    supplierCode: string;
    externalOfferId: string;
    hotel: string;
    hotelExternalId?: string;
    departureDate: string;
    nights: number;
    adults: number;
    children: number;
    childAges?: number[];
    room?: string;
    meal?: string;
    price: number;
    currency: string;
    destination?: string;
    departureCity?: string;
  }) {
    const code = await this.ids.nextCode(null as any, "REQ");
    const commerceSequence = await this.refNum.nextCommerceSequence(null as any);
    const referenceNumber = this.refNum.commerceRequestRef(commerceSequence);

    // Find the product by hotelExternalId if available
    let productId: string | null = null;
    let productCode: string | null = null;
    let productTitle: string | null = null;

    if (dto.hotelExternalId) {
      const product = await (this.prisma as any).product.findFirst({
        where: {
          attributes: { path: ["hotelExternalId"], equals: dto.hotelExternalId },
        },
        select: { id: true, code: true, title: true },
      });
      if (product) {
        productId = product.id;
        productCode = product.code;
        productTitle = product.title;
      }
    }

    const now = new Date();
    const supplierResponseDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h SLA

    const request = await (this.prisma as any).request.create({
      data: {
        code,
        commerceSequence,
        referenceNumber,
        customerId: null,
        productId,
        partnerId: null,
        status: "NEW",
        requestedServiceDate: new Date(dto.departureDate),
        quantity: 1,
        travelerCount: dto.adults + dto.children,
        productSnapshot: productId
          ? { productId, productCode, productTitle, type: "TOUR" }
          : null,
        displayedPrice: dto.price,
        displayedCurrency: dto.currency,
        confirmedPrice: null,
        confirmedCurrency: null,
        pinnedRequirements: {
          supplierCode: dto.supplierCode,
          externalOfferId: dto.externalOfferId,
          hotel: dto.hotel,
          hotelExternalId: dto.hotelExternalId,
          departureDate: dto.departureDate,
          nights: dto.nights,
          adults: dto.adults,
          children: dto.children,
          childAges: dto.childAges ?? [],
          room: dto.room,
          meal: dto.meal,
          destination: dto.destination,
          departureCity: dto.departureCity,
        },
        supplierResponseDeadline,
        supplierRespondedAt: null,
        supplierDecision: null,
        supplierPriceProposal: null,
        supplierNote: null,
        customerActionDeadline: null,
        customerAcceptedAt: null,
        customerDecision: null,
        convertedOrderId: null,
        convertedAt: null,
        acquisitionSource: "MARKETPLACE",
      },
    });

    this.logger.log(
      `Tour request created: ${referenceNumber} (offer=${dto.externalOfferId}, hotel=${dto.hotel}, price=${dto.price} ${dto.currency})`,
    );

    return {
      id: request.id,
      code: request.code,
      referenceNumber: request.referenceNumber,
      status: request.status,
      displayedPrice: request.displayedPrice,
      displayedCurrency: request.displayedCurrency,
      createdAt: request.createdAt,
    };
  }
}
