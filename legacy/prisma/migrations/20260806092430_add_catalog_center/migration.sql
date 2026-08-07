/*
  Warnings:

  - Added the required column `code` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ServiceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceHistory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "shortDesc" TEXT,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "discountPrice" REAL,
    "city" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT NOT NULL DEFAULT '[]',
    "duration" TEXT,
    "maxGuests" INTEGER,
    "languages" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "hotDiscount" INTEGER DEFAULT 0,
    "providerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "managerId" TEXT,
    "publishedAt" DATETIME,
    "category" TEXT,
    "tags" TEXT,
    "salesStart" DATETIME,
    "salesEnd" DATETIME,
    "serviceStart" DATETIME,
    "serviceEnd" DATETIME,
    "quotaTotal" INTEGER DEFAULT 0,
    "quotaBooked" INTEGER DEFAULT 0,
    "quotaReserved" INTEGER DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "channels" TEXT,
    "relatedIds" TEXT,
    CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Service_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("city", "country", "countryCode", "createdAt", "currency", "description", "discountPrice", "duration", "hotDiscount", "id", "images", "isActive", "isFeatured", "isHot", "languages", "latitude", "longitude", "maxGuests", "price", "providerId", "rating", "reviewCount", "shortDesc", "slug", "title", "type", "updatedAt") SELECT "city", "country", "countryCode", "createdAt", "currency", "description", "discountPrice", "duration", "hotDiscount", "id", "images", "isActive", "isFeatured", "isHot", "languages", "latitude", "longitude", "maxGuests", "price", "providerId", "rating", "reviewCount", "shortDesc", "slug", "title", "type", "updatedAt" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");
CREATE INDEX "Service_type_isActive_idx" ON "Service"("type", "isActive");
CREATE INDEX "Service_countryCode_idx" ON "Service"("countryCode");
CREATE INDEX "Service_status_idx" ON "Service"("status");
CREATE INDEX "Service_managerId_idx" ON "Service"("managerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ServiceHistory_serviceId_idx" ON "ServiceHistory"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceHistory_createdAt_idx" ON "ServiceHistory"("createdAt");
