import { Global, Module } from "@nestjs/common";
import { EventBusService } from "./eventbus.service";
import { IdsService } from "../shared/ids.service";

@Global()
@Module({
  providers: [EventBusService, IdsService],
  exports: [EventBusService, IdsService],
})
export class EventBusModule {}
