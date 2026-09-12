-- AlterTable: Add page-level configuration JSON fields to ConstructorPage
ALTER TABLE "constructor"."ConstructorPage" ADD COLUMN "headerConfig" JSONB,
ADD COLUMN "heroConfig" JSONB,
ADD COLUMN "searchConfig" JSONB,
ADD COLUMN "footerConfig" JSONB,
ADD COLUMN "designConfig" JSONB;
