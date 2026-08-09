"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import MediaManager from "@/components/partner/MediaManager";

/** PHASE 1 STEP 1.8 §11 — Product Media management page. */
export default function ProductMediaPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <Link href={`/partner/products/${params.id}`} className="text-sm text-slate-500 hover:text-emerald-700">
          {pt("partner.product.back", locale)}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{pt("partner.media.title", locale)}</h1>
      </div>
      <MediaManager productId={params.id} />
    </div>
  );
}
