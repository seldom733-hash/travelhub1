import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppExceptionFilter } from "./shared/exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // REST, версионирование: /api/v1/{domain}/...
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`TravelHub Phase 1 API ready: http://localhost:${port}/api/v1`);
}

void bootstrap();
