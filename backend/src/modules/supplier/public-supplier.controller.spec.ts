import { EventEmitter } from "node:events";
import type { Response } from "express";
import { PublicSupplierController } from "./public-supplier.controller";
import type { SupplierOfferService } from "./supplier-offer.service";
import type { TourRequestService } from "./tour-request.service";
import type { SupplierAggregatorService } from "./supplier-aggregator.service";

/**
 * search-all: request-id связывает контроллер и агрегатор в один лог
 * [SEARCH <id>] (фронт шлёт свой sid), а clientClosed фиксирует отключение
 * клиента до ответа — результат не доставлен, запрос ушёл впустую.
 */
describe("PublicSupplierController — search-all requestId/clientClosed", () => {
  let controller: PublicSupplierController;
  let aggregator: { searchByService: jest.Mock };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    aggregator = {
      searchByService: jest.fn().mockResolvedValue({ offers: [], perSupplier: {} }),
    };
    controller = new PublicSupplierController(
      {} as SupplierOfferService,
      {} as TourRequestService,
      aggregator as unknown as SupplierAggregatorService,
    );
    warnSpy = jest
      .spyOn(
        (controller as unknown as { logger: { warn: (m: string) => void } }).logger,
        "warn",
      )
      .mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const resMock = () => new EventEmitter() as EventEmitter & Response;

  it("passes the caller's requestId to the aggregator (фронтовый sid для корреляции)", async () => {
    await controller.searchAll({ service: "tours", requestId: "SRCH-FRONT" }, resMock());

    expect(aggregator.searchByService).toHaveBeenCalledWith(
      "tours",
      expect.any(Object),
      { requestId: "SRCH-FRONT" },
    );
  });

  it("generates a requestId when the client did not send one", async () => {
    await controller.searchAll({}, resMock());

    const [, , options] = aggregator.searchByService.mock.calls[0];
    expect(options.requestId).toMatch(/^SRCH-/);
  });

  it("logs clientClosed when the connection closes before the response finished", async () => {
    const res = resMock();
    await controller.searchAll({ requestId: "T-1" }, res);

    res.emit("close"); // без предшествующего finish — клиент отвалился

    const warns = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warns.some((m) => m.includes("[SEARCH T-1] clientClosed"))).toBe(true);
  });

  it("stays silent on a normal completed response (finish → close)", async () => {
    const res = resMock();
    await controller.searchAll({ requestId: "T-2" }, res);

    res.emit("finish");
    res.emit("close");

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
