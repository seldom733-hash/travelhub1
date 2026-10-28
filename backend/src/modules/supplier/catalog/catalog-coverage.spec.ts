import { withCatalogCoverage, recordCatalogPage, recordCatalogProgram, recordCatalogWindow } from "./catalog-coverage";

describe("catalog coverage contract", () => {
  it("marks a full multi-page, program and window sweep complete", async () => {
    const { coverage } = await withCatalogCoverage(async () => {
      recordCatalogPage(1, 2);
      recordCatalogPage(2, 2);
      recordCatalogProgram(true);
      recordCatalogWindow(true);
    });
    expect(coverage).toMatchObject({
      pagesFetched: 2,
      pageCount: 2,
      truncated: false,
      hasMore: false,
      programsComplete: true,
      windowsComplete: true,
      errors: [],
    });
  });

  it("records truncation and incomplete program/window", async () => {
    const { coverage } = await withCatalogCoverage(async () => {
      recordCatalogPage(1, 5, true);
      recordCatalogProgram(false);
      recordCatalogWindow(false);
    });
    expect(coverage.truncated).toBe(true);
    expect(coverage.programsComplete).toBe(false);
    expect(coverage.windowsComplete).toBe(false);
    expect(coverage.pageCount).toBe(5);
  });
});
