import { SummerGdsFlightAddonService } from "./summer-gds-flight-addon.service";

describe("SummerGdsFlightAddonService", () => {
  it("adds the AZAL round trip when the GDS program is carried in tourIncValue", async () => {
    const azal = {
      search: jest.fn().mockResolvedValue({
        flights: [
          {
            optionId: "x_RT",
            fares: [{ available: true, total: { amount: 100 } }],
          },
        ],
      }),
    };
    const pricing = { publicAmountFor: jest.fn().mockResolvedValue(100) };
    const service = new SummerGdsFlightAddonService(azal as any, pricing as any);

    const [out] = await service.applyToOffers(
      [
        {
          supplierCode: "SUMMERTOUR",
          externalOfferId: "offer-1",
          hotel: "Rixos",
          destination: "Antalya",
          tour: "internal-tour-key",
          departureDate: "2026-12-20",
          nights: 7,
          price: { amount: 500, currency: "AZN" },
          rawMetadata: { tourIncValue: "256", tourKey: "internal-tour-key" },
        } as any,
      ],
      { adults: 2 },
    );

    expect(out.price.amount).toBe(600);
    expect(out.flightAddon).toMatchObject({ source: "AZAL", amount: 100, currency: "AZN" });
    expect(azal.search).toHaveBeenCalledWith(
      expect.objectContaining({ from: "GYD", to: "AYT", departureDate: "2026-12-20", returnDate: "2026-12-27" }),
    );
  });

  it("does not add a flight for a non-GDS Summertour offer", async () => {
    const azal = { search: jest.fn() };
    const pricing = { publicAmountFor: jest.fn() };
    const service = new SummerGdsFlightAddonService(azal as any, pricing as any);
    const offer = {
      supplierCode: "SUMMERTOUR",
      externalOfferId: "offer-2",
      hotel: "Rixos",
      destination: "Antalya",
      tour: "regular",
      departureDate: "2026-12-20",
      nights: 7,
      price: { amount: 500, currency: "AZN" },
      rawMetadata: { tourIncValue: "999", tourKey: "regular" },
    } as any;
    const [out] = await service.applyToOffers([offer], { adults: 2 });
    expect(out.price.amount).toBe(500);
    expect(out.flightAddon).toBeUndefined();
    expect(azal.search).not.toHaveBeenCalled();
  });
});
