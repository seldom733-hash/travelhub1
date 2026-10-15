-- Единый каталог фотографий отелей (Navitravel).
--
-- Hotel — физическая гостиница: ОДНА запись на отель, общая для всех разделов
-- (каталог «Отели», туры с проживанием, поиск, конструктор) и всех поставщиков.
-- HotelSupplierRef — supplier-native id отеля (hotelKey/hotelInc) → эта запись,
-- поэтому отель из тура и отель из услуги «Отели» с одним ключом дают одну
-- строку и один файл фотографии.
--
-- Миграция аддитивная: создаёт только новый enum и две новые таблицы,
-- существующие объекты не изменяются.

-- CreateEnum
CREATE TYPE "catalog"."HotelPhotoStatus" AS ENUM ('NONE', 'PENDING', 'OK', 'FAILED', 'REVIEW');

-- CreateTable
CREATE TABLE "catalog"."Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "stars" INTEGER,
    "countryCode" TEXT NOT NULL DEFAULT '',
    "countryName" TEXT NOT NULL DEFAULT '',
    "cityName" TEXT NOT NULL DEFAULT '',
    "resortName" TEXT NOT NULL DEFAULT '',
    "photoFile" TEXT,
    "photoStatus" "catalog"."HotelPhotoStatus" NOT NULL DEFAULT 'NONE',
    "photoSource" TEXT,
    "photoSourceUrl" TEXT,
    "photoAttribution" TEXT,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "photoBytes" INTEGER,
    "photoUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."HotelSupplierRef" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT '',
    "cityName" TEXT NOT NULL DEFAULT '',
    "resortName" TEXT NOT NULL DEFAULT '',
    "stars" INTEGER,
    "hotelHref" TEXT,
    "source" TEXT NOT NULL DEFAULT 'product',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelSupplierRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hotel_name_idx" ON "catalog"."Hotel"("name");

-- CreateIndex
CREATE INDEX "Hotel_countryCode_cityName_idx" ON "catalog"."Hotel"("countryCode", "cityName");

-- CreateIndex
CREATE INDEX "Hotel_photoStatus_idx" ON "catalog"."Hotel"("photoStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_normalizedName_countryCode_cityName_key" ON "catalog"."Hotel"("normalizedName", "countryCode", "cityName");

-- CreateIndex
CREATE INDEX "HotelSupplierRef_hotelId_idx" ON "catalog"."HotelSupplierRef"("hotelId");

-- CreateIndex
CREATE INDEX "HotelSupplierRef_supplierCode_idx" ON "catalog"."HotelSupplierRef"("supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "HotelSupplierRef_supplierCode_externalKey_key" ON "catalog"."HotelSupplierRef"("supplierCode", "externalKey");

-- AddForeignKey
ALTER TABLE "catalog"."HotelSupplierRef" ADD CONSTRAINT "HotelSupplierRef_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "catalog"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
