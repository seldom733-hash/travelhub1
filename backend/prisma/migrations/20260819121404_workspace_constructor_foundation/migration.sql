-- CreateTable
CREATE TABLE "security"."UserWorkspaceLayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "layoutVersion" INTEGER NOT NULL DEFAULT 1,
    "widgets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWorkspaceLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWorkspaceLayout_userId_idx" ON "security"."UserWorkspaceLayout"("userId");

-- CreateIndex
CREATE INDEX "UserWorkspaceLayout_pageId_idx" ON "security"."UserWorkspaceLayout"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkspaceLayout_userId_pageId_key" ON "security"."UserWorkspaceLayout"("userId", "pageId");

-- AddForeignKey
ALTER TABLE "security"."UserWorkspaceLayout" ADD CONSTRAINT "UserWorkspaceLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "security"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
