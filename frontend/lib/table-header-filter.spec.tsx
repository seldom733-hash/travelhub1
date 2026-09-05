// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TableHeaderFilter from "@/components/TableHeaderFilter";
import {
  readSortFromUrl,
  writeSortToUrl,
  readFiltersFromUrl,
  writeFilterToUrl,
  resetRegistryState,
  SORT_PARAM_KEYS,
  REGISTRY_FILTER_MAPPINGS,
} from "./registry-url-state";

// ── TableHeaderFilter component tests ──────────────────────────────────────

describe("TableHeaderFilter — rendering", () => {
  it("renders label and filter icon button", () => {
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[{ value: "NEW", label: "Новый" }]}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Статус")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Статус filter/i })).toBeTruthy();
  });

  it("shows active state when value is set", () => {
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[{ value: "NEW", label: "Новый" }]}
        value="NEW"
        onChange={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /Статус filter/i });
    expect(btn.className).toContain("bg-blue-100");
  });

  it("shows inactive state when value is empty", () => {
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[{ value: "NEW", label: "Новый" }]}
        value=""
        onChange={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /Статус filter/i });
    expect(btn.className).not.toContain("bg-blue-100");
  });

  it("disables the button when disabled prop is true", () => {
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[]}
        value=""
        onChange={() => {}}
        disabled
      />,
    );
    expect(screen.getByRole("button", { name: /Статус filter/i }).getAttribute("disabled")).not.toBeNull();
  });
});

describe("TableHeaderFilter — interaction", () => {
  it("opens dropdown on click and shows all options", () => {
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[
          { value: "NEW", label: "Новый" },
          { value: "CLOSED", label: "Закрыт" },
        ]}
        value=""
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Статус filter/i }));
    expect(screen.getByRole("option", { name: "Все" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Новый" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Закрыт" })).toBeTruthy();
  });

  it("calls onChange with value when option selected", () => {
    const onChange = vi.fn();
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[{ value: "NEW", label: "Новый" }]}
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Статус filter/i }));
    fireEvent.click(screen.getByRole("option", { name: "Новый" }));
    expect(onChange).toHaveBeenCalledWith("NEW");
  });

  it("calls onChange with empty string when clicking active option (toggle off)", () => {
    const onChange = vi.fn();
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[{ value: "NEW", label: "Новый" }]}
        value="NEW"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Статус filter/i }));
    fireEvent.click(screen.getByRole("option", { name: "Новый" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("calls onChange with empty string when 'All' selected", () => {
    const onChange = vi.fn();
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[{ value: "NEW", label: "Новый" }]}
        value="NEW"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Статус filter/i }));
    fireEvent.click(screen.getByRole("option", { name: "Все" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("sets aria-expanded correctly", () => {
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[]}
        value=""
        onChange={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /Статус filter/i });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes dropdown on Escape", () => {
    render(
      <TableHeaderFilter
        id="filter-status"
        label="Статус"
        options={[{ value: "NEW", label: "Новый" }]}
        value=""
        onChange={() => {}}
      />,
    );
    const btn = screen.getByRole("button", { name: /Статус filter/i });
    fireEvent.click(btn);
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(btn, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

// ── URL state helper tests ─────────────────────────────────────────────────

describe("registry-url-state — sort helpers", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/app/orders");
  });

  it("readSortFromUrl returns null when no sort params", () => {
    const sp = new URLSearchParams("");
    expect(readSortFromUrl(sp)).toBeNull();
  });

  it("readSortFromUrl reads sortBy and sortOrder", () => {
    const sp = new URLSearchParams("sortBy=createdAt&sortOrder=asc");
    expect(readSortFromUrl(sp)).toEqual({ sortBy: "createdAt", sortOrder: "asc" });
  });

  it("readSortFromUrl defaults to desc for invalid sortOrder", () => {
    const sp = new URLSearchParams("sortBy=amount&sortOrder=garbage");
    expect(readSortFromUrl(sp)).toEqual({ sortBy: "amount", sortOrder: "desc" });
  });

  it("writeSortToUrl sets sort params and clears page", () => {
    window.history.replaceState(null, "", "/app/orders?dateFrom=2026-09-01&page=3");
    writeSortToUrl("amount", "asc");
    const sp = new URLSearchParams(window.location.search);
    expect(sp.get("sortBy")).toBe("amount");
    expect(sp.get("sortOrder")).toBe("asc");
    expect(sp.get("page")).toBeNull();
    expect(sp.get("dateFrom")).toBe("2026-09-01"); // period preserved
  });

  it("writeSortToUrl(null) clears sort params", () => {
    window.history.replaceState(null, "", "/app/orders?sortBy=amount&sortOrder=asc");
    writeSortToUrl(null, null);
    const sp = new URLSearchParams(window.location.search);
    expect(sp.get("sortBy")).toBeNull();
    expect(sp.get("sortOrder")).toBeNull();
  });
});

describe("registry-url-state — filter helpers", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/app/orders");
  });

  it("readFiltersFromUrl reads filter values from URL", () => {
    const sp = new URLSearchParams("status=CLOSED&paymentStatus=PAID");
    const result = readFiltersFromUrl(sp, {
      statusFilter: "status",
      paymentStatusFilter: "paymentStatus",
    });
    expect(result).toEqual({ statusFilter: "CLOSED", paymentStatusFilter: "PAID" });
  });

  it("readFiltersFromUrl returns empty strings for missing params", () => {
    const sp = new URLSearchParams("");
    const result = readFiltersFromUrl(sp, { statusFilter: "status" });
    expect(result).toEqual({ statusFilter: "" });
  });

  it("writeFilterToUrl sets filter param and clears page", () => {
    window.history.replaceState(null, "", "/app/orders?page=5&dateFrom=2026-09-01");
    writeFilterToUrl("status", "CLOSED");
    const sp = new URLSearchParams(window.location.search);
    expect(sp.get("status")).toBe("CLOSED");
    expect(sp.get("page")).toBeNull();
    expect(sp.get("dateFrom")).toBe("2026-09-01"); // period preserved
  });

  it("writeFilterToUrl(null) removes filter param", () => {
    window.history.replaceState(null, "", "/app/orders?status=CLOSED");
    writeFilterToUrl("status", null);
    const sp = new URLSearchParams(window.location.search);
    expect(sp.get("status")).toBeNull();
  });
});

