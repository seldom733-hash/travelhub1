import { Global, Module } from "@nestjs/common";
import { EventBusService } from "./eventbus.service";
import { OutboxWorkerService } from "./outbox-worker.service";
import { IdsService } from "../shared/ids.service";

@Global()
@Module({
  providers: [EventBusService, OutboxWorkerService, IdsService],
  exports: [EventBusService, IdsService],
})
export class EventBusModule {}
