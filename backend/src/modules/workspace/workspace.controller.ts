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
   */
  @Get(":pageId")
  async getEffectiveLayout(
    @Param("pageId") pageId: string,
    @CurrentUser() user: AuthUser,
  ) {
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
   */
  @Get(":pageId/widgets")
  async getAvailableWidgets(
    @Param("pageId") pageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspaceService.getAvailableWidgets(
      pageId,
      user.permissions,
    );
  }

  /**
   * PUT /api/v1/workspaces/:pageId/layout
   * Save user layout. Idempotent upsert for (userId, pageId).
   * Rejects if constructor is disabled for the page.
   */
  @Put(":pageId/layout")
  async saveLayout(
    @Param("pageId") pageId: string,
    @Body() body: { widgets: WidgetPosition[] },
    @CurrentUser() user: AuthUser,
  ) {
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
   */
  @Delete(":pageId/layout")
  @HttpCode(200)
  async resetLayout(
    @Param("pageId") pageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspaceService.resetLayout(
      user.id,
      pageId,
      user.permissions,
      user.role,
    );
  }
}
