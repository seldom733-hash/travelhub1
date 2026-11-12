import { describe, expect, it } from "vitest";
import { dealText, dealStatus, dealFinancial } from "./deals-i18n";

describe("sales register locales", () => {
  it("translates the register title for az and en", () => {
    expect(dealText("az", "Реестр продаж и взаиморасчётов")).toBe("Satış və hesablaşmalar reyestri");
    expect(dealText("en", "Реестр продаж и взаиморасчётов")).toBe("Sales and settlements register");
  });

  it("translates deal and financial statuses", () => {
    expect(dealStatus("az", "CUSTOMER_ACCEPTED")).toBe("Müştəri təsdiqlədi");
    expect(dealStatus("en", "CLOSED")).toBe("Closed");
    expect(dealFinancial("az", "OPEN")).toBe("Açıq");
    expect(dealFinancial("en", "FINANCIALLY_SETTLED")).toBe("Settled");
  });
});
