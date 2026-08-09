import { MarketplaceBehavioralService } from "./marketplace-behavioral.service";
import { PublicCatalogService } from "../public/public-catalog.service";

/**
 * Phase 1 Step 1.13B — unit сервиса ingestion (strict review §16.24).
 * Проверяет semantic-контракт без БД: neutral drop, dedup по eventId,
 * server-authoritative acquisitionSource, сбой persistence observable (500).
 */
describe("MarketplaceBehavioralService (Step 1.13B)", () => {
  let service: MarketplaceBehavioralService;
  let create: jest.Mock;
  let resolveProduct: jest.Mock;
  let resolveCategory: jest.Mock;

  const validInput = {
    eventId: "11111111-1111-4111-8111-111111111111",
    eventType: "MARKETPLACE_VIEWED",
    occurredAt: new Date().toISOString(),
    sessionId: "mp_anon_session_01",
    locale: "ru",
    path: "/",
    payload: undefined,
  };

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({ id: "row-1" });
    resolveProduct = jest.fn().mockResolvedValue("PRD-1");
    resolveCategory = jest.fn().mockResolvedValue("CAT-1");
    const prismaMock = { marketplaceBehavioralEvent: { create } };
    const catalogMock = {
      resolvePublicMarketplaceProductForEvents: resolveProduct,
      resolvePublicMarketplaceCategoryForEvents: resolveCategory,
    } as unknown as PublicCatalogService;
    service = new MarketplaceBehavioralService(prismaMock as never, catalogMock);
  });

  it("persist: server-authoritative acquisitionSource=MARKETPLACE, no forged identity", async () => {
    const res = await service.ingest(validInput);
    expect(res).toEqual({ accepted: true });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.acquisitionSource).toBe("MARKETPLACE");
    expect(data.productId).toBeNull();
    expect(data.categoryId).toBeNull();
  });

  it("neutral drop: непубличный Product → accepted без persist (§5)", async () => {
    resolveProduct.mockResolvedValueOnce(null);
    const before = create.mock.calls.length;
    const res = await service.ingest({
      ...validInput,
      eventType: "MARKETPLACE_PRODUCT_VIEWED",
      path: "/products/some-draft",
      productSlug: "some-draft",
    });
    expect(res).toEqual({ accepted: true });
    expect(create.mock.calls.length).toBe(before);
  });

  it("neutral drop: неизвестная/неактивная категория → accepted без persist", async () => {
    resolveCategory.mockResolvedValueOnce(null);
    const before = create.mock.calls.length;
    const res = await service.ingest({
      ...validInput,
      eventType: "MARKETPLACE_CATEGORY_VIEWED",
      path: "/categories/no-such-cat",
      categorySlug: "no-such-cat",
    });
    expect(res).toEqual({ accepted: true });
    expect(create.mock.calls.length).toBe(before);
  });

  it("dedup: unique-violation eventId → accepted, метрика не удваивается (§11)", async () => {
    create.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["MarketplaceBehavioralEvent_eventId_key"] },
    });
    const res = await service.ingest(validInput);
    expect(res).toEqual({ accepted: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("persistence failure: generic DB error перебрасывается (observable 500, §16.24)", async () => {
    create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(service.ingest(validInput)).rejects.toThrow("connection lost");
  });

  it("productId резолвится сервером из slug для IMPRESSION/VIEWED (клиент не может forged)", async () => {
    await service.ingest({
      ...validInput,
      eventType: "MARKETPLACE_PRODUCT_IMPRESSION",
      path: "/",
      productSlug: "baku-tour",
      payload: { placement: "grid", position: 0 },
    });
    expect(resolveProduct).toHaveBeenCalledWith("baku-tour");
    const data = create.mock.calls[0][0].data;
    expect(data.productId).toBe("PRD-1");
  });
});
