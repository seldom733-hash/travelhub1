import { ProductHistoryRecorder } from "./product-history-recorder.service";

/** История sync: пишем только реальные изменения, в той же транзакции. */
describe("ProductHistoryRecorder", () => {
  const recorder = new ProductHistoryRecorder();

  it("записывает изменённые поля с версией продукта и валидным action", async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = { productHistory: { create } } as never;

    await recorder.record(
      tx,
      "prod-1",
      7,
      { title: "New title", startingPrice: 100, currency: "AZN" },
      "supplier.sync",
      "actor-1",
    );

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.productId).toBe("prod-1");
    expect(data.version).toBe(7);
    expect(data.action).toBe("supplier.sync");
    expect(data.actorId).toBe("actor-1");
    expect(data.fields).toEqual({ title: "New title", startingPrice: 100, currency: "AZN" });
  });

  it("не пишет пустую историю, когда изменений нет", async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = { productHistory: { create } } as never;

    await recorder.record(tx, "prod-1", 1, {});
    await recorder.record(tx, "prod-1", 1, { title: undefined, price: null });

    // null — осознанное значение поля (например, сброс цены), undefined — нет изменения.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.fields).toEqual({ price: null });
  });
});
