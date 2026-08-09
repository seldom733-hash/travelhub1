"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { partnerApi, type PartnerMediaItem, type PartnerMediaRequirements } from "@/lib/partner-api";

/**
 * PHASE 1 STEP 1.8 §11/§12 — Product Media UI (Step 1.2 backend):
 * multi-upload, thumbnails, primary, reorder, caption/alt, replace, delete,
 * requirement counters. PUBLISHED (live) media нельзя мутировать напрямую —
 * правки публикуются через модерацию (N+1). DRAFT media показывается через
 * authenticated signed preview (не public).
 */
export default function MediaManager({ productId }: { productId: string }) {
  const locale = useLocale();
  const [media, setMedia] = useState<PartnerMediaItem[] | null>(null);
  const [requirements, setRequirements] = useState<PartnerMediaRequirements | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const reload = async () => {
    const [list, req] = await Promise.all([partnerApi.listMedia(productId), partnerApi.schemaRequirementsForProduct(productId)]);
    setMedia(list);
    setRequirements(req);
  };

  // Подписанные preview-URL для DRAFT media (authenticated; не public).
  useEffect(() => {
    if (!media) return;
    let alive = true;
    for (const m of media) {
      if (m.status !== "PUBLISHED" && !signed[m.id]) {
        partnerApi
          .previewUrl(productId, m.id, "thumb")
          .then((s) => {
            if (alive) setSigned((prev) => ({ ...prev, [m.id]: s.url }));
          })
          .catch(() => undefined);
      }
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, productId]);

  useEffect(() => {
    let alive = true;
    reload()
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      await partnerApi.uploadMedia(productId, files);
      await reload();
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onReplace = async (m: PartnerMediaItem, file: File | undefined) => {
    if (!file) return;
    await run(() => partnerApi.replaceMedia(productId, m.id, file));
  };

  const thumbUrl = (m: PartnerMediaItem): string | null =>
    m.status === "PUBLISHED" ? `/api/v1/public/media/${m.id}/thumb` : (signed[m.id] ?? null);

  const liveLocked = (m: PartnerMediaItem): boolean => m.status === "PUBLISHED";

  if (!media) {
    return <div className="py-10 text-center text-sm text-slate-400">{pt("partner.state.loading", locale)}</div>;
  }

  return (
    <div>
      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {requirements && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{pt("partner.media.requirements", locale)}</h3>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {requirements.minImages !== undefined && (
              <span className={`rounded-full px-2 py-0.5 ${media.length < requirements.minImages ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {pt("partner.media.min_images", locale)}: {media.length}/{requirements.minImages}
              </span>
            )}
            {requirements.maxImages !== undefined && (
              <span className={`rounded-full px-2 py-0.5 ${media.length > requirements.maxImages ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                {pt("partner.media.max_images", locale)}: {media.length}/{requirements.maxImages}
              </span>
            )}
            {requirements.primaryImageRequired && (
              <span className={`rounded-full px-2 py-0.5 ${media.some((m) => m.isPrimary) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {pt("partner.media.primary_required", locale)}
              </span>
            )}
            {requirements.allowedMediaTypes && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {pt("partner.media.allowed_types", locale)}: {requirements.allowedMediaTypes.join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      {media.some((m) => m.status === "PUBLISHED") && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {pt("partner.media.live_locked", locale)}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          id="media-upload"
          onChange={(e) => void onUpload(e.target.files)}
        />
        <label
          htmlFor="media-upload"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {uploading ? pt("partner.media.uploading", locale) : pt("partner.media.upload", locale)}
        </label>
      </div>

      {media.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          {pt("partner.media.empty", locale)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => {
            const url = thumbUrl(m);
            const locked = liveLocked(m);
            return (
              <div key={m.id} className={`rounded-2xl border bg-white p-3 shadow-sm ${m.isPrimary ? "border-emerald-300" : "border-slate-200"}`}>
                <div className="relative mb-2 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={m.altText ?? m.originalFileName} className="size-full object-cover" />
                  ) : (
                    <span className="text-slate-300">…</span>
                  )}
                  {m.isPrimary && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-semibold uppercase text-white">
                      {pt("partner.media.primary", locale)}
                    </span>
                  )}
                  <span
                    className={`absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                      m.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {pt(m.status === "PUBLISHED" ? "partner.media.published" : "partner.media.draft", locale)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <MetaInput
                    id={`caption-${m.id}`}
                    label={pt("partner.media.caption", locale)}
                    value={m.caption ?? ""}
                    disabled={locked || busy}
                    onSave={(v) => run(() => partnerApi.updateMedia(productId, m.id, { caption: v }))}
                  />
                  <MetaInput
                    id={`alt-${m.id}`}
                    label={pt("partner.media.alt", locale)}
                    value={m.altText ?? ""}
                    disabled={locked || busy}
                    onSave={(v) => run(() => partnerApi.updateMedia(productId, m.id, { altText: v }))}
                  />

                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {!locked && (
                      <>
                        {!m.isPrimary && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => partnerApi.setPrimary(productId, m.id))}
                            className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            {pt("partner.media.set_primary", locale)}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy || m.sortOrder === 0}
                          onClick={() => run(() => partnerApi.reorderMedia(productId, move(media, m.id, -1).map((x) => x.id)))}
                          className="rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100"
                          aria-label={pt("partner.media.up", locale)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={busy || m.sortOrder === media.length - 1}
                          onClick={() => run(() => partnerApi.reorderMedia(productId, move(media, m.id, 1).map((x) => x.id)))}
                          className="rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100"
                          aria-label={pt("partner.media.down", locale)}
                        >
                          ↓
                        </button>
                        <label className="cursor-pointer rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100">
                          {pt("partner.media.replace", locale)}
                          <input
                            ref={(el) => {
                              replaceRefs.current[m.id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void onReplace(m, f);
                              const el = replaceRefs.current[m.id];
                              if (el) el.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(pt("partner.media.delete_confirm", locale))) {
                              void run(() => partnerApi.deleteMedia(productId, m.id));
                            }
                          }}
                          className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-100"
                        >
                          {pt("partner.media.delete", locale)}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function move(list: PartnerMediaItem[], id: string, delta: number): PartnerMediaItem[] {
  const idx = list.findIndex((x) => x.id === id);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(idx, 1);
  next.splice(target, 0, item);
  return next;
}

function MetaInput({
  id,
  label,
  value,
  disabled,
  onSave,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
        }}
        placeholder={label}
        disabled={disabled}
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-emerald-400 disabled:bg-slate-50"
      />
    </div>
  );
}
