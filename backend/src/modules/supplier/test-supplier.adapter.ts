import { Injectable } from "@nestjs/common";
import type {
  PriceCalendarQuery,
  PriceCalendarResult,
  SupplierAdapter,
  SupplierAvailabilitySnapshot,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierSearchQuery,
} from "./supplier.types";

const TEST_PRICE = 800;

/** Isolated manual-E2E supplier: never calls an external system. */
@Injectable()
export class TestSupplierAdapter implements SupplierAdapter {
  readonly code = "TEST";
  readonly name = "Navitravel Test Supplier";
  readonly enabled = true;

  private offer(query: Partial<SupplierSearchQuery & PriceCalendarQuery> = {}): SupplierOffer {
    const now = new Date();
    return {
      supplierCode: this.code,
      service: query.service ?? "tours",
      externalOfferId: "TEST-OFFER-1",
      externalClaim: "TEST-CLAIM-1",
      tour: "Navitravel E2E Test Tour",
      hotel: query.hotel ?? "Navitravel Test Hotel",
      hotelExternalId: query.hotelExternalId ?? "TEST-HOTEL",
      country: "Azerbaijan",
      destination: "Baku",
      departureDate: query.departureDateFrom ?? new Date().toISOString().slice(0, 10),
      nights: query.nightsFrom ?? 7,
      room: "Standard",
      meal: "BB",
      adults: query.adults ?? 2,
      children: query.children ?? 0,
      childAges: query.childAges ?? [],
      price: { amount: TEST_PRICE, currency: "AZN", fetchedAt: now, expiresAt: new Date(now.getTime() + 3_600_000), queryHash: "test", source: this.code },
      availability: "AVAILABLE",
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 3_600_000),
    };
  }

  async search(query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    return [this.offer(query)];
  }

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    return this.offer({ ...ref.searchContext, hotel: ref.searchContext.hotel });
  }

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const now = new Date();
    return { amount: TEST_PRICE, currency: "AZN", fetchedAt: now, expiresAt: new Date(now.getTime() + 3_600_000), queryHash: "test", source: this.code };
  }

  async refreshAvailability(): Promise<SupplierAvailabilitySnapshot> {
    const now = new Date();
    return { availability: "AVAILABLE", fetchedAt: now, expiresAt: new Date(now.getTime() + 3_600_000) };
  }

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const from = new Date(query.dateFrom);
    const to = new Date(query.dateTo);
    const entries = [];
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const offer = this.offer({ ...query, departureDateFrom: date });
      entries.push({
        date,
        price: TEST_PRICE,
        currency: "AZN",
        availability: "AVAILABLE" as const,
        offerCount: 1,
        offers: [{
          tourIncValue: "TEST",
          tourIncName: "Navitravel E2E Test Tour",
          externalOfferId: "TEST-OFFER-1",
          externalClaim: "TEST-CLAIM-1",
          hotel: offer.hotel,
          hotelExternalId: offer.hotelExternalId,
          departureDate: date,
          nights: offer.nights,
          room: offer.room,
          meal: offer.meal,
          adults: offer.adults,
          children: offer.children,
          childAges: offer.childAges,
          availability: "AVAILABLE" as const,
          price: TEST_PRICE,
          currency: "AZN",
        }],
      });
    }
    const now = new Date();
    return { supplierCode: this.code, contextHash: "test", entries, dateFrom: query.dateFrom, dateTo: query.dateTo, fetchedAt: now, expiresAt: new Date(now.getTime() + 3_600_000), totalOffersScanned: entries.length };
  }
}
