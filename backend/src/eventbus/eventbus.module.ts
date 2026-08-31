import { Global, Module } from "@nestjs/common";
import { EventBusService } from "./eventbus.service";
import { OutboxWorkerService } from "./outbox-worker.service";
import { IdsService } from "../shared/ids.service";
import { ReferenceNumberService } from "../shared/reference-number.service";

@Global()
@Module({
  providers: [EventBusService, OutboxWorkerService, IdsService, ReferenceNumberService],
  exports: [EventBusService, IdsService, ReferenceNumberService],
})
export class EventBusModule {}
