// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { t } from "./i18n";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const PAGE = read("app/app/documents/page.tsx");
const DETAIL = read("app/app/documents/[id]/page.tsx");
const SHELL = read("components/Shell.tsx");
const OPS_SHELL = read("components/OperationsCenterShell.tsx");
const LOCALES = ["ru", "az", "en"] as const;

/** Canonical DocumentStatus values (Prisma schema). */
const DOCUMENT_STATUSES = ["NOT_ISSUED", "ISSUED", "SUPERSEDED", "INVALIDATED"] as const;

/** Canonical DocumentType values (Prisma schema). */
const DOCUMENT_TYPES = ["PARTIAL_PAYMENT", "VOUCHER", "REFUND"] as const;

/** Expected i18n labels (documents.status.*). */
const EXPECTED_STATUS_RU: Record<string, string> = {
  NOT_ISSUED: "Не сформирован",
  ISSUED: "Сформирован",
  SUPERSEDED: "Заменён",
  INVALIDATED: "Аннулирован",
};

/** Expected i18n labels (documents.type.*). */
const EXPECTED_TYPE_RU: Record<string, string> = {
  PARTIAL_PAYMENT: "Частичная оплата",
  VOUCHER: "Ваучер",
  REFUND: "Возврат",
};

describe("UI-DOC-01: Documents nav entry under OPERATIONS in Shell.tsx", () => {
  it("contains /app/documents in OPERATIONS group with documents.read permission", () => {
    expect(SHELL).toContain('href: "/app/documents"');
    expect(SHELL).toContain('labelKey: "nav.documents"');
    expect(SHELL).toContain('permission: "documents.read"');
  });

  it("Documents entry appears after Bookings in OPERATIONS group", () => {
    const bookingsIdx = SHELL.indexOf('/app/bookings');
    const docsIdx = SHELL.indexOf('/app/documents');
    expect(bookingsIdx).toBeGreaterThan(-1);
    expect(docsIdx).toBeGreaterThan(bookingsIdx);
  });
});

describe("UI-DOC-02: Documents tab in OperationsCenterShell", () => {
  it("OperationsDomain type includes 'documents'", () => {
    expect(OPS_SHELL).toContain('"documents"');
  });

  it("OPS_TABS has documents entry with correct route and permission", () => {
    expect(OPS_SHELL).toContain('id: "documents"');
    expect(OPS_SHELL).toContain('href: "/app/documents"');
    expect(OPS_SHELL).toContain('labelKey: "nav.documents"');
    expect(OPS_SHELL).toContain('permission: "documents.read"');
  });
});

