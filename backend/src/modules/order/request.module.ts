import { Module } from "@nestjs/common";
import { RequestController } from "./request.controller";
import { RequestService } from "./request.service";
import { ExportService } from "../shared/export/export.service";

@Module({
  controllers: [RequestController],
  providers: [RequestService, ExportService],
  exports: [RequestService],
})
export class RequestModule {}
