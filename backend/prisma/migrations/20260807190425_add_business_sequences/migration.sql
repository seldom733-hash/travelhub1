-- CreateTable
CREATE TABLE "events"."BusinessSequence" (
    "prefix" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BusinessSequence_pkey" PRIMARY KEY ("prefix")
);
