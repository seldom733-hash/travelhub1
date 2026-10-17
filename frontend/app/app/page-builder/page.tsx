"use client";

import { CanvasPageSkeleton } from "@/components/internal/WorkspaceSkeletons";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import { useLocale, t } from "@/lib/i18n";
import ConstructorCanvas from "@/components/constructor/ConstructorCanvas";

function ConstructorPageContent() {
  const locale = useLocale();

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={t("constructor.page_title", locale)}
        breadcrumbs={[t("nav.group.settings", locale), t("constructor.page_title", locale)]}
      />
      <div className="flex-1 p-6">
        <ConstructorCanvas slug="marketplace-home" />
      </div>
    </div>
  );
}

export default function ConstructorPage() {
  return (
    <Suspense
      fallback={<CanvasPageSkeleton />}
    >
      <ConstructorPageContent />
    </Suspense>
  );
}
