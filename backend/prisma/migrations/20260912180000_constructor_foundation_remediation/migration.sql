-- Constructor foundation remediation (pre-existing gap, discovered during M1 gate).
--
-- Root cause: schema "constructor" and tables ConstructorPage/ConstructorPageSection/
-- ConstructorPageVersion/ConstructorPageAuditLog were created out-of-band
-- (db push/manual) and are MISSING from migration history. Consequences:
--   * shadow-DB replay (prisma migrate dev) fails at 20260913000000 with
--     "schema constructor does not exist" (P3018);
--   * clean-DB prisma migrate deploy (CI) fails on the same ALTER TABLE.
--
-- Pattern precedent: 20260831220000_security_schema_drift_remediation.
-- Fully idempotent (IF NOT EXISTS / duplicate_object guards): safe on a dev DB
-- where the tables already exist, and on a clean DB.
--
-- Column set: PRE-20260913 for ConstructorPage — the 5 config columns
-- (headerConfig/heroConfig/searchConfig/footerConfig/designConfig) are added by
-- 20260913000000_constructor_page_level_config and defaultConfigs by
-- 20260914000000_constructor_default_configs. They MUST NOT exist before those
-- migrations run during a clean replay.

-- 1. Schema (idempotent)
CREATE SCHEMA IF NOT EXISTS "constructor";

-- 2. ConstructorPage (base column set, before 20260913/20260914 ALTERs)
CREATE TABLE IF NOT EXISTS "constructor"."ConstructorPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER,
    "draftVersion" INTEGER,
    "themeId" TEXT,
    "templateId" TEXT,
    "seo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ConstructorPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConstructorPage_slug_key" ON "constructor"."ConstructorPage"("slug");
CREATE INDEX IF NOT EXISTS "ConstructorPage_slug_idx" ON "constructor"."ConstructorPage"("slug");
CREATE INDEX IF NOT EXISTS "ConstructorPage_context_idx" ON "constructor"."ConstructorPage"("context");
CREATE INDEX IF NOT EXISTS "ConstructorPage_tenantId_idx" ON "constructor"."ConstructorPage"("tenantId");

-- 3. ConstructorPageSection
CREATE TABLE IF NOT EXISTS "constructor"."ConstructorPageSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "blockType" TEXT NOT NULL,
    "blockInstanceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "style" JSONB NOT NULL DEFAULT '{}',
    "responsive" JSONB NOT NULL DEFAULT '{}',
    "dataSource" JSONB NOT NULL DEFAULT '{}',
    "visibility" JSONB,
    "localeContent" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructorPageSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConstructorPageSection_pageId_version_blockInstanceId_key" ON "constructor"."ConstructorPageSection"("pageId", "version", "blockInstanceId");
CREATE INDEX IF NOT EXISTS "ConstructorPageSection_pageId_idx" ON "constructor"."ConstructorPageSection"("pageId");
CREATE INDEX IF NOT EXISTS "ConstructorPageSection_version_idx" ON "constructor"."ConstructorPageSection"("version");

DO $$ BEGIN
    ALTER TABLE "constructor"."ConstructorPageSection" ADD CONSTRAINT "ConstructorPageSection_pageId_fkey"
        FOREIGN KEY ("pageId") REFERENCES "constructor"."ConstructorPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. ConstructorPageVersion
CREATE TABLE IF NOT EXISTS "constructor"."ConstructorPageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ConstructorPageVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConstructorPageVersion_pageId_version_key" ON "constructor"."ConstructorPageVersion"("pageId", "version");
CREATE INDEX IF NOT EXISTS "ConstructorPageVersion_pageId_idx" ON "constructor"."ConstructorPageVersion"("pageId");

DO $$ BEGIN
    ALTER TABLE "constructor"."ConstructorPageVersion" ADD CONSTRAINT "ConstructorPageVersion_pageId_fkey"
        FOREIGN KEY ("pageId") REFERENCES "constructor"."ConstructorPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. ConstructorPageAuditLog
CREATE TABLE IF NOT EXISTS "constructor"."ConstructorPageAuditLog" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstructorPageAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConstructorPageAuditLog_pageId_idx" ON "constructor"."ConstructorPageAuditLog"("pageId");
CREATE INDEX IF NOT EXISTS "ConstructorPageAuditLog_createdAt_idx" ON "constructor"."ConstructorPageAuditLog"("createdAt");

DO $$ BEGIN
    ALTER TABLE "constructor"."ConstructorPageAuditLog" ADD CONSTRAINT "ConstructorPageAuditLog_pageId_fkey"
        FOREIGN KEY ("pageId") REFERENCES "constructor"."ConstructorPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
