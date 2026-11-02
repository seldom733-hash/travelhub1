import { calculateSupplierPricing } from "./commission-calculator";

describe("calculateSupplierPricing", () => {
  it("markup only", () => {
    const r = calculateSupplierPricing({ supplierBasePrice: "1000", currency: "AZN", markupRate: "0.08" });
    expect(r.storefrontPrice).toBe("1080");
    expect(r.netSupplierCost).toBe("1000");
    expect(r.platformGrossIncome).toBe("80");
  });
  it("commission only", () => {
    const r = calculateSupplierPricing({ supplierBasePrice: "1000", currency: "AZN", markupRate: "0", commissionType: "PERCENT", commissionRate: "0.08" });
    expect(r.storefrontPrice).toBe("1000");
    expect(r.commissionAmount).toBe("80");
    expect(r.netSupplierCost).toBe("920");
    expect(r.platformGrossIncome).toBe("80");
  });
  it("combined", () => {
    const r = calculateSupplierPricing({ supplierBasePrice: "1000", currency: "AZN", markupRate: "0.08", commissionType: "PERCENT", commissionRate: "0.08" });
    expect(r.storefrontPrice).toBe("1080");
    expect(r.netSupplierCost).toBe("920");
    expect(r.platformGrossIncome).toBe("160");
  });
  it("fixed commission", () => {
    const r = calculateSupplierPricing({ supplierBasePrice: "1000", currency: "AZN", markupRate: "0", commissionType: "FIXED", commissionFixedAmount: "50" });
    expect(r.commissionAmount).toBe("50");
    expect(r.netSupplierCost).toBe("950");
  });
});
