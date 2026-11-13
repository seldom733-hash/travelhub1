CREATE TABLE "catalog"."HotelPhotoRef" (
  "id" TEXT NOT NULL,
  "supplierCode" TEXT NOT NULL,
  "externalKey" TEXT NOT NULL,
  "photoFile" TEXT NOT NULL,
  "photoUpdatedAt" TIMESTAMP(3),
  "canonicalName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelPhotoRef_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelPhotoRef_supplierCode_externalKey_key" ON "catalog"."HotelPhotoRef"("supplierCode", "externalKey");
CREATE INDEX "HotelPhotoRef_supplierCode_idx" ON "catalog"."HotelPhotoRef"("supplierCode");