describe("registry-url-state — resetRegistryState", () => {
  it("clears registry filters, sort, search, page — preserves period", () => {
    window.history.replaceState(
      null,
      "",
      "/app/orders?status=CLOSED&paymentStatus=PAID&sortBy=amount&sortOrder=asc&search=TH-2026&page=3&dateFrom=2026-09-01&dateTo=2026-10-01",
    );
    resetRegistryState(["status", "paymentStatus"]);
    const sp = new URLSearchParams(window.location.search);
    expect(sp.get("status")).toBeNull();
    expect(sp.get("paymentStatus")).toBeNull();
    expect(sp.get("sortBy")).toBeNull();
    expect(sp.get("sortOrder")).toBeNull();
    expect(sp.get("search")).toBeNull();
    expect(sp.get("page")).toBeNull();
    expect(sp.get("dateFrom")).toBe("2026-09-01"); // preserved
    expect(sp.get("dateTo")).toBe("2026-10-01"); // preserved
  });
});

describe("registry-url-state — REGISTRY_FILTER_MAPPINGS", () => {
  it("requests has status filter", () => {
    expect(REGISTRY_FILTER_MAPPINGS.requests).toEqual({ statusFilter: "status" });
  });

  it("orders has status + paymentStatus filters", () => {
    expect(REGISTRY_FILTER_MAPPINGS.orders).toEqual({
      statusFilter: "status",
      paymentStatusFilter: "paymentStatus",
    });
  });

  it("bookings has status filter", () => {
    expect(REGISTRY_FILTER_MAPPINGS.bookings).toEqual({ statusFilter: "status" });
  });

  it("payments has paymentStatus + refundStatus + currencyCard filters", () => {
    expect(REGISTRY_FILTER_MAPPINGS.payments).toEqual({
      paymentStatusFilter: "paymentStatus",
      refundStatusFilter: "refundStatus",
      currencyCardFilter: "currencyCard",
    });
  });
});

describe("registry-url-state — SORT_PARAM_KEYS", () => {
  it("uses canonical param names", () => {
    expect(SORT_PARAM_KEYS.sortBy).toBe("sortBy");
    expect(SORT_PARAM_KEYS.sortOrder).toBe("sortOrder");
  });
});
