-- Step 1.4 review fix 1: change proposal (draft/version N+1) для PUBLISHED Product.
-- Content N+1 хранится ОТДЕЛЬНО от live approved N (без второго Product / нового PRD-*).
-- CreateTable
CREATE TABLE "catalog"."ProductDraft" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "categorySchemaId" TEXT,
    "attributes" JSONB,
    "tariffs" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductDraft_productId_key" ON "catalog"."ProductDraft"("productId");

-- AddForeignKey
ALTER TABLE "catalog"."ProductDraft" ADD CONSTRAINT "ProductDraft_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 1.4 review fix 2: ЕДИНЫЙ DB-level инвариант активной moderation submission.
-- Два раздельных partial index (по status SUBMITTED и по status IN_REVIEW) позволяли
-- держать для одного Product одну SUBMITTED И одну IN_REVIEW одновременно. Заменяем их
-- одним уникальным индексом на managed-флаг isActiveSubmission (SUBMITTED/IN_REVIEW),
-- который атомарно выставляется в тех же переходах, что и status (шаблон ProductMedia.isPrimary).
-- AlterTable
-- draftVersion: ревизия ProductDraft, проверяемая change-proposal submission (null — новый Product).
ALTER TABLE "catalog"."ModerationSubmission" ADD COLUMN "draftVersion" INTEGER;
ALTER TABLE "catalog"."ModerationSubmission" ADD COLUMN "isActiveSubmission" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: существующие активные submission получают флаг.
UPDATE "catalog"."ModerationSubmission" SET "isActiveSubmission" = true
WHERE "status" IN ('SUBMITTED', 'IN_REVIEW');

-- DropIndex (два старых раздельных инварианта)
DROP INDEX "catalog"."ModerationSubmission_one_submitted_per_product";
DROP INDEX "catalog"."ModerationSubmission_one_inreview_per_product";

-- CreateIndex (единый инвариант: не более одной активной submission на Product)
CREATE UNIQUE INDEX "ModerationSubmission_one_active_per_product" ON "catalog"."ModerationSubmission"("productId") WHERE ("isActiveSubmission" = true);

-- CreateIndex (очередь фильтруется по активным)
CREATE INDEX "ModerationSubmission_isActiveSubmission_idx" ON "catalog"."ModerationSubmission"("isActiveSubmission");
