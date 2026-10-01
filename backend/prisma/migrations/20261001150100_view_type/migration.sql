-- ViewType (вид с окна) — по образцу RoomType (hotel reference directory).
-- Базовый список — seed; новые значения от партнёров: PENDING → модерация.

-- CreateTable
CREATE TABLE "catalog"."ViewType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ViewType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ViewType_code_key" ON "catalog"."ViewType"("code");

-- CreateIndex
CREATE INDEX "ViewType_status_idx" ON "catalog"."ViewType"("status");

-- CreateIndex
CREATE INDEX "ViewType_sortOrder_idx" ON "catalog"."ViewType"("sortOrder");
