/**
 * Global Workspace Constructor Foundation — Controller
 *
 * API endpoints for workspace/page constructor.
 * Auth: JwtAuthGuard applied globally via APP_GUARD.
 * Permissions: @RequirePermissions decorator per endpoint.
 *
 * Routes:
 *   GET    /api/v1/workspaces/:pageId           → effective layout
 *   GET    /api/v1/workspaces/:pageId/widgets    → available widgets
 *   PUT    /api/v1/workspaces/:pageId/layout     → save user layout
 *   DELETE /api/v1/workspaces/:pageId/layout     → reset to default
 *
 * Architecture authority: docs/architecture/global-workspace-constructor-phase3.md
 */

import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Put,
  Body,
  Param,
} from "@nestjs/common";
import { CurrentUser } from "../../security/auth/decorators";
import type { AuthUser } from "../../security/auth/auth.service";
import { WorkspaceService } from "./workspace.service";
import type { WidgetPosition } from "./workspace.types";

@Controller("api/v1/workspaces")
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * GET /api/v1/workspaces/:pageId
   * Returns effective layout: system default + role default + user override,
   * filtered by RBAC, with required widgets restored.
   * Step 3.2: Requires analytics.read for Command Center (page gate).
   */
  @Get(":pageId")
  async getEffectiveLayout(
    @Param("pageId") pageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // Step 3.2: analytics.read page gate for Command Center
    if (pageId === "command-center") {
      if (!user.permissions.includes("analytics.read")) {
        throw new ForbiddenException("analytics.read required for Command Center");
      }
    }
    return this.workspaceService.getEffectiveLayout(
      user.id,
      pageId,
      user.permissions,
      user.role,
    );
  }

  /**
   * GET /api/v1/workspaces/:pageId/widgets
   * Returns available widgets for a page, filtered by user permissions.
   * Step 3.2: Requires analytics.read for Command Center (page gate).
   */
  @Get(":pageId/widgets")
  async getAvailableWidgets(
    @Param("pageId") pageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // Step 3.2: analytics.read page gate for Command Center
    if (pageId === "command-center") {
      if (!user.permissions.includes("analytics.read")) {
        throw new ForbiddenException("analytics.read required for Command Center");
      }
    }
    return this.workspaceService.getAvailableWidgets(
      pageId,
      user.permissions,
    );
  }

  /**
   * PUT /api/v1/workspaces/:pageId/layout
   * Save user layout. Idempotent upsert for (userId, pageId).
   * Step 3.2: Requires analytics.read + dashboard.customize for Command Center.
   */
  @Put(":pageId/layout")
  async saveLayout(
    @Param("pageId") pageId: string,
    @Body() body: { widgets: WidgetPosition[] },
    @CurrentUser() user: AuthUser,
  ) {
    // Step 3.2: dashboard.customize enforcement for Command Center
    if (pageId === "command-center") {
      if (!user.permissions.includes("analytics.read")) {
        throw new ForbiddenException("analytics.read required for Command Center");
      }
      if (!user.permissions.includes("dashboard.customize")) {
        throw new ForbiddenException("dashboard.customize required to save layout");
      }
    }
    return this.workspaceService.saveLayout(
      user.id,
      pageId,
      body.widgets ?? [],
      user.permissions,
    );
  }

  /**
   * DELETE /api/v1/workspaces/:pageId/layout
   * Reset user layout to system/role default. Idempotent.
   * Step 3.2: Requires analytics.read + dashboard.customize for Command Center.
   */
  @Delete(":pageId/layout")
  @HttpCode(200)
  async resetLayout(
    @Param("pageId") pageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // Step 3.2: dashboard.customize enforcement for Command Center
    if (pageId === "command-center") {
      if (!user.permissions.includes("analytics.read")) {
        throw new ForbiddenException("analytics.read required for Command Center");
      }
      if (!user.permissions.includes("dashboard.customize")) {
        throw new ForbiddenException("dashboard.customize required to reset layout");
      }
    }
    return this.workspaceService.resetLayout(
      user.id,
      pageId,
      user.permissions,
      user.role,
    );
  }
}
