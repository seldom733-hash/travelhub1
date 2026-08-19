/**
 * Global Workspace Constructor Foundation — Service Unit Tests
 *
 * Test waves:
 *   W0: Page/Widget registry integrity
 *   W1: Effective layout resolver (hierarchy, reset, sanitization)
 *   W2: Persistence (create/update/upsert, uniqueness, concurrent)
 *   W3: RBAC filtering, required widget restoration, versioning
 */

import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { WorkspaceService } from "./workspace.service";
import {
  PAGE_REGISTRY,
  WIDGET_REGISTRY,
  getPageDefinition,
  getWidgetsForPage,
  filterWidgetsByPermission,
  buildDefaultLayout,
  getWidgetDefinition,
  type WidgetPosition,
} from "./workspace.types";

// ─── W0: REGISTRY INTEGRITY ─────────────────────────────────────────

describe("W0: Page Registry", () => {
  it("has at least 1 page", () => {
    expect(PAGE_REGISTRY.length).toBeGreaterThanOrEqual(1);
  });

  it("every page has unique pageId", () => {
    const ids = PAGE_REGISTRY.map((p) => p.pageId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("command-center is constructor enabled", () => {
    const cc = getPageDefinition("command-center");
    expect(cc).toBeDefined();
    expect(cc!.constructorEnabled).toBe(true);
  });

  it("requiredWidgets exist in defaultWidgets", () => {
    for (const page of PAGE_REGISTRY) {
      for (const reqId of page.requiredWidgets) {
        expect(page.defaultWidgets).toContain(reqId);
      }
    }
  });

  it("requiredWidgets widgetIds exist in WIDGET_REGISTRY", () => {
    for (const page of PAGE_REGISTRY) {
      for (const reqId of page.requiredWidgets) {
        expect(getWidgetDefinition(reqId)).toBeDefined();
      }
    }
  });

  it("defaultWidgets widgetIds exist in WIDGET_REGISTRY for enabled pages", () => {
    for (const page of PAGE_REGISTRY) {
      if (!page.constructorEnabled) continue;
      for (const wid of page.defaultWidgets) {
        expect(getWidgetDefinition(wid)).toBeDefined();
      }
    }
  });
});

describe("W0: Widget Registry", () => {
  it("has at least 1 widget", () => {
    expect(WIDGET_REGISTRY.length).toBeGreaterThanOrEqual(1);
  });

  it("every widget has unique widgetId", () => {
    const ids = WIDGET_REGISTRY.map((w) => w.widgetId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every widget references valid pageIds", () => {
    const pageIds = new Set(PAGE_REGISTRY.map((p) => p.pageId));
    for (const w of WIDGET_REGISTRY) {
      for (const pid of w.pageIds) {
        expect(pageIds.has(pid)).toBe(true);
      }
    }
  });

  it("minW/minH >= 1", () => {
    for (const w of WIDGET_REGISTRY) {
      expect(w.minW).toBeGreaterThanOrEqual(1);
      expect(w.minH).toBeGreaterThanOrEqual(1);
    }
  });

  it("default size within min/max bounds", () => {
    for (const w of WIDGET_REGISTRY) {
      expect(w.defaultW).toBeGreaterThanOrEqual(w.minW);
      expect(w.defaultW).toBeLessThanOrEqual(w.maxW);
      expect(w.defaultH).toBeGreaterThanOrEqual(w.minH);
      expect(w.defaultH).toBeLessThanOrEqual(w.maxH);
    }
  });

  it("required widgets are non-removable", () => {
    for (const w of WIDGET_REGISTRY) {
      if (w.required) {
        expect(w.removable).toBe(false);
      }
    }
  });

  it("reconciliation widget is required on command-center", () => {
    const rec = getWidgetDefinition("reconciliation");
    expect(rec).toBeDefined();
    expect(rec!.required).toBe(true);
    expect(rec!.removable).toBe(false);
    expect(rec!.pageIds).toContain("command-center");
  });
});

// ─── W1: EFFECTIVE LAYOUT RESOLVER ───────────────────────────────────

describe("W1: buildDefaultLayout", () => {
  it("returns positions for command-center", () => {
    const positions = buildDefaultLayout("command-center");
    expect(positions.length).toBeGreaterThanOrEqual(1);
  });

  it("all positions have visible=true", () => {
    const positions = buildDefaultLayout("command-center");
    for (const p of positions) {
      expect(p.visible).toBe(true);
    }
  });

  it("all positions reference valid widgetIds", () => {
    const positions = buildDefaultLayout("command-center");
    for (const p of positions) {
      expect(getWidgetDefinition(p.widgetId)).toBeDefined();
    }
  });

  it("returns empty for unknown page", () => {
    expect(buildDefaultLayout("nonexistent")).toEqual([]);
  });

  it("positions fit within grid width", () => {
    const page = getPageDefinition("command-center")!;
    const positions = buildDefaultLayout("command-center");
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(page.maxColumns);
    }
  });
});

// ─── W2: PERSISTENCE (mock-based) ────────────────────────────────────

describe("W2: WorkspaceService", () => {
  let service: WorkspaceService;
  let mockPrisma: { userWorkspaceLayout: { findUnique: jest.Mock; upsert: jest.Mock; delete: jest.Mock } };

  beforeEach(() => {
    mockPrisma = {
      userWorkspaceLayout: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    service = new WorkspaceService(mockPrisma as never);
  });

  describe("getEffectiveLayout", () => {
    it("returns system default for user without saved layout", async () => {
      const layout = await service.getEffectiveLayout(
        "user-1",
        "command-center",
        ["analytics.read"],
        "ANALYST",
      );
      expect(layout.pageId).toBe("command-center");
      expect(layout.constructorEnabled).toBe(true);
      expect(layout.widgets.length).toBeGreaterThanOrEqual(1);
    });

    it("throws NotFoundException for unknown page", async () => {
      await expect(
        service.getEffectiveLayout("user-1", "nonexistent", ["analytics.read"]),
      ).rejects.toThrow(NotFoundException);
    });

    it("filters widgets by permission", async () => {
      // User with no permissions should get no widgets
      const layout = await service.getEffectiveLayout(
        "user-1",
        "command-center",
        [], // no permissions
      );
      expect(layout.widgets.length).toBe(0);
    });

    it("restores required widgets even when missing", async () => {
      // Mock saved layout WITHOUT required reconciliation widget
      const savedWidgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
      ];
      (mockPrisma.userWorkspaceLayout.findUnique as jest.Mock).mockResolvedValue({
        widgets: savedWidgets,
      });

      const layout = await service.getEffectiveLayout(
        "user-1",
        "command-center",
        ["analytics.read"],
      );

      const widgetIds = layout.widgets.map((w) => w.widgetId);
      expect(widgetIds).toContain("reconciliation");
    });

    it("applies role default when no user layout exists", async () => {
      // DIRECTOR role has more widgets
      const layout = await service.getEffectiveLayout(
        "user-1",
        "command-center",
        ["analytics.read"],
        "DIRECTOR",
      );
      expect(layout.widgets.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("saveLayout", () => {
    it("saves valid layout via upsert", async () => {
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
      ];
      await service.saveLayout("user-1", "command-center", widgets, [
        "analytics.read",
      ]);
      expect(mockPrisma.userWorkspaceLayout.upsert).toHaveBeenCalledTimes(1);
    });

    it("throws for disabled constructor page", async () => {
      await expect(
        service.saveLayout("user-1", "crm", [], ["crm.customer.read"]),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws for unknown page", async () => {
      await expect(
        service.saveLayout("user-1", "nonexistent", [], []),
      ).rejects.toThrow(NotFoundException);
    });

    it("sanitizes unknown widgetIds from layout", async () => {
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
        {
          widgetId: "nonexistent-widget",
          x: 1,
          y: 0,
          w: 1,
          h: 1,
          visible: true,
        },
      ];
      await service.saveLayout("user-1", "command-center", widgets, [
        "analytics.read",
      ]);

      const savedWidgets = (
        mockPrisma.userWorkspaceLayout.upsert
      ).mock.calls[0][0].create.widgets as WidgetPosition[];
      expect(savedWidgets.find((w) => w.widgetId === "nonexistent-widget")).toBeUndefined();
    });

    it("sanitizes duplicate widgetIds", async () => {
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
        { widgetId: "gmv", x: 1, y: 0, w: 1, h: 1, visible: true },
      ];
      await service.saveLayout("user-1", "command-center", widgets, [
        "analytics.read",
      ]);

      const savedWidgets = (
        mockPrisma.userWorkspaceLayout.upsert
      ).mock.calls[0][0].create.widgets as WidgetPosition[];
      const gmvWidgets = savedWidgets.filter((w) => w.widgetId === "gmv");
      expect(gmvWidgets.length).toBe(1);
    });

    it("restores required widget on save", async () => {
      // Save layout WITHOUT required reconciliation
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
      ];
      await service.saveLayout("user-1", "command-center", widgets, [
        "analytics.read",
      ]);

      const savedWidgets = (
        mockPrisma.userWorkspaceLayout.upsert
      ).mock.calls[0][0].create.widgets as WidgetPosition[];
      expect(savedWidgets.find((w) => w.widgetId === "reconciliation")).toBeDefined();
    });

    it("filters out forbidden widgets on save, but required restored", async () => {
      // User has no permissions — non-required widgets filtered, required restored
      const widgets: WidgetPosition[] = [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
      ];
      await service.saveLayout("user-1", "command-center", widgets, []);

      const savedWidgets = (
        mockPrisma.userWorkspaceLayout.upsert
      ).mock.calls[0][0].create.widgets as WidgetPosition[];
      // reconciliation is required → restored even with empty permissions
      expect(savedWidgets.length).toBe(1);
      expect(savedWidgets[0].widgetId).toBe("reconciliation");
    });
  });

  describe("resetLayout", () => {
    it("deletes user layout (idempotent)", async () => {
      const layout = await service.resetLayout(
        "user-1",
        "command-center",
        ["analytics.read"],
      );
      expect(mockPrisma.userWorkspaceLayout.delete).toHaveBeenCalledTimes(1);
      expect(layout.widgets.length).toBeGreaterThanOrEqual(1);
    });

    it("returns default even if no layout existed", async () => {
      (
        mockPrisma.userWorkspaceLayout.delete
      ).mockRejectedValue(new Error("Record not found"));
      const layout = await service.resetLayout(
        "user-1",
        "command-center",
        ["analytics.read"],
      );
      expect(layout.widgets.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getAvailableWidgets", () => {
    it("returns widgets for valid page", () => {
      const widgets = service.getAvailableWidgets("command-center", [
        "analytics.read",
      ]);
      expect(widgets.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by permission", () => {
      const all = service.getAvailableWidgets("command-center", [
        "analytics.read",
      ]);
      const none = service.getAvailableWidgets("command-center", []);
      expect(none.length).toBeLessThan(all.length);
    });

    it("throws for unknown page", () => {
      expect(() =>
        service.getAvailableWidgets("nonexistent", []),
      ).toThrow(NotFoundException);
    });
  });
});
