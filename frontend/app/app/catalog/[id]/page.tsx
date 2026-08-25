"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useLocale, t } from "@/lib/i18n";

interface ProductDetail {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  slug: string;
  partnerId: string | null;
  categoryId: string | null;
  description: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const id = params.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detail = await api.get<ProductDetail>(`/products/${id}`);
      setProduct(detail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadProduct(); }, [loadProduct]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-slate-400">{t("crm.loading", locale)}</div></div>;
  }

  if (error || !product) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-red-500">{error || t("crm.not_found", locale)}</div>
        <Link href="/app/catalog" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">{t("crm.back_to_list", locale)}</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={product.title}
        breadcrumbs={["TravelHub", t("catalog.title", locale), product.code]}
        actions={<Link href="/app/catalog" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">← {t("crm.back_to_list", locale)}</Link>}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-mono text-xs text-blue-600">{product.code}</div>
            <div className="text-lg font-bold text-slate-900">{product.title}</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={product.status} />
              <span className="text-xs text-slate-400">{product.type}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("catalog.col.type", locale)}</div><div className="font-medium text-slate-700">{product.type}</div></div>
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("catalog.col.slug", locale)}</div><div className="font-medium text-slate-700">/{product.slug}</div></div>
          </div>

          {product.partnerId && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
              <div className="text-slate-400">{t("catalog.col.partner", locale)}</div>
              <Link href={`/app/crm/partners/${product.partnerId}`} className="font-medium text-blue-600 hover:underline">{product.partnerId}</Link>
            </div>
          )}

          {product.description && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs">
              <div className="text-slate-400">{t("catalog.col.description", locale)}</div>
              <div className="mt-1 font-medium text-slate-700 whitespace-pre-wrap">{product.description}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 px-4 py-3"><div className="text-slate-400">{t("crm.col.created", locale)}</div><div className="font-medium text-slate-700">{new Date(product.createdAt).toLocaleDateString()}</div></div>
            {product.publishedAt && (
              <div className="rounded-lg bg-green-50 px-4 py-3"><div className="text-slate-400">{t("catalog.col.published", locale)}</div><div className="font-medium text-green-700">{new Date(product.publishedAt).toLocaleDateString()}</div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
