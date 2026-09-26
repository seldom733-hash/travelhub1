-- Hotel reference directory (Справочники → Отели): HotelCategory, RoomType,
-- PlacementType, MealType in catalog.* (master classifications, no FK to Product).
-- NOTE: pre-existing dev-DB drift (catalog.PartnerActiveCategory) intentionally
-- left untouched.

-- CreateTable
CREATE TABLE "catalog"."HotelCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "HotelCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."RoomType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."PlacementType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "PlacementType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."MealType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "catalog"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "MealType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelCategory_code_key" ON "catalog"."HotelCategory"("code");

-- CreateIndex
CREATE INDEX "HotelCategory_status_idx" ON "catalog"."HotelCategory"("status");

-- CreateIndex
CREATE INDEX "HotelCategory_sortOrder_idx" ON "catalog"."HotelCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_code_key" ON "catalog"."RoomType"("code");

-- CreateIndex
CREATE INDEX "RoomType_status_idx" ON "catalog"."RoomType"("status");

-- CreateIndex
CREATE INDEX "RoomType_sortOrder_idx" ON "catalog"."RoomType"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementType_code_key" ON "catalog"."PlacementType"("code");

-- CreateIndex
CREATE INDEX "PlacementType_status_idx" ON "catalog"."PlacementType"("status");

-- CreateIndex
CREATE INDEX "PlacementType_sortOrder_idx" ON "catalog"."PlacementType"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MealType_code_key" ON "catalog"."MealType"("code");

-- CreateIndex
CREATE INDEX "MealType_status_idx" ON "catalog"."MealType"("status");

-- CreateIndex
CREATE INDEX "MealType_sortOrder_idx" ON "catalog"."MealType"("sortOrder");
