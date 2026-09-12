"use client";

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
        breadcrumbs={[t("nav.settings", locale), t("constructor.page_title", locale)]}
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
      fallback={
        <div className="flex min-w-0 flex-1 flex-col p-6">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 h-64 animate-pulse rounded-lg bg-slate-100" />
        </div>
      }
    >
      <ConstructorPageContent />
    </Suspense>
  );
}
