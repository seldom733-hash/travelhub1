-- Platform dictionary of service types used by the request workspace.
CREATE TABLE "catalog"."ServiceType" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "names" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceType_code_key" ON "catalog"."ServiceType"("code");

INSERT INTO "catalog"."ServiceType" ("id", "code", "names", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid(), 'TOUR', '{"ru":"Тур","en":"Tour","az":"Tur"}', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'HOTEL', '{"ru":"Отель","en":"Hotel","az":"Otel"}', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FLIGHT', '{"ru":"Авиабилет","en":"Flight ticket","az":"Aviabilet"}', 30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CRUISE', '{"ru":"Круиз","en":"Cruise","az":"Kruiz"}', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'TRANSFER', '{"ru":"Трансфер","en":"Transfer","az":"Transfer"}', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'INSURANCE', '{"ru":"Страховка","en":"Insurance","az":"Sığorta"}', 60, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FLIGHT_BOOKING', '{"ru":"Бронь авиабилетов","en":"Flight booking","az":"Aviabilet bronu"}', 70, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'VISA', '{"ru":"Виза","en":"Visa","az":"Viza"}', 80, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
