ALTER TABLE "documents"."Document" ADD COLUMN "sourceId" TEXT;
CREATE UNIQUE INDEX "Document_type_sourceId_key" ON "documents"."Document"("type", "sourceId");
