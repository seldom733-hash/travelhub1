import { Module } from "@nestjs/common";
import { RequestController } from "./request.controller";
import { RequestService } from "./request.service";
import { OrderModule } from "./order.module";
import { AssignmentModule } from "../sales/assignment.module";
import { ExportService } from "../shared/export/export.service";

@Module({
  imports: [OrderModule, AssignmentModule],
  controllers: [RequestController],
  providers: [RequestService, ExportService],
  exports: [RequestService],
})
export class RequestModule {}
