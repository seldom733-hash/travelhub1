import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { parseCorsOrigins } from "./shared/cors";
import { AppModule } from "./app.module";
import { AppExceptionFilter } from "./shared/exception.filter";
import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "./shared/validation-pipe";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // REST, версионирование: /api/v1/{domain}/...
  app.setGlobalPrefix("api/v1");
  // Step 2.17: HttpOnly session cookie (travelhub.auth) — читается guard-ом.
  app.use(cookieParser());
  // Step 2.17: CORS allowlist вместо origin:true (cookie-сессии: credentials
  // только для явно разрешённых origins; НЕ wildcard).
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  app.enableCors({ origin: corsOrigins, credentials: true });
  // Step 1.5: qs (extended) query parser — вложенные category-specific фильтры
  // public catalog: ?f[days]=7&f[language]=en → { f: { days: '7', language: 'en' } }.
  (app.getHttpAdapter().getInstance() as { set: (k: string, v: string) => void }).set("query parser", "extended");
  // Единый источник истины (shared/validation-pipe): e2e использует те же опции.
  // БЕЗ enableImplicitConversion — implicit-конверсия ломает DTO-поля unknown[]
  // (array-of-objects), все числовые/булевы конверсии уже явные через @Type.
  app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new AppExceptionFilter());

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`TravelHub Phase 1 API ready: http://localhost:${port}/api/v1`);
}

void bootstrap();
