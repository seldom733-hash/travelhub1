import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
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

  @Post("notifications/:id/read")
  read(@CurrentUser() user: AuthedRequest["user"], @Param("id") id: string) { return this.assignment.markRead(user.id, id); }
}