describe("UI-DOC-03: i18n keys for documents are defined", () => {
  it("nav.documents is localized in all three locales", () => {
    for (const locale of LOCALES) {
      const label = t("nav.documents", locale);
      expect(label).not.toBe("nav.documents");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("all DocumentStatus i18n keys resolve in RU", () => {
    for (const status of DOCUMENT_STATUSES) {
      const key = `documents.status.${status}`;
      const label = t(key, "ru");
      expect(label).not.toBe(key);
      expect(label).toBe(EXPECTED_STATUS_RU[status]);
    }
  });

  it("all DocumentType i18n keys resolve in RU", () => {
    for (const dtype of DOCUMENT_TYPES) {
      const key = `documents.type.${dtype}`;
      const label = t(key, "ru");
      expect(label).not.toBe(key);
      expect(label).toBe(EXPECTED_TYPE_RU[dtype]);
    }
  });
});

describe("UI-DOC-04: StatusBadge entries for document statuses", () => {
  it("StatusBadge maps all document statuses to i18n keys", () => {
    const badge = read("components/StatusBadge.tsx");
    for (const status of DOCUMENT_STATUSES) {
      expect(badge).toContain(`${status}: "documents.status.${status}"`);
    }
  });

  it("StatusBadge has color classes for all document statuses", () => {
    const badge = read("components/StatusBadge.tsx");
    for (const status of DOCUMENT_STATUSES) {
      expect(badge).toMatch(new RegExp(`${status}: "bg-`));
    }
  });
});

describe("UI-DOC-05: Documents page enumerates all DocumentTypes", () => {
  it("page imports DOCUMENT_TYPES and DOCUMENT_STATUSES", () => {
    expect(PAGE).toContain("DOCUMENT_TYPES");
    expect(PAGE).toContain("DOCUMENT_STATUSES");
  });

  it("page imports DocumentType and DocumentStatus types", () => {
    expect(PAGE).toContain("type DocumentType");
    expect(PAGE).toContain("type DocumentStatus");
  });

  it("page iterates DOCUMENT_TYPES for KPI cards and filter options", () => {
    expect(PAGE).toContain("DOCUMENT_TYPES.map");
  });
});

describe("UI-DOC-06: Documents page uses OperationsCenterShell with activeDomain='documents'", () => {
  it("OperationsCenterShell is imported and used with documents domain", () => {
    expect(PAGE).toContain('activeDomain="documents"');
    expect(PAGE).toContain("OperationsCenterShell");
  });

  it("page imports slot components from OperationsCenterShell", () => {
    expect(PAGE).toContain("OperationsToolbarSlot");
    expect(PAGE).toContain("OperationsRegistrySlot");
    expect(PAGE).toContain("OperationsLoadingState");
    expect(PAGE).toContain("OperationsEmptyState");
    expect(PAGE).toContain("OperationsErrorState");
  });
});

describe("UI-DOC-07: Documents page has URL state management", () => {
  it("uses useSearchParams for reading URL state", () => {
    expect(PAGE).toContain("useSearchParams");
  });

  it("uses window.history.replaceState for writing URL state", () => {
    expect(PAGE).toContain("window.history.replaceState");
  });

  it("supports type filter in URL", () => {
    expect(PAGE).toContain('"type"');
  });

  it("supports status filter in URL", () => {
    expect(PAGE).toContain('"status"');
  });

  it("supports page in URL", () => {
    expect(PAGE).toContain('"page"');
  });
});

describe("UI-DOC-08: Documents page has search with debounce", () => {
  it("implements debounced search (setTimeout ~350ms)", () => {
    expect(PAGE).toContain("debounceRef");
    expect(PAGE).toContain("350");
  });

  it("search filters by code and bookingCode", () => {
    expect(PAGE).toContain("item.code.toLowerCase().includes(q)");
    expect(PAGE).toContain("bookingCode");
  });
});

describe("UI-DOC-09: Documents page has KPI cards", () => {
  it("imports CommerceKpiCard", () => {
    expect(PAGE).toContain("CommerceKpiCard");
  });

  it("renders total documents KPI card with i18n key", () => {
    expect(PAGE).toContain("documents.kpi.total");
  });

  it("iterates DOCUMENT_TYPES to render per-type KPI cards", () => {
    expect(PAGE).toContain("DOCUMENT_TYPES.map");
    expect(PAGE).toContain("documentTypeLabel");
    expect(PAGE).toContain("typeCounts");
  });
});

describe("UI-DOC-10: Documents page table columns match contract", () => {
  it("table has code column", () => {
    expect(PAGE).toContain("documents.table.code");
  });

  it("table has type column", () => {
    expect(PAGE).toContain("documents.table.type");
  });

  it("table has status column", () => {
    expect(PAGE).toContain("documents.table.status");
  });

  it("table has booking column", () => {
    expect(PAGE).toContain("documents.table.booking");
  });

  it("table has service date column", () => {
    expect(PAGE).toContain("documents.table.service_date");
  });

  it("table has amount column", () => {
    expect(PAGE).toContain("documents.table.amount");
  });

  it("table has paid column", () => {
    expect(PAGE).toContain("documents.table.paid");
  });

  it("table has version column", () => {
    expect(PAGE).toContain("documents.table.version");
  });

  it("table has created column", () => {
    expect(PAGE).toContain("documents.table.created");
  });
});

describe("UI-DOC-11: Documents detail page exists with required sections", () => {
  it("detail page imports documentsApi", () => {
    expect(DETAIL).toContain("documentsApi");
  });

  it("detail page has breadcrumb navigation back to /app/documents", () => {
    expect(DETAIL).toContain('/app/documents"');
  });

  it("detail page displays document code", () => {
    expect(DETAIL).toContain("doc.code");
  });

  it("detail page shows status badge", () => {
    expect(DETAIL).toContain("StatusBadge");
  });
});

describe("UI-DOC-12: Documents detail page has download link", () => {
  it("download uses documentsApi.downloadUrl", () => {
    expect(DETAIL).toContain("documentsApi.downloadUrl");
  });

  it("download link renders with documents.detail.download i18n key", () => {
    expect(DETAIL).toContain("documents.detail.download");
  });
});

describe("UI-DOC-13: Documents detail page has invalidation (ADMIN/OPERATOR only)", () => {
  it("checks documents.write permission via useCan", () => {
    expect(DETAIL).toContain('useCan("documents.write")');
  });

  it("invalidate button only shows when not already invalidated", () => {
    expect(DETAIL).toContain("doc.status !== \"INVALIDATED\"");
  });

  it("invalidate opens a dialog with reason input", () => {
    expect(DETAIL).toContain("invalidateOpen");
    expect(DETAIL).toContain("invalidateReason");
  });

  it("calls documentsApi.invalidate with reason", () => {
    expect(DETAIL).toContain("documentsApi.invalidate");
  });

  it("invalidate uses i18n labels", () => {
    expect(DETAIL).toContain("documents.detail.invalidate_title");
    expect(DETAIL).toContain("documents.detail.invalidate_reason");
    expect(DETAIL).toContain("documents.detail.invalidate_confirm");
    expect(DETAIL).toContain("documents.detail.invalidate_cancel");
  });
});

describe("UI-DOC-14: Documents page isolation — no Finance Center integration", () => {
  it("documents page does NOT import finance-related modules", () => {
    expect(PAGE).not.toContain("finance");
    expect(PAGE).not.toContain("Finance");
  });

  it("documents page does NOT reference GL, settlement, payout, or reconciliation", () => {
    expect(PAGE).not.toContain("glEntry");
    expect(PAGE).not.toContain("settlement");
    expect(PAGE).not.toContain("payout");
    expect(PAGE).not.toContain("reconciliation");
  });

  it("documents API module does NOT import finance modules", () => {
    const api = read("lib/documents-api.ts");
    expect(api).not.toContain("finance");
    expect(api).not.toContain("Finance");
  });
});

describe("UI-DOC: documentsApi module exports correct interface", () => {
  it("exports list, get, downloadUrl, invalidate methods", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("documentsApi");
    expect(api).toContain("list:");
    expect(api).toContain("get:");
    expect(api).toContain("downloadUrl:");
    expect(api).toContain("invalidate:");
  });

  it("exports DOCUMENT_TYPES and DOCUMENT_STATUSES constants", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("DOCUMENT_TYPES");
    expect(api).toContain("DOCUMENT_STATUSES");
  });

  it("list method calls /documents endpoint", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("`/documents${");
  });

  it("get method calls /documents/:id endpoint", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("/documents/${id}");
  });

  it("downloadUrl returns /api/v1/documents/:id/download", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("/api/v1/documents/${id}/download");
  });

  it("invalidate posts reason to /documents/:id/invalidate", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("/documents/${id}/invalidate");
  });
});
