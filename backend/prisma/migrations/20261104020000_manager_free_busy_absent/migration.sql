ALTER TABLE "sales"."SalesManagerProfile" ALTER COLUMN "availability" SET DEFAULT 'FREE';
UPDATE "sales"."SalesManagerProfile" SET "availability"='FREE' WHERE "availability"='AVAILABLE';
UPDATE "sales"."SalesManagerProfile" SET "availability"='ABSENT' WHERE "availability" IN ('TEMP_UNAVAILABLE','INACTIVE');
