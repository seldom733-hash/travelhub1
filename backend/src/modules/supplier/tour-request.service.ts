import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";
import { SupplierOfferService } from "./supplier-offer.service";
import { buildWorkingSnapshot } from "../pricing/commercial-snapshot";
import type { SupplierSearchQuery } from "./supplier.types";

/**
 * TourRequestService — creates tour requests from verified KOMPAS offers.
 *
 * Uses the existing order.Request domain (anonymous public flow).
 * No authentication required — the request is created as a public inquiry.
 *
 * Supplier Markup (STRICT PROMPT §16): displayedPrice is SERVER-AUTHORITATIVE —
 * derived from a fresh supplier re-check (SupplierOfferService.refreshPrice,
 * which runs the markup boundary). dto.price from the client is accepted for
 * API compatibility but NEVER trusted.
 */
@Injectable()
export class TourRequestService {
  private readonly logger = new Logger(TourRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly refNum: ReferenceNumberService,
    private readonly offerService: SupplierOfferService,
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
    country?: string;
    tourIncValue?: string;
    tourIncName?: string;
  }) {

    // Server-authoritative price: re-verify the offer with the supplier and
    // run the markup boundary (public amount + §20 pricing block).
    const searchContext: SupplierSearchQuery = {
      service: "tours",
      hotel: dto.hotel,
      hotelExternalId: dto.hotelExternalId,
      room: dto.room,
      meal: dto.meal,
      adults: dto.adults,
      children: dto.children,
      childAges: dto.childAges,
      departureDateFrom: dto.departureDate,
      departureDateTo: dto.departureDate,
      nightsFrom: dto.nights,
      nightsTo: dto.nights,
      destination: dto.destination,
      departureCity: dto.departureCity,
      country: dto.country,
      tourIncValue: dto.tourIncValue,
      tourIncName: dto.tourIncName,
      page: 1,
    };
    const recheck = await this.offerService.refreshPrice({
      supplierCode: dto.supplierCode,
      externalOfferId: dto.externalOfferId,
      searchContext,
    });
    if (typeof recheck.amount !== "number" || !(recheck.amount > 0)) {
      throw new Error(
        `PRICE_UNAVAILABLE: supplier re-check for ${dto.supplierCode}/${dto.externalOfferId} returned no valid price`,
      );
    }
    const displayedPrice = recheck.amount;
    const displayedCurrency = recheck.currency;

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

    // Supplier Markup Phase 3 (§20): working commercial snapshot frozen at
    // creation from the recheck pricing block (supplier price + TTL evidence).
    // Absent pricing block → legacy request (acceptance money-gate only).
    const commercialSnapshot = recheck.pricing
      ? buildWorkingSnapshot({
          supplierCode: dto.supplierCode,
          serviceType: "tours",
          pricing: recheck.pricing,
          priceSource: "PUBLIC",
          supplierPriceFetchedAt: recheck.fetchedAt,
          supplierPriceExpiresAt: recheck.expiresAt,
        })
      : null;

    // Json-поля: Prisma принимает только JsonNull/DbNull вместо null, а
    // undefined внутри Json-объекта не сериализуется — собираем без дыр.
    const pinnedRequirements = JSON.parse(
      JSON.stringify({
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
        country: dto.country ?? null,
      }),
    ) as Prisma.InputJsonValue;

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
        // Product identity: ALWAYS written — the registry «Услуга» cell and the
        // D3 convert gate (hasD3AcceptSnapshot requires productSnapshot != null)
        // must not depend on the hotelExternalId product lookup hitting. Title
        // falls back to the hotel name; productType feeds OrderItem.type on
        // conversion (order.service reads productSnapshot.productType ?? "SERVICE").
        productSnapshot: {
          ...(productId ? { productId, productCode, productTitle } : {}),
          productTitle: productTitle ?? dto.hotel ?? null,
          productType: "TOUR",
          type: "TOUR",
        } as Prisma.InputJsonValue,
        displayedPrice,
        displayedCurrency,
        ...(commercialSnapshot
          ? { commercialSnapshot: commercialSnapshot as unknown as Prisma.InputJsonValue }
          : {}),
        // «Подтв. цена» = принята́я цена витрины при подаче заявки из карточки
        // услуги (product rule): displayed price is frozen as confirmed right at
        // creation, independent of the markup pricing block. customerAccept later
        // overwrites it with acceptedMoney (discount path); conversion money-gate
        // (confirmed ?? displayed) sees identical values either way.
        confirmedPrice: displayedPrice,
        confirmedCurrency: displayedCurrency,
        pinnedRequirements,
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
      },
    });

    this.logger.log(
      `Tour request created: ${referenceNumber} (offer=${dto.externalOfferId}, hotel=${dto.hotel}, price=${displayedPrice} ${displayedCurrency}, supplierRecheck=${recheck.amount} ${recheck.currency})`,
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
