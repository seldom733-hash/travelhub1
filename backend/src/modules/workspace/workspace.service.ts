/**
 * Global Workspace Constructor Foundation — Service
 *
 * Effective Layout Resolver: System Default → Role Default → User Layout.
 * Persistence: UserWorkspaceLayout (Prisma, JSON payload).
 * Validation: pageId, widgetId, positions, config, required widgets, RBAC.
 * Versioning: layout version mismatch → safe sanitization.
 *
 * Architecture authority: docs/architecture/global-workspace-constructor-phase3.md
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import {
  EffectiveLayout,
  getPageDefinition,
  getWidgetsForPage,
  filterWidgetsByPermission,
  buildDefaultLayout,
  getWidgetDefinition,
  type WidgetPosition,
  type WidgetDefinition,
} from "./workspace.types";

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get effective layout for a user on a page.
   * Merge order: System Default → Role Default → User Override.
   * Then apply RBAC filter, version sanitization, required widget restoration.
   */
  async getEffectiveLayout(
    userId: string,
    pageId: string,
    userPermissions: string[],
    userRole?: string,
  ): Promise<EffectiveLayout> {
    const page = getPageDefinition(pageId);
    if (!page) {
      throw new NotFoundException(`Page "${pageId}" not found`);
    }

    // 1. System default layout
    let widgetPositions = buildDefaultLayout(pageId);

    // 2. Role default override (if exists)
    if (userRole && page.roleDefaults?.[userRole]) {
      const roleWidgetIds = page.roleDefaults[userRole];
      const roleWidgets = getWidgetsForPage(pageId).filter((w) =>
        roleWidgetIds.includes(w.widgetId),
      );
      widgetPositions = this.buildPositionsFromWidgetIds(roleWidgets, page.maxColumns);
    }

    // 3. User override
    const userLayout = await this.prisma.userWorkspaceLayout.findUnique({
      where: { userId_pageId: { userId, pageId } },
    });

    if (userLayout) {
      const savedPositions = this.parseAndValidateLayout(
        userLayout.widgets as unknown as WidgetPosition[],
        pageId,
        userPermissions,
        page,
      );
      widgetPositions = savedPositions;
    }

    // 4. Required widget restoration
    widgetPositions = this.ensureRequiredWidgets(widgetPositions, pageId);

    // 5. RBAC filter — remove widgets user cannot access
    const allPageWidgets = getWidgetsForPage(pageId);
    const allowedWidgets = filterWidgetsByPermission(allPageWidgets, userPermissions);
    const allowedIds = new Set(allowedWidgets.map((w) => w.widgetId));
    widgetPositions = widgetPositions.filter((wp) => allowedIds.has(wp.widgetId));

    // 6. Available widgets (not in layout, user has permission)
    const layoutIds = new Set(widgetPositions.map((wp) => wp.widgetId));
    const availableWidgets = allowedWidgets.filter(
      (w) => !layoutIds.has(w.widgetId),
    );

    return {
      pageId,
      constructorEnabled: page.constructorEnabled,
      layoutVersion: page.version,
      widgets: widgetPositions,
      availableWidgets,
    };
  }

  /**
   * Save user layout (upsert).
   * Validates pageId, widgetIds, positions, config.
   * Rejects if constructor is disabled for the page.
   */
  async saveLayout(
    userId: string,
    pageId: string,
    widgets: WidgetPosition[],
    userPermissions: string[],
  ): Promise<EffectiveLayout> {
    const page = getPageDefinition(pageId);
    if (!page) {
      throw new NotFoundException(`Page "${pageId}" not found`);
    }

    if (!page.constructorEnabled) {
      throw new ForbiddenException(
        `Constructor is disabled for page "${pageId}"`,
      );
    }

    // Validate and sanitize the layout
    const validatedWidgets = this.parseAndValidateLayout(
      widgets,
      pageId,
      userPermissions,
      page,
    );

    // Required widget restoration
    const finalWidgets = this.ensureRequiredWidgets(validatedWidgets, pageId);

    // Upsert
    await this.prisma.userWorkspaceLayout.upsert({
      where: { userId_pageId: { userId, pageId } },
      create: {
        userId,
        pageId,
        layoutVersion: page.version,
        widgets: finalWidgets as unknown as Prisma.InputJsonValue,
      },
      update: {
        layoutVersion: page.version,
        widgets: finalWidgets as unknown as Prisma.InputJsonValue,
      },
    });

    return this.getEffectiveLayout(userId, pageId, userPermissions);
  }

  /**
   * Reset user layout to system/role default.
   * Idempotent: if no layout exists, returns default.
   */
  async resetLayout(
    userId: string,
    pageId: string,
    userPermissions: string[],
    userRole?: string,
  ): Promise<EffectiveLayout> {
    const page = getPageDefinition(pageId);
    if (!page) {
      throw new NotFoundException(`Page "${pageId}" not found`);
    }

    // Delete user override (idempotent)
    await this.prisma.userWorkspaceLayout
      .delete({
        where: { userId_pageId: { userId, pageId } },
      })
      .catch(() => undefined); // ignore if not found

    return this.getEffectiveLayout(userId, pageId, userPermissions, userRole);
  }

  /**
   * Get available widgets for a page (filtered by user permissions).
   */
  getAvailableWidgets(
    pageId: string,
    userPermissions: string[],
  ): WidgetDefinition[] {
    const page = getPageDefinition(pageId);
    if (!page) {
      throw new NotFoundException(`Page "${pageId}" not found`);
    }

    const widgets = getWidgetsForPage(pageId);
    return filterWidgetsByPermission(widgets, userPermissions);
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────

  /**
   * Parse, validate, and sanitize a saved layout.
   * - Validates widgetIds exist in registry
   * - Validates positions within grid bounds
   * - Removes duplicates
   * - Removes unknown/removed widgets
   */
  private parseAndValidateLayout(
    rawWidgets: WidgetPosition[],
    pageId: string,
    userPermissions: string[],
    page: { maxColumns: number; requiredWidgets: string[] },
  ): WidgetPosition[] {
    if (!Array.isArray(rawWidgets)) return [];

    const allowedWidgets = getWidgetsForPage(pageId);
    const allowedByPermission = filterWidgetsByPermission(
      allowedWidgets,
      userPermissions,
    );
    const allowedIds = new Set(allowedWidgets.map((w) => w.widgetId));
    const permissionIds = new Set(allowedByPermission.map((w) => w.widgetId));

    const seen = new Set<string>();
    const result: WidgetPosition[] = [];

    for (const wp of rawWidgets) {
      // Skip invalid entries
      if (!wp || typeof wp !== "object" || !wp.widgetId) continue;

      // Skip duplicates
      if (seen.has(wp.widgetId)) continue;
      seen.add(wp.widgetId);

      // Skip unknown widgets (removed from registry)
      if (!allowedIds.has(wp.widgetId)) continue;

      // Skip widgets user cannot access
      if (!permissionIds.has(wp.widgetId)) continue;

      // Validate position
      const validated: WidgetPosition = {
        widgetId: wp.widgetId,
        x: this.clampInt(wp.x, 0, page.maxColumns - 1),
        y: this.clampInt(wp.y, 0, 99),
        w: this.clampInt(wp.w, 1, page.maxColumns),
        h: this.clampInt(wp.h, 1, 8),
        visible: Boolean(wp.visible ?? true),
        config: this.sanitizeConfig(wp.config),
      };

      result.push(validated);
    }

    return result;
  }

  /**
   * Ensure required widgets are present in layout.
   * Adds missing required widgets at the end.
   */
  private ensureRequiredWidgets(
    widgets: WidgetPosition[],
    pageId: string,
  ): WidgetPosition[] {
    const page = getPageDefinition(pageId);
    if (!page) return widgets;

    const existingIds = new Set(widgets.map((w) => w.widgetId));
    const result = [...widgets];

    // Find max Y to append required widgets below
    let maxY = 0;
    for (const w of result) {
      const bottom = w.y + w.h;
      if (bottom > maxY) maxY = bottom;
    }

    for (const reqId of page.requiredWidgets) {
      if (existingIds.has(reqId)) continue;

      const def = getWidgetDefinition(reqId);
      if (!def) continue;

      result.push({
        widgetId: reqId,
        x: 0,
        y: maxY,
        w: def.defaultW,
        h: def.defaultH,
        visible: true,
      });
    }

    return result;
  }

  /** Build widget positions from a list of widget IDs (for role defaults). */
  private buildPositionsFromWidgetIds(
    widgets: WidgetDefinition[],
    maxColumns: number,
  ): WidgetPosition[] {
    const positions: WidgetPosition[] = [];
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;

    for (const widget of widgets) {
      if (currentX + widget.defaultW > maxColumns) {
        currentX = 0;
        currentY += rowHeight;
        rowHeight = 0;
      }

      positions.push({
        widgetId: widget.widgetId,
        x: currentX,
        y: currentY,
        w: widget.defaultW,
        h: widget.defaultH,
        visible: true,
      });

      currentX += widget.defaultW;
      rowHeight = Math.max(rowHeight, widget.defaultH);
    }

    return positions;
  }

  private clampInt(value: unknown, min: number, max: number): number {
    const n = typeof value === "number" ? Math.floor(value) : min;
    return Math.max(min, Math.min(max, n));
  }

  /** Strip unsafe config properties. Allow only safe presentation options. */
  private sanitizeConfig(
    config: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!config || typeof config !== "object") return undefined;

    const allowed = [
      "displayVariant",
      "rowCount",
      "visualizationMode",
      "sortOrder",
      "showHeader",
      "showFooter",
    ];

    const result: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in config) {
        result[key] = config[key];
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
}
