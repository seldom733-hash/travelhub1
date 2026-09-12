import { Module } from "@nestjs/common";
import { ConstructorController } from "./constructor.controller";
import { ConstructorService } from "./constructor.service";
import { S3ObjectStorageService } from "../catalog/media/storage/s3-storage.service";
import { MediaProcessor } from "../catalog/media/media-processor.service";

@Module({
  controllers: [ConstructorController],
  providers: [
    ConstructorService,
    { provide: "ObjectStorageService", useClass: S3ObjectStorageService },
    S3ObjectStorageService,
    MediaProcessor,
  ],
  exports: [ConstructorService],
})
export class ConstructorModule {}
