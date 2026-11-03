import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { AssignmentService } from "./assignment.service";

@UseGuards(JwtAuthGuard)
@Controller("sales/assignment")
export class AssignmentController {
  constructor(private readonly assignment: AssignmentService) {}

  @Get("load")
  @RequirePermissions("request.load.read")
  load() { return this.assignment.load(); }

  @Get("notifications")
  notifications(@CurrentUser() user: AuthedRequest["user"], @Query("unread") unread?: string) {
    return this.assignment.list(user.id, unread === "true");
  }

  @Get("notifications/unread-count")
  unreadCount(@CurrentUser() user: AuthedRequest["user"]) { return this.assignment.unread(user.id); }

  @Post("notifications/read-entity")
  readEntity(@CurrentUser() user: AuthedRequest["user"], @Body() body: { entityType: string; entityId: string }) {
    return this.assignment.markByEntity(user.id, body.entityType, body.entityId);
  }

  @Post("managers/:userId/settings")
  @RequirePermissions("request.assignment.manage")
  managerSettings(@Param("userId") userId: string, @Body() body: { availability?: string; participates?: boolean; maxActiveRequests?: number | null }) {
    return this.assignment.setManagerSettings(userId, body);
  }

  @Get("settings")
  @RequirePermissions("request.assignment.read")
  settings() { return this.assignment.getSettings(); }

  @Post("settings")
  @RequirePermissions("request.assignment.manage")
  updateSettings(@CurrentUser() user: AuthedRequest["user"], @Body() body: { mode: string }) {
    return this.assignment.updateSettings(body.mode, { id: user.id, username: user.username });
  }

  @Get("me/status")
  @RequirePermissions("request.load.read")
  myStatusGet(@CurrentUser() user: AuthedRequest["user"]) {
    return this.assignment.getMyStatus(user.id);
  }

  @Post("me/status")
  @RequirePermissions("request.load.read")
  myStatus(@CurrentUser() user: AuthedRequest["user"], @Body() body: { status: string }) {
    return this.assignment.setMyStatus(user.id, body.status);
  }

  @Get("unassigned")
  @RequirePermissions("request.assignment.read")
  unassigned() { return this.assignment.unassigned(); }

  @Post(":requestId/reassign")
  @RequirePermissions("request.assignment.reassign")
  reassign(@CurrentUser() user: AuthedRequest["user"], @Param("requestId") requestId: string, @Body() body: { managerId: string; reason?: string; expectedManagerId?: string }) {
    return this.assignment.reassign(requestId, body.managerId, body.reason ?? "", { id: user.id, username: user.username }, body.expectedManagerId);
  }

  @Post(":requestId/self-assign")
  @RequirePermissions("request.assignment.self_assign")
  selfAssign(@CurrentUser() user: AuthedRequest["user"], @Param("requestId") requestId: string) {
    return this.assignment.selfAssign(requestId, { id: user.id, username: user.username });
  }

  @Post(":requestId/assign")
  @RequirePermissions("request.assignment.manage")
  assign(@CurrentUser() user: AuthedRequest["user"], @Param("requestId") requestId: string) {
    return this.assignment.assign(requestId, { id: user.id, username: user.username });
  }

  @Post("notifications/:id/read")
  read(@CurrentUser() user: AuthedRequest["user"], @Param("id") id: string) { return this.assignment.markRead(user.id, id); }
}
