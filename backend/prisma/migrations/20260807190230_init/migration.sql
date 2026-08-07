-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "booking";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "crm";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "events";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "order";

-- CreateEnum
CREATE TYPE "events"."OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "catalog"."ProductStatus" AS ENUM ('DRAFT', 'COMPLETE', 'REVIEWED', 'PUBLISHED', 'CHANGED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "catalog"."ProductType" AS ENUM ('TOUR', 'HOTEL', 'SANATORIUM', 'FLIGHT', 'TRAIN', 'EXCURSION', 'GUIDE', 'TRANSFER', 'PHOTOGRAPHER');

-- CreateEnum
CREATE TYPE "crm"."CustomerType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "crm"."EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "order"."OrderStatus" AS ENUM ('NEW', 'IN_PROCESSING', 'WAITING_FOR_DATA', 'READY_FOR_BOOKING', 'SENT_TO_BOOKING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'READY_TO_CLOSE', 'CLOSED', 'CANCELLED', 'PROBLEM', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "order"."OrderPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "order"."FulfillmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "order"."TravelerDataCompleteness" AS ENUM ('INCOMPLETE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "booking"."BookingStatus" AS ENUM ('NEW', 'PREPARING_REQUEST', 'SENT_TO_SUPPLIER', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'NEEDS_CLARIFICATION', 'SUPPLIER_REJECTED', 'CHANGE_REQUESTED', 'CANCELLATION_REQUESTED', 'CANCELLED', 'PROBLEM');

-- CreateEnum
CREATE TYPE "booking"."ReservationStatus" AS ENUM ('HELD', 'CONFIRMED', 'RELEASED');

-- CreateTable
CREATE TABLE "events"."OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "status" "events"."OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events"."InboxEvent" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "catalog"."ProductType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "catalog"."ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."Tariff" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."Availability" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tariffId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "slotsTotal" INTEGER NOT NULL DEFAULT 0,
    "slotsBooked" INTEGER NOT NULL DEFAULT 0,
    "slotsReserved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."ProductHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "crm"."CustomerType" NOT NULL DEFAULT 'PERSON',
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "crm"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."Contact" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "status" "crm"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."Partner" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "status" "crm"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "status" "crm"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."CustomerHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order"."Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "order"."OrderStatus" NOT NULL DEFAULT 'NEW',
    "paymentStatus" "order"."OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "serviceDate" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order"."OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(12,2) NOT NULL,
    "serviceDate" TIMESTAMP(3),

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order"."OrderTraveler" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "citizenship" TEXT,
    "gender" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "dataCompleteness" "order"."TravelerDataCompleteness" NOT NULL DEFAULT 'INCOMPLETE',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrderTraveler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order"."Fulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "order"."FulfillmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,

    CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order"."OrderHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking"."Booking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "booking"."BookingStatus" NOT NULL DEFAULT 'NEW',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "serviceDate" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking"."Reservation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "booking"."ReservationStatus" NOT NULL DEFAULT 'HELD',
    "notes" TEXT,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking"."SupplierConfirmation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "confirmationNumber" TEXT,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking"."Passenger" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "citizenship" TEXT,
    "gender" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking"."BookingHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "fields" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "events"."OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "events"."OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxEvent_consumerId_eventId_key" ON "events"."InboxEvent"("consumerId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "catalog"."Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "catalog"."Product"("slug");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "catalog"."Product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "catalog"."Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_code_key" ON "catalog"."Tariff"("code");

-- CreateIndex
CREATE INDEX "Tariff_productId_idx" ON "catalog"."Tariff"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_productId_tariffId_date_key" ON "catalog"."Availability"("productId", "tariffId", "date");

-- CreateIndex
CREATE INDEX "ProductHistory_productId_idx" ON "catalog"."ProductHistory"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "crm"."Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "crm"."Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "crm"."Customer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_code_key" ON "crm"."Contact"("code");

-- CreateIndex
CREATE INDEX "Contact_customerId_idx" ON "crm"."Contact"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "crm"."Company"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_code_key" ON "crm"."Partner"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "crm"."Supplier"("code");

-- CreateIndex
CREATE INDEX "CustomerHistory_customerId_idx" ON "crm"."CustomerHistory"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "order"."Order"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "order"."Order"("number");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "order"."Order"("status");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "order"."Order"("customerId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "order"."OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderTraveler_orderId_idx" ON "order"."OrderTraveler"("orderId");

-- CreateIndex
CREATE INDEX "Fulfillment_orderId_idx" ON "order"."Fulfillment"("orderId");

-- CreateIndex
CREATE INDEX "OrderHistory_orderId_idx" ON "order"."OrderHistory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_code_key" ON "booking"."Booking"("code");

-- CreateIndex
CREATE INDEX "Booking_orderId_idx" ON "booking"."Booking"("orderId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "booking"."Booking"("status");

-- CreateIndex
CREATE INDEX "Reservation_bookingId_idx" ON "booking"."Reservation"("bookingId");

-- CreateIndex
CREATE INDEX "SupplierConfirmation_bookingId_idx" ON "booking"."SupplierConfirmation"("bookingId");

-- CreateIndex
CREATE INDEX "Passenger_bookingId_idx" ON "booking"."Passenger"("bookingId");

-- CreateIndex
CREATE INDEX "BookingHistory_bookingId_idx" ON "booking"."BookingHistory"("bookingId");

-- AddForeignKey
ALTER TABLE "catalog"."Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "catalog"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."Tariff" ADD CONSTRAINT "Tariff_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."Availability" ADD CONSTRAINT "Availability_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."ProductHistory" ADD CONSTRAINT "ProductHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."Partner" ADD CONSTRAINT "Partner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."CustomerHistory" ADD CONSTRAINT "CustomerHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order"."OrderTraveler" ADD CONSTRAINT "OrderTraveler_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order"."Fulfillment" ADD CONSTRAINT "Fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order"."OrderHistory" ADD CONSTRAINT "OrderHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking"."Reservation" ADD CONSTRAINT "Reservation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking"."SupplierConfirmation" ADD CONSTRAINT "SupplierConfirmation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking"."Passenger" ADD CONSTRAINT "Passenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking"."BookingHistory" ADD CONSTRAINT "BookingHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
