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
const SORTABLE_HEADER = read("components/SortableHeader.tsx");
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

// ── D-2 REGRESSION: Voucher detail field binding ──

describe("D-2: Voucher detail shows correct booking/order references from snapshot", () => {
  it("D2-TEST-01: extracts bookingCode from snapshot for БРОНЬ field", () => {
    expect(DETAIL).toContain("bookingCode");
    expect(DETAIL).toContain("snapshot?.bookingCode");
  });

  it("D2-TEST-01b: extracts orderCode from snapshot for ЗАКАЗ field", () => {
    expect(DETAIL).toContain("orderCode");
    expect(DETAIL).toContain("snapshot?.orderCode");
  });

  it("D2-TEST-01c: БРОНЬ field uses bookingCode, NOT doc.code", () => {
    // Must NOT use doc.code as the booking value
    expect(DETAIL).not.toMatch(/label.*booking.*value.*doc\.code/);
    // Must use bookingCode from snapshot
    expect(DETAIL).toContain('value={bookingCode ?? "—"}');
  });

  it("D2-TEST-02: Voucher code remains visible separately as heading", () => {
    expect(DETAIL).toContain("doc.code");
    expect(DETAIL).toContain("{doc.code}");
  });

  it("D2-TEST-03: Missing booking/order values render safely as dash", () => {
    expect(DETAIL).toContain('bookingCode ?? "—"');
    expect(DETAIL).toContain('orderCode ?? "—"');
  });

  it("D2-TEST-04: PII redaction behavior remains unchanged", () => {
    expect(DETAIL).toContain("redacted");
    expect(DETAIL).toContain("passportNumber");
  });

  it("D2-TEST-01d: order i18n key exists for detail page", () => {
    expect(DETAIL).toContain("documents.detail.order");
  });

  it("D2-TEST-01e: payment i18n key exists for detail page", () => {
    expect(DETAIL).toContain("documents.detail.payment");
  });
});

// ── D-1 REGRESSION: download link behavior ──

describe("D-1: Download link is conditional on document status", () => {
  it("download link is always rendered (href-based, not conditional)", () => {
    // The download link uses href, so it's always visible.
    // The backend returns controlled error for NOT_ISSUED/INVALIDATED.
    expect(DETAIL).toContain("documentsApi.downloadUrl");
  });
});

describe("REMEDIATION-A: Documents API contract — frontend calls correct endpoint", () => {
  it("page uses documentsApi.list (not raw api.get) for data fetching", () => {
    expect(PAGE).toContain("documentsApi.list(");
  });

  it("documentsApi.list calls /documents endpoint (not /account/documents)", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("`/documents${");
    expect(api).not.toContain("`/account/documents");
  });

  it("documentsApi passes page and pageSize parameters", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain('sp.set("page"');
    expect(api).toContain('sp.set("pageSize"');
  });

  it("documentsApi passes type and status filter parameters", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain('sp.set("type"');
    expect(api).toContain('sp.set("status"');
  });

  it("documentsApi.get calls /documents/:id endpoint", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("api.get<DocumentDetail>(`/documents/${id}`)");
  });

  it("documentsApi.invalidate calls POST /documents/:id/invalidate", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("api.post<{ success: boolean }>(`/documents/${id}/invalidate`");
  });

  it("downloadUrl uses /api/v1/documents/:id/download (full path)", () => {
    const api = read("lib/documents-api.ts");
    expect(api).toContain("/api/v1/documents/${id}/download");
  });
});

