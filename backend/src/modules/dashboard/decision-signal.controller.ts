// ─── Decision Signal Controller ──────────────────────────────────────────────
// Minimal API foundation: list, get, acknowledge, resolve, dismiss.
// Page gate: analytics.read (same as Command Center).
// Signal mutations require additional section-level permission.

import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  Req,
  ForbiddenException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { RequirePermissions } from "../../security/auth/decorators";
import { DecisionSignalService } from "./decision-signal.service";
import {
  SignalListQuery,
  AcknowledgeSignalDto,
  ResolveSignalDto,
  DismissSignalDto,
} from "./decision-signal.types";

@Controller("api/v1/dashboard/decision-signals")
@RequirePermissions("analytics.read")
export class DecisionSignalController {
  constructor(private readonly signalService: DecisionSignalService) {}

  @Get()
  async list(@Query() query: SignalListQuery, @Req() req: any) {
    const permissions = req.user?.permissions ?? [];
    return this.signalService.listSignals(query, permissions);
  }

  @Get(":id")
  async get(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    const permissions = req.user?.permissions ?? [];
    return this.signalService.getSignal(id, permissions);
  }

  @Post(":id/acknowledge")
  async acknowledge(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AcknowledgeSignalDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    const username = req.user?.username ?? req.user?.sub;
    const permissions = req.user?.permissions ?? [];

    // Must have at least one section permission
    if (!this.hasSectionPermission(permissions)) {
      throw new ForbiddenException("Requires section-level dashboard permission");
    }

    return this.signalService.acknowledge(id, dto, userId, username, permissions);
  }

  @Post(":id/resolve")
  async resolve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveSignalDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    const username = req.user?.username ?? req.user?.sub;
    const permissions = req.user?.permissions ?? [];

    if (!this.hasSectionPermission(permissions)) {
      throw new ForbiddenException("Requires section-level dashboard permission");
    }

    return this.signalService.resolve(id, dto, userId, username, permissions);
  }

  @Post(":id/dismiss")
  async dismiss(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DismissSignalDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    const username = req.user?.username ?? req.user?.sub;
    const permissions = req.user?.permissions ?? [];

    if (!this.hasSectionPermission(permissions)) {
      throw new ForbiddenException("Requires section-level dashboard permission");
    }

    return this.signalService.dismiss(id, dto, userId, username, permissions);
  }

  private hasSectionPermission(permissions: string[]): boolean {
    return permissions.some(
      (p) =>
        p.startsWith("dashboard.") &&
        p.endsWith(".read") &&
        p !== "dashboard.customize",
    );
  }
}
