"use client";

import { useState } from "react";
import { useLocale, t } from "@/lib/i18n";
import { constructorApi, type ConstructorTabKey } from "@/lib/constructor-api";
import { ArrowCounterClockwise, BookmarkSimple } from "@phosphor-icons/react";

/**
 * Shared Constructor tab controls:
 *  - "Восстановить по умолчанию" — writes the tab's effective default config
 *    into the working config (page record). Publish stays a separate action.
 *  - "Сделать текущим состоянием по умолчанию" — persists the tab's current
 *    editor state as the tab default. Does not touch Draft/Published.
 *
 * Both operations are isolated from the published marketplace: the public site
 * only changes on an explicit Publish.
 */
export default function DefaultConfigActions({
  slug,
  tab,
  getSnapshot,
  onRestored,
  onError,
}: {
  slug: string;
  tab: ConstructorTabKey;
  /** Returns the tab's current editor state (persisted as the new default). */
  getSnapshot: () => Record<string, unknown>;
  /** Called after a successful restore so the parent can reload page config. */
  onRestored: () => void;
  onError: (msg: string | null) => void;
}) {
  const locale = useLocale();
  const [busy, setBusy] = useState<null | "restore" | "makeDefault">(null);

  async function handleRestore() {
    if (!window.confirm(t("constructor.default_restore_confirm", locale))) return;
    setBusy("restore");
    onError(null);
    try {
      await constructorApi.restoreDefaultConfig(slug, tab);
      onRestored();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleMakeDefault() {
    setBusy("makeDefault");
    onError(null);
    try {
      await constructorApi.setDefaultConfig(slug, tab, getSnapshot());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to set default");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleRestore}
        disabled={busy !== null}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowCounterClockwise className="h-4 w-4" />
        {busy === "restore" ? t("constructor.saving", locale) : t("constructor.restore_default", locale)}
      </button>
      <button
        type="button"
        onClick={handleMakeDefault}
        disabled={busy !== null}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BookmarkSimple className="h-4 w-4" />
        {busy === "makeDefault" ? t("constructor.saving", locale) : t("constructor.make_default", locale)}
      </button>
    </div>
  );
}
