/**
 * Global Workspace Constructor Foundation — Module
 *
 * Registers workspace controller and service.
 * No external module dependencies — standalone foundation.
 *
 * Architecture authority: docs/architecture/global-workspace-constructor-phase3.md
 */

import { Module } from "@nestjs/common";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceService } from "./workspace.service";

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
