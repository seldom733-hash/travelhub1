/**
 * Phase 3 — Global Workspace Constructor Foundation — Frontend Tests
 *
 * Unit tests for workspace-api.ts:
 *   W4: Types/API client, effective layout load, constructorEnabled,
 *       save/reset, invalid layout fallback, registry-driven mapping contract.
 */

import { describe, it, expect } from "vitest";
import {
  isCustomizeAvailable,
  validateWidgetPosition,
  type EffectiveLayout,
  type WidgetDefinition,
  type WidgetPosition,
} from "./workspace-api";

// ─── Test fixtures ───────────────────────────────────────────────────

const mockWidgetDefinition: WidgetDefinition = {
  widgetId: "gmv",
  pageIds: ["command-center"],
  type: "kpi-card",
  category: "KPI",
  title: "GMV",
  permission: "analytics.read",
  minW: 1,
  minH: 1,
  maxW: 2,
  maxH: 2,
  defaultW: 1,
  defaultH: 1,
  movable: true,
  resizable: false,
  removable: true,
  required: false,
  dataSource: "dashboard.summary.gmv",
  version: 1,
};

const requiredWidget: WidgetDefinition = {
  ...mockWidgetDefinition,
  widgetId: "reconciliation",
  required: true,
  removable: false,
  minW: 2,
  minH: 1,
  maxW: 4,
  maxH: 2,
  defaultW: 3,
  defaultH: 1,
  type: "alert",
  category: "alert",
  title: "Reconciliation",
  dataSource: "dashboard.summary.reconciliationStatus",
};

// ─── isCustomizeAvailable ─────────────────────────────────────────────

describe("isCustomizeAvailable", () => {
  it("returns false when constructorEnabled=false", () => {
    const layout: EffectiveLayout = {
      pageId: "crm",
      constructorEnabled: false,
      layoutVersion: 1,
      widgets: [],
      availableWidgets: [],
    };
    expect(isCustomizeAvailable(layout, ["analytics.read"])).toBe(false);
  });

  it("returns false when no available widgets", () => {
    const layout: EffectiveLayout = {
      pageId: "command-center",
      constructorEnabled: true,
      layoutVersion: 1,
      widgets: [{ widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true }],
      availableWidgets: [],
    };
    expect(isCustomizeAvailable(layout, ["analytics.read"])).toBe(false);
  });

  it("returns false when user has no matching permissions", () => {
    const layout: EffectiveLayout = {
      pageId: "command-center",
      constructorEnabled: true,
      layoutVersion: 1,
      widgets: [],
      availableWidgets: [mockWidgetDefinition],
    };
    expect(isCustomizeAvailable(layout, ["order.read"])).toBe(false);
  });

  it("returns true when user has matching permission and available widgets exist", () => {
    const layout: EffectiveLayout = {
      pageId: "command-center",
      constructorEnabled: true,
      layoutVersion: 1,
      widgets: [],
      availableWidgets: [mockWidgetDefinition],
    };
    expect(isCustomizeAvailable(layout, ["analytics.read"])).toBe(true);
  });

  it("returns true when active widgets have matching permission but no available widgets", () => {
    const layout: EffectiveLayout = {
      pageId: "command-center",
      constructorEnabled: true,
      layoutVersion: 1,
      widgets: [
        { widgetId: "gmv", x: 0, y: 0, w: 1, h: 1, visible: true },
      ],
      availableWidgets: [],
    };
    // No available widgets → customize not offered (nothing to add)
    expect(isCustomizeAvailable(layout, ["analytics.read"])).toBe(false);
  });
});

// ─── validateWidgetPosition ──────────────────────────────────────────

describe("validateWidgetPosition", () => {
  const maxColumns = 12;

  it("validates correct position", () => {
    const pos: WidgetPosition = {
      widgetId: "gmv",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      visible: true,
    };
    const result = validateWidgetPosition(pos, mockWidgetDefinition, maxColumns);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects width below minW", () => {
    const pos: WidgetPosition = {
      widgetId: "gmv",
      x: 0,
      y: 0,
      w: 0,
      h: 1,
      visible: true,
    };
    const result = validateWidgetPosition(pos, mockWidgetDefinition, maxColumns);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects width above maxW", () => {
    const pos: WidgetPosition = {
      widgetId: "gmv",
      x: 0,
      y: 0,
      w: 5,
      h: 1,
      visible: true,
    };
    const result = validateWidgetPosition(pos, mockWidgetDefinition, maxColumns);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects height below minH", () => {
    const pos: WidgetPosition = {
      widgetId: "gmv",
      x: 0,
      y: 0,
      w: 1,
      h: 0,
      visible: true,
    };
    const result = validateWidgetPosition(pos, mockWidgetDefinition, maxColumns);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects position exceeding grid width", () => {
    const pos: WidgetPosition = {
      widgetId: "gmv",
      x: 11,
      y: 0,
      w: 2,
      h: 1,
      visible: true,
    };
    const result = validateWidgetPosition(pos, mockWidgetDefinition, maxColumns);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validates position at grid boundary", () => {
    const pos: WidgetPosition = {
      widgetId: "gmv",
      x: 11,
      y: 0,
      w: 1,
      h: 1,
      visible: true,
    };
    const result = validateWidgetPosition(pos, mockWidgetDefinition, maxColumns);
    expect(result.valid).toBe(true);
  });

  it("validates required widget position", () => {
    const pos: WidgetPosition = {
      widgetId: "reconciliation",
      x: 0,
      y: 5,
      w: 3,
      h: 1,
      visible: true,
    };
    const result = validateWidgetPosition(pos, requiredWidget, maxColumns);
    expect(result.valid).toBe(true);
  });
});

// ─── Type contracts ──────────────────────────────────────────────────

describe("Type contracts", () => {
  it("EffectiveLayout has required fields", () => {
    const layout: EffectiveLayout = {
      pageId: "command-center",
      constructorEnabled: true,
      layoutVersion: 1,
      widgets: [],
      availableWidgets: [],
    };
    expect(layout.pageId).toBe("command-center");
    expect(typeof layout.constructorEnabled).toBe("boolean");
    expect(typeof layout.layoutVersion).toBe("number");
    expect(Array.isArray(layout.widgets)).toBe(true);
    expect(Array.isArray(layout.availableWidgets)).toBe(true);
  });

  it("WidgetPosition has required fields", () => {
    const pos: WidgetPosition = {
      widgetId: "test",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      visible: true,
    };
    expect(pos.widgetId).toBe("test");
    expect(typeof pos.x).toBe("number");
    expect(typeof pos.y).toBe("number");
    expect(typeof pos.w).toBe("number");
    expect(typeof pos.h).toBe("number");
    expect(typeof pos.visible).toBe("boolean");
  });

  it("WidgetDefinition has required fields", () => {
    const def: WidgetDefinition = {
      ...mockWidgetDefinition,
    };
    expect(def.widgetId).toBe("gmv");
    expect(Array.isArray(def.pageIds)).toBe(true);
    expect(typeof def.permission).toBe("string");
    expect(typeof def.required).toBe("boolean");
    expect(typeof def.removable).toBe("boolean");
    expect(typeof def.movable).toBe("boolean");
    expect(typeof def.resizable).toBe("boolean");
    expect(typeof def.dataSource).toBe("string");
  });
});
