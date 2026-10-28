import { BLOCK_REGISTRY, getBlocksForContext } from "./block-registry";

describe("Constructor block registry", () => {
  it("keeps marketplace and storefront contexts isolated", () => {
    const marketplace = getBlocksForContext("marketplace");
    const storefront = getBlocksForContext("storefront");
    expect(marketplace.length).toBeGreaterThan(0);
    expect(storefront.length).toBeGreaterThan(0);
    expect(marketplace.every((b) => b.allowedContexts.includes("marketplace"))).toBe(true);
    expect(storefront.every((b) => b.allowedContexts.includes("storefront"))).toBe(true);
    expect(storefront.some((b) => b.type === "storefront-hero")).toBe(true);
    expect(storefront.some((b) => b.type === "hero")).toBe(false);
  });

  it("registers every block in at least one explicit context", () => {
    for (const block of BLOCK_REGISTRY) {
      expect(block.allowedContexts.length).toBeGreaterThan(0);
      expect(typeof block.defaultSettings).toBe("object");
    }
  });

  it("has a non-removable storefront footer singleton", () => {
    const footer = getBlocksForContext("storefront").find((b) => b.type === "storefront-footer");
    expect(footer?.singleton).toBe(true);
    expect(footer?.removable).toBe(false);
  });

  it("shared content blocks are available to both sites", () => {
    for (const type of ["content-about", "content-cta", "content-faq", "content-gallery"]) {
      expect(getBlocksForContext("marketplace").some((b) => b.type === type)).toBe(true);
      expect(getBlocksForContext("storefront").some((b) => b.type === type)).toBe(true);
    }
  });
});
