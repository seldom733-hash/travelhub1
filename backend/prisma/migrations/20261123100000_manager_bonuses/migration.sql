-- Manager bonuses: manual percent per manager/period, calculated from closed deal margin.
CREATE TABLE "finance"."ManagerBonus" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "managerName" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "closedDeals" INTEGER NOT NULL DEFAULT 0,
    "closedServices" INTEGER NOT NULL DEFAULT 0,
    "marginBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerBonus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagerBonus_managerId_periodStart_periodEnd_key"
    ON "finance"."ManagerBonus"("managerId", "periodStart", "periodEnd");

CREATE INDEX "ManagerBonus_periodStart_periodEnd_idx"
    ON "finance"."ManagerBonus"("periodStart", "periodEnd");