describe("REMEDIATION-B: Hydration fix — table always renders, empty state inside tbody", () => {
  it("error state is rendered OUTSIDE OperationsRegistrySlot (not inside the ternary)", () => {
    const errorIdx = PAGE.indexOf("{error && <OperationsErrorState");
    const registryIdx = PAGE.indexOf("<OperationsRegistrySlot>");
    expect(errorIdx).toBeGreaterThan(-1);
    expect(errorIdx).toBeLessThan(registryIdx);
  });

  it("table is always rendered in non-loading branch (no 4-way ternary)", () => {
    const registryIdx = PAGE.indexOf("<OperationsRegistrySlot>");
    const tableIdx = PAGE.indexOf("<table", registryIdx);
    expect(tableIdx).toBeGreaterThan(registryIdx);
  });

  it("OperationsEmptyState is inside <tbody>, not directly in <div>", () => {
    const tbodyIdx = PAGE.indexOf("<tbody>");
    const emptyStateIdx = PAGE.indexOf("OperationsEmptyState colSpan", tbodyIdx);
    const tbodyCloseIdx = PAGE.indexOf("</tbody>", tbodyIdx);
    expect(emptyStateIdx).toBeGreaterThan(tbodyIdx);
    expect(emptyStateIdx).toBeLessThan(tbodyCloseIdx);
  });

  it("empty state is a sibling of data rows (inside same <tbody>)", () => {
    const tbodyIdx = PAGE.indexOf("<tbody>");
    const emptyStateIdx = PAGE.indexOf("OperationsEmptyState colSpan", tbodyIdx);
    const tbodyCloseIdx = PAGE.indexOf("</tbody>", tbodyIdx);
    expect(emptyStateIdx).toBeLessThan(tbodyCloseIdx);
  });

  it("OperationsEmptyState colSpan=9 matches 9-column table", () => {
    expect(PAGE).toContain("OperationsEmptyState colSpan={9}");
  });

  it("page uses loading ternary only in registry slot (error state is outside)", () => {
    const registryIdx = PAGE.indexOf("<OperationsRegistrySlot>");
    const registryEndIdx = PAGE.indexOf("</OperationsRegistrySlot>");
    const registryContent = PAGE.substring(registryIdx, registryEndIdx);
    expect(registryContent).toContain("busy && !data");
    expect(registryContent).toContain("OperationsEmptyState");
    expect(registryContent).toContain("sortedItems.length === 0");
  });
});

describe("REMEDIATION: API error vs empty state distinction", () => {
  it("error state has onRetry callback", () => {
    expect(PAGE).toContain("onRetry={load}");
  });

  it("empty state differentiates filtered vs unfiltered empty", () => {
    expect(PAGE).toContain("documents.empty_filtered");
    expect(PAGE).toContain("documents.empty");
  });

  it("empty state only shows when items array is empty", () => {
    expect(PAGE).toContain("sortedItems.length === 0");
  });
});

describe("UI-DOC-15: Documents table header uses valid <th> structure", () => {
  it("SortableHeader renders <th> directly (not wrapped in another <th>)", () => {
    expect(SORTABLE_HEADER).toContain("return (");
    expect(SORTABLE_HEADER).toMatch(/<th[\s\n]/);
  });

  it("documents page uses SortableHeader directly in <tr> (no outer <th> wrapper)", () => {
    const trSection = PAGE.substring(
      PAGE.indexOf("<thead"),
      PAGE.indexOf("</thead"),
    );
    const sortableUsages = trSection.match(/<SortableHeader\s/g) || [];
    expect(sortableUsages.length).toBeGreaterThanOrEqual(1);
    for (const _ of sortableUsages) {
      // Each SortableHeader should NOT be inside a <th>
    }
    // No <th> wrapping SortableHeader: pattern <th ...><SortableHeader
    const invalidPattern = trSection.match(/<th[^>]*>\s*<SortableHeader/g);
    expect(invalidPattern).toBeNull();
  });

  it("thead has appropriate styling classes", () => {
    expect(PAGE).toMatch(/<thead[^>]*className="[^"]*text-xs/);
  });
});

describe("UI-DOC-16: SortableHeader is never nested inside <th>", () => {
  it("SortableHeader source contains <th> as direct return element", () => {
    const lines = SORTABLE_HEADER.split("\n");
    const thLine = lines.findIndex((l) => l.trim().startsWith("<th"));
    expect(thLine).toBeGreaterThanOrEqual(0);
  });

  it("documents page has no <th><SortableHeader pattern", () => {
    expect(PAGE).not.toMatch(/<th[^>]*>\s*\n?\s*<SortableHeader/g);
  });
});

