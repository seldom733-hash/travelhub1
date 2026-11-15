import { resolveDealCost, shouldUseObligationCost } from "./deal-cost";

describe("resolveDealCost", () => {
  it("uses a real obligation below the sale", () => {
    expect(resolveDealCost({ sales: 1000, obligationCost: 800, snapshotCost: 700, productCost: 600 })).toBe(800);
  });

  it("rejects a legacy obligation equal to the sale", () => {
    expect(shouldUseObligationCost(1000, 1000)).toBe(false);
    expect(resolveDealCost({ sales: 1000, obligationCost: 1000, snapshotCost: 700, productCost: 600 })).toBe(700);
  });

  it("rejects an obligation above the sale and falls back to product cost", () => {
    expect(resolveDealCost({ sales: 1000, obligationCost: 1200, snapshotCost: 0, productCost: 600 })).toBe(600);
  });
});
