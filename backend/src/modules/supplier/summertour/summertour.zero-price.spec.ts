/**
 * Phase 5 §5.5/5.7 — amount:0 fallback elimination.
 *
 * SUMMERTOUR (old + new adapters): not-found getOffer/refreshPrice used to
 * synthesize a zero SupplierPriceSnapshot that poisoned the supplier cache and
 * surfaced as a misleading 422 at the authenticated boundary. The established
 * PRICE_UNAVAILABLE model (message prefix → HTTP 400 at the public boundary,
 * priceBoundary in SupplierOfferService) applies instead.
 *
 * search() is stubbed — the real implementation drives a Playwright browser.
 */
import { SummertourAdapter } from "./summertour.adapter";
import { SummertourNewAdapter } from "./summertour-new.adapter";

const REF = {
  supplierCode: "SUMMERTOUR",
  externalOfferId: "MISSING",
  searchContext: { service: "tours", adults: 2 },
} as any;

describe.each([
  ["SummertourAdapter", () => new SummertourAdapter()],
  ["SummertourNewAdapter", () => new SummertourNewAdapter()],
])("%s — no amount:0 fallbacks (§5.5/§5.7)", (_name, make) => {
  it("getOffer: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const adapter = make();
    (adapter as any).search = jest.fn().mockResolvedValue([]);

    await expect(adapter.getOffer(REF)).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });

  it("refreshPrice: not found → PRICE_UNAVAILABLE (no zero-snapshot synth)", async () => {
    const adapter = make();
    (adapter as any).search = jest.fn().mockResolvedValue([]);

    await expect(adapter.refreshPrice(REF)).rejects.toThrow(/PRICE_UNAVAILABLE/);
  });
});