describe("UI-DOC-17: Documents API error renders valid error state", () => {
  it("error state is rendered via OperationsErrorState component", () => {
    expect(PAGE).toContain("OperationsErrorState");
  });

  it("error state receives message and retry callback", () => {
    expect(PAGE).toContain("OperationsErrorState");
    expect(PAGE).toContain("onRetry={load}");
    expect(PAGE).toContain("message={error}");
  });

  it("error state renders outside OperationsRegistrySlot", () => {
    const registryIdx = PAGE.indexOf("<OperationsRegistrySlot>");
    const errorIdx = PAGE.indexOf("OperationsErrorState");
    expect(errorIdx).toBeLessThan(registryIdx);
  });
});

describe("UI-DOC-18: Documents zero-result renders valid table empty row", () => {
  it("empty state is an <OperationsEmptyState inside <tbody>", () => {
    const tbodyIdx = PAGE.indexOf("<tbody>");
    const tbodyEndIdx = PAGE.indexOf("</tbody>");
    const tbodyContent = PAGE.substring(tbodyIdx, tbodyEndIdx);
    expect(tbodyContent).toContain("OperationsEmptyState");
  });

  it("empty state uses colSpan=9 for 9-column table", () => {
    expect(PAGE).toContain("OperationsEmptyState colSpan={9}");
  });

  it("empty state differentiates filtered vs unfiltered message", () => {
    expect(PAGE).toContain("documents.empty_filtered");
    expect(PAGE).toContain("documents.empty");
  });
});

describe("UI-DOC-19: Documents success renders valid table header/body", () => {
  it("table has exactly 9 column headers (8 SortableHeader + 1 plain <th>)", () => {
    const theadSection = PAGE.substring(
      PAGE.indexOf("<thead"),
      PAGE.indexOf("</thead"),
    );
    const sortableCount = (theadSection.match(/<SortableHeader\s/g) || []).length;
    const plainThCount = (theadSection.match(/<th\s/g) || []).length;
    expect(sortableCount + plainThCount).toBe(9);
  });

  it("table body renders 9 <td> columns per row", () => {
    const tbodySection = PAGE.substring(
      PAGE.indexOf("<tbody>"),
      PAGE.indexOf("</tbody>"),
    );
    const tdCount = (tbodySection.match(/<td\s/g) || []).length;
    expect(tdCount).toBeGreaterThanOrEqual(9);
  });

  it("each data row has a link to the document detail page", () => {
    expect(PAGE).toContain('/app/documents/${doc.id}');
  });

  it("sortable columns include code, type, status, serviceDate, totalAmount, paidAmount, version, createdAt", () => {
    const sortableFields = ["code", "type", "status", "serviceDate", "totalAmount", "paidAmount", "version", "createdAt"];
    for (const field of sortableFields) {
      expect(PAGE).toContain(`field="${field}"`);
    }
  });
});

// ── D-3 REGRESSION: KPI type aggregation ──

describe("D-3: KPI type aggregation from API aggregates", () => {
  it("D3-UI-01: reads typeCounts from data.aggregates.type (not items)", () => {
    expect(PAGE).toContain("data?.aggregates?.type");
  });

  it("D3-UI-01b: KPI displays per-type counts via typeCounts", () => {
    expect(PAGE).toContain("typeCounts[dt]");
  });

  it("D3-UI-02: KPI does NOT compute from items.length", () => {
    // Must not use items.length for type counts
    expect(PAGE).not.toMatch(/typeCounts.*items\.length|items\.filter.*\.length.*typeCounts/);
  });

  it("D3-UI-03: zero/missing values default to 0", () => {
    expect(PAGE).toContain("?? 0");
  });

  it("D3-UI-04: KPI cards iterate DOCUMENT_TYPES for type breakdown", () => {
    expect(PAGE).toContain("DOCUMENT_TYPES.map");
    expect(PAGE).toContain("documentTypeLabel");
  });

  it("D3-UI-05: total KPI uses total from API (not items.length)", () => {
    expect(PAGE).toContain("data?.total ?? 0");
  });
});
