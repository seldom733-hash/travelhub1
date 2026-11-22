-- Bonus calculation basis: by deal closing date or by service completion date.
ALTER TABLE "finance"."ManagerBonus"
    ADD COLUMN "basis" TEXT NOT NULL DEFAULT 'closed_at';

DROP INDEX IF EXISTS "finance"."ManagerBonus_managerId_periodStart_periodEnd_key";

CREATE UNIQUE INDEX "ManagerBonus_managerId_periodStart_periodEnd_basis_key"
    ON "finance"."ManagerBonus"("managerId", "periodStart", "periodEnd", "basis");
