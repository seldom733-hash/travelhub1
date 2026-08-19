/**
 * Global Workspace Constructor Foundation — Frontend API Client
 *
 * Shared types and API client for workspace/page constructor.
 * Fetches effective layout, available widgets, saves/resets layout.
 *
 * Architecture authority: docs/architecture/global-workspace-constructor-phase3.md
 */

import { api } from "./api";

// ─── TYPES ───────────────────────────────────────────────────────────

export type WidgetType =
  | "kpi-card"
  | "chart"
  | "time-series"
  | "table"
  | "status-summary"
  | "alert"
  | "funnel"
  | "list"
  | "custom";

export interface WidgetDefinition {
  widgetId: string;
  pageIds: string[];
  type: WidgetType;
  category: "KPI" | "chart" | "alert" | "list" | "custom";
  title: string;
  permission: string | null;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  defaultW: number;
  defaultH: number;
  movable: boolean;
  resizable: boolean;
  removable: boolean;
  required: boolean;
  dataSource: string;
  version: number;
}

export interface WidgetPosition {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  config?: Record<string, unknown>;
}

export interface EffectiveLayout {
  pageId: string;
  constructorEnabled: boolean;
  layoutVersion: number;
  widgets: WidgetPosition[];
  availableWidgets: WidgetDefinition[];
}

// ─── API CLIENT ──────────────────────────────────────────────────────

export const workspaceApi = {
  /** Get effective layout for a page. */
  getEffectiveLayout(pageId: string): Promise<EffectiveLayout> {
    return api.get<EffectiveLayout>(`/workspaces/${pageId}`);
  },

  /** Get available widgets for a page. */
  getAvailableWidgets(pageId: string): Promise<WidgetDefinition[]> {
    return api.get<WidgetDefinition[]>(`/workspaces/${pageId}/widgets`);
  },

  /** Save user layout (upsert). */
  saveLayout(pageId: string, widgets: WidgetPosition[]): Promise<EffectiveLayout> {
    return api.put<EffectiveLayout>(`/workspaces/${pageId}/layout`, { widgets });
  },

  /** Reset user layout to system/role default. */
  resetLayout(pageId: string): Promise<EffectiveLayout> {
    return api.del<EffectiveLayout>(`/workspaces/${pageId}/layout`);
  },
};

// ─── CONSTRUCTOR MODE ────────────────────────────────────────────────

/**
 * Determine if customize mode is available for a page.
 * Requires: constructorEnabled=true AND user has widget permissions.
 */
export function isCustomizeAvailable(
  layout: EffectiveLayout,
  userPermissions: string[],
): boolean {
  if (!layout.constructorEnabled) return false;
  if (layout.availableWidgets.length === 0) return false;
  return userPermissions.some(
    (p) =>
      layout.availableWidgets.some((w) => w.permission === p) ||
      layout.widgets.some((w) => {
        const def = layout.availableWidgets.find((d) => d.widgetId === w.widgetId);
        return def?.permission === p;
      }),
  );
}

/**
 * Validate a widget position against widget definition constraints.
 */
export function validateWidgetPosition(
  position: WidgetPosition,
  definition: WidgetDefinition,
  maxColumns: number,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (position.w < definition.minW || position.w > definition.maxW) {
    errors.push(
      `Width ${position.w} outside bounds [${definition.minW}, ${definition.maxW}]`,
    );
  }
  if (position.h < definition.minH || position.h > definition.maxH) {
    errors.push(
      `Height ${position.h} outside bounds [${definition.minH}, ${definition.maxH}]`,
    );
  }
  if (position.x < 0 || position.x + position.w > maxColumns) {
    errors.push(
      `Position x=${position.x}+w=${position.w} exceeds grid width ${maxColumns}`,
    );
  }

  return { valid: errors.length === 0, errors };
}
