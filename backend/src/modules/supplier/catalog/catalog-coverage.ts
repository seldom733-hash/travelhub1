import { AsyncLocalStorage } from "async_hooks";
import type { SupplierCatalogCoverage } from "../supplier.types";

interface MutableCoverage {
  pagesFetched: number;
  pageCount: number | null;
  truncated: boolean;
  programsComplete: boolean;
  windowsComplete: boolean;
  errors: string[];
}

const storage = new AsyncLocalStorage<MutableCoverage>();

function current(): MutableCoverage | undefined {
  return storage.getStore();
}

export function recordCatalogPage(page: number, pageCount?: number | null, truncated = false): void {
  const c = current();
  if (!c) return;
  c.pagesFetched += 1;
  if (typeof pageCount === "number" && Number.isFinite(pageCount)) {
    c.pageCount = Math.max(c.pageCount ?? 0, pageCount);
    if (pageCount > page) c.truncated = c.truncated || truncated;
  } else if (truncated) {
    c.truncated = true;
  }
}

export function recordCatalogProgram(complete = true): void {
  const c = current();
  if (c && !complete) c.programsComplete = false;
}

export function recordCatalogWindow(complete = true): void {
  const c = current();
  if (c && !complete) c.windowsComplete = false;
}

export function recordCatalogError(message: string): void {
  const c = current();
  if (c) c.errors.push(message);
}

export async function withCatalogCoverage<T>(run: () => Promise<T>): Promise<{ result: T; coverage: SupplierCatalogCoverage }> {
  const mutable: MutableCoverage = {
    pagesFetched: 0,
    pageCount: null,
    truncated: false,
    programsComplete: true,
    windowsComplete: true,
    errors: [],
  };
  const result = await storage.run(mutable, run);
  return {
    result,
    coverage: {
      pagesFetched: mutable.pagesFetched,
      pageCount: mutable.pageCount,
      hasMore: mutable.truncated ? true : mutable.pageCount === null ? null : false,
      truncated: mutable.truncated,
      programsComplete: mutable.programsComplete,
      windowsComplete: mutable.windowsComplete,
      errors: mutable.errors,
    },
  };
}
