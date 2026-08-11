-- CreateEnum
CREATE TYPE "catalog"."ServiceUnitStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "catalog"."ServiceUnit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "categorySchemaId" TEXT,
    "attributes" JSONB,
    "source" TEXT,
    "externalKey" TEXT,
    "partnerId" TEXT,
    "status" "catalog"."ServiceUnitStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ServiceUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."ServiceUnitHistory" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceUnitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceUnit_code_key" ON "catalog"."ServiceUnit"("code");

-- CreateIndex
CREATE INDEX "ServiceUnit_productId_idx" ON "catalog"."ServiceUnit"("productId");

-- CreateIndex
CREATE INDEX "ServiceUnit_status_idx" ON "catalog"."ServiceUnit"("status");

-- CreateIndex
CREATE INDEX "ServiceUnit_partnerId_idx" ON "catalog"."ServiceUnit"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceUnit_partnerId_productId_source_externalKey_key" ON "catalog"."ServiceUnit"("partnerId", "productId", "source", "externalKey");

-- CreateIndex
CREATE INDEX "ServiceUnitHistory_unitId_idx" ON "catalog"."ServiceUnitHistory"("unitId");

-- AddForeignKey
ALTER TABLE "catalog"."ServiceUnit" ADD CONSTRAINT "ServiceUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."ServiceUnitHistory" ADD CONSTRAINT "ServiceUnitHistory_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "catalog"."ServiceUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
