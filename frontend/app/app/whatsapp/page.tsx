"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLocale, t, ti, LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { useCan } from "@/lib/use-can";
import {
  sendWhatsAppMessage,
  uploadWhatsAppFile,
  whatsappMediaUrl,
  type WhatsAppConversationDetail,
  type WhatsAppConversationRow,
  type WhatsAppCustomerRef,
  type WhatsAppMatchingStatus,
  type WhatsAppTimelineItem,
  type WhatsAppUploadResult,
} from "@/lib/whatsapp";

/**
 * M3 §25 — операционный WhatsApp Inbox: 3 колонки.
 *  слева  — список диалогов (GET /whatsapp/conversations, фильтр §25,
 *           unread §18, mark-read при открытии);
 *  центр  — непрерывная история (GET .../messages, §14: inbound+outbound
 *           одной лентой) + composer через POST /whatsapp/messages;
 *  справа — контекст §13 + клиент/кандидаты + link-customer (§24/§25).
 */

type Filter = "ALL" | "UNMATCHED" | "MATCHED" | "AMBIGUOUS";
const FILTERS: readonly Filter[] = ["ALL", "UNMATCHED", "MATCHED", "AMBIGUOUS"];

function errMessage(err: unknown, locale: Locale): string {
  return err instanceof Error && err.message ? err.message : t("whatsapp.error", locale);
}

function fmtTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function customerName(c: WhatsAppCustomerRef): string {
  return c.name || c.email;
}

function fmtBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** LID-адресация: canonicalPhone ещё не получен — не показываем сырой `@lid`. */
function peerLabel(canonicalPhone: string | null, remoteJid: string, locale: Locale): string {
  if (canonicalPhone) return canonicalPhone;
  if (remoteJid.includes("@lid")) return t("whatsapp.unknown_phone", locale);
  return remoteJid;
}

function badgeClass(status: WhatsAppMatchingStatus): string {
  if (status === "MATCHED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "AMBIGUOUS") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function MatchingBadge({ status, locale }: { status: WhatsAppMatchingStatus; locale: Locale }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass(status)}`}>
      {t(`whatsapp.badge.${status}`, locale)}
    </span>
  );
}

export default function WhatsappInboxPage() {
  const locale = useLocale();
  const canSend = useCan("whatsapp.send");
  const canManage = useCan("whatsapp.manage");

  const [rows, setRows] = useState<WhatsAppConversationRow[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WhatsAppConversationDetail | null>(null);
  const [timeline, setTimeline] = useState<WhatsAppTimelineItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [upload, setUpload] = useState<WhatsAppUploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<WhatsAppCustomerRef[] | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkOk, setLinkOk] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async () => {
    try {
      const qs = filter === "ALL" ? "" : `?matchingStatus=${filter}`;
      const data = await api.get<WhatsAppConversationRow[]>(`/whatsapp/conversations${qs}`);
      setRows(data);
      setListError(null);
    } catch (err) {
      setListError(errMessage(err, locale));
    } finally {
      setListLoading(false);
    }
  }, [filter, locale]);

  const loadThread = useCallback(
    async (id: string, opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        setThreadLoading(true);
        setThreadError(null);
      }
      try {
        const [d, m] = await Promise.all([
          api.get<WhatsAppConversationDetail>(`/whatsapp/conversations/${id}`),
          api.get<WhatsAppTimelineItem[]>(`/whatsapp/conversations/${id}/messages`),
        ]);
        setDetail(d);
        setTimeline(m);
        if (d.unreadCount > 0) {
          // §18: открыли диалог → непрочитанные снимаются.
          await api.post(`/whatsapp/conversations/${id}/read`);
          setRows((prev) =>
            prev.map((row) =>
              row.id === id ? { ...row, unreadCount: 0, lastReadAt: new Date().toISOString() } : row,
            ),
          );
        }
      } catch (err) {
        if (!silent) setThreadError(errMessage(err, locale));
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // §18: опрос списка/ленты (10 c), пропускается при скрытой вкладке.
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadList();
      if (selectedId) void loadThread(selectedId, { silent: true });
    }, 10_000);
    return () => clearInterval(timer);
  }, [loadList, loadThread, selectedId]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline]);

  const select = (id: string) => {
    setSelectedId(id);
    setText("");
    setSendError(null);
    setUpload(null);
    setLinkOpen(false);
    setLinkResults(null);
    setLinkError(null);
    setLinkOk(null);
    void loadThread(id);
  };

  async function handleAttach(file: File) {
    setUploading(true);
    setSendError(null);
    try {
      setUpload(await uploadWhatsAppFile(file));
    } catch (err) {
      setSendError(errMessage(err, locale));
    } finally {
      setUploading(false);
    }
  }

  async function handleSend() {
    if (!detail) return;
    const body = text.trim();
    if (!body && !upload) {
      setSendError(t("whatsapp.need_text", locale));
      return;
    }
    if (uploading) return;
    setSending(true);
    setSendError(null);
    try {
      await sendWhatsAppMessage({
        conversationId: detail.id,
        text: body,
        customerId: detail.customerId,
        phone: detail.canonicalPhone,
        uploadId: upload?.uploadId ?? null,
      });
      setText("");
      setUpload(null);
      await Promise.all([loadThread(detail.id, { silent: true }), loadList()]);
    } catch (err) {
      setSendError(errMessage(err, locale));
    } finally {
      setSending(false);
    }
  }

  async function searchCustomers() {
    setLinkBusy(true);
    setLinkError(null);
    try {
      const results = await api.get<WhatsAppCustomerRef[]>(
        `/whatsapp/customer-search?search=${encodeURIComponent(linkQuery.trim())}`,
      );
      setLinkResults(results);
    } catch (err) {
      setLinkError(errMessage(err, locale));
    } finally {
      setLinkBusy(false);
    }
  }

  async function linkTo(customerId: string) {
    if (!detail) return;
    setLinkBusy(true);
    setLinkError(null);
    setLinkOk(null);
    try {
      const d = await api.post<WhatsAppConversationDetail>(
        `/whatsapp/conversations/${detail.id}/customer`,
        { customerId },
      );
      setDetail(d);
      setLinkOpen(false);
      setLinkResults(null);
      setLinkQuery("");
      setLinkOk(t("whatsapp.linked_ok", locale));
      await loadList();
    } catch (err) {
      setLinkError(errMessage(err, locale));
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{t("whatsapp.title", locale)}</h1>
          <p className="text-xs text-slate-400">{t("whatsapp.subtitle", locale)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadList();
            if (selectedId) void loadThread(selectedId, { silent: true });
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          {t("whatsapp.refresh", locale)}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* ── Колонка 1: список диалогов ─────────────────────────────────── */}
        <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("whatsapp.list_title", locale)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {t(f === "ALL" ? "whatsapp.filter.all" : `whatsapp.filter.${f}`, locale)}
              </button>
            ))}
          </div>
          <div className="thin-scroll max-h-[70vh] min-h-[260px] overflow-y-auto divide-y divide-slate-50">
            {listLoading && rows.length === 0 ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : listError ? (
              <div className="space-y-2 p-3 text-xs">
                <p className="text-red-600">{listError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setListLoading(true);
                    void loadList();
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50"
                >
                  {t("whatsapp.refresh", locale)}
                </button>
              </div>
            ) : rows.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">{t("whatsapp.empty_list", locale)}</p>
            ) : (
              rows.map((row) => {
                const selected = row.id === selectedId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => select(row.id)}
                    className={`w-full px-3 py-2.5 text-left transition-colors ${
                      selected ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {peerLabel(row.canonicalPhone, row.remoteJid, locale)}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {fmtTime(row.lastMessageAt, locale)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <MatchingBadge status={row.matchingStatus} locale={locale} />
                      {row.suppressed && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                          STOP
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                        {row.lastMessagePreview ?? "—"}
                      </span>
                      {row.unreadCount > 0 && (
                        <span
                          title={ti("whatsapp.unread_count", locale, { n: row.unreadCount })}
                          className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        >
                          {row.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Колонка 2: история + composer ──────────────────────────────── */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          {!detail ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-1 p-6 text-center">
              <p className="text-sm font-medium text-slate-600">{t("whatsapp.no_selection", locale)}</p>
              <p className="text-xs text-slate-400">{t("whatsapp.no_selection_hint", locale)}</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {peerLabel(detail.canonicalPhone, detail.remoteJid, locale)}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {detail.customer ? detail.customer.code : t("whatsapp.customer.none", locale)}
                  </div>
                </div>
                <span className="ml-auto">
                  <MatchingBadge status={detail.matchingStatus} locale={locale} />
                </span>
              </header>

              {detail.suppressed && (
                <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">
                  {t("whatsapp.suppressed", locale)}
                </div>
              )}

              <div
                ref={threadRef}
                className="thin-scroll h-[46vh] min-h-[280px] space-y-2 overflow-y-auto bg-slate-50 px-4 py-3"
              >
                {threadLoading && timeline.length === 0 ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-10 w-2/3 animate-pulse rounded-xl bg-slate-100" />
                    ))}
                  </div>
                ) : threadError ? (
                  <p className="text-xs text-red-600">{threadError}</p>
                ) : timeline.length === 0 ? (
                  <p className="pt-8 text-center text-xs text-slate-400">
                    {t("whatsapp.messages_empty", locale)}
                  </p>
                ) : (
                  timeline.map((item) => {
                    const outbound = item.direction === "OUTBOUND";
                    const failed = item.status !== null && item.status.startsWith("FAILED");
                    return (
                      <div key={item.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                            outbound
                              ? "bg-blue-600 text-white"
                              : "border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {item.body ?? (item.messageType !== "text" ? `[${item.messageType}]` : "")}
                          </div>
                          {item.hasMedia && (
                            <a
                              href={whatsappMediaUrl(item.origin, item.id)}
                              download
                              className={`mt-1 flex max-w-full items-center gap-2 rounded-lg border px-2 py-1 text-xs font-medium ${
                                outbound
                                  ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              <span className="truncate">
                                {item.mediaFilename ?? t("whatsapp.file", locale)}
                              </span>
                              {item.mediaSize !== null && (
                                <span className="shrink-0 opacity-70">{fmtBytes(item.mediaSize)}</span>
                              )}
                            </a>
                          )}
                          <div
                            className={`mt-1 flex flex-wrap items-center gap-2 text-[10px] ${
                              outbound ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            <span>{fmtTime(item.occurredAt, locale)}</span>
                            {outbound && item.status && (
                              <span className={failed ? "font-semibold text-red-200" : ""}>
                                {t(`whatsapp.outstatus.${item.status}`, locale)}
                              </span>
                            )}
                            {item.communicationCode && (
                              <span className="font-mono opacity-70">{item.communicationCode}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-2 border-t border-slate-100 px-4 py-3">
                {sendError && <p className="text-xs text-red-600">{sendError}</p>}
                {upload && (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <span className="truncate font-medium text-slate-700">{upload.filename}</span>
                    <span className="shrink-0 text-slate-400">{fmtBytes(upload.size)}</span>
                    <button
                      type="button"
                      onClick={() => setUpload(null)}
                      disabled={sending || uploading}
                      className="ml-auto shrink-0 rounded px-1 font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-40"
                      title={t("whatsapp.attach_remove", locale)}
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  disabled={!canSend || detail.suppressed || sending || uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleAttach(file);
                  }}
                />
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={!canSend || detail.suppressed || sending || uploading}
                    className="h-[44px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={t("whatsapp.attach", locale)}
                  >
                    {uploading ? t("whatsapp.attach_uploading", locale) : t("whatsapp.attach", locale)}
                  </button>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!sending && canSend && !detail.suppressed) void handleSend();
                      }
                    }}
                    rows={2}
                    maxLength={4000}
                    disabled={!canSend || detail.suppressed || sending}
                    placeholder={t("whatsapp.send_placeholder", locale)}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend || detail.suppressed || sending || uploading || (text.trim() === "" && !upload)}
                    className="h-[44px] shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? t("whatsapp.sending", locale) : t("whatsapp.send", locale)}
                  </button>
                </div>
                {!canSend && (
                  <p className="text-[11px] text-slate-400">{t("whatsapp.send_no_permission", locale)}</p>
                )}
              </div>
            </>
          )}
        </section>

        {/* ── Колонка 3: контекст, клиент, привязка ───────────────────────── */}
        <aside className="thin-scroll flex max-h-[70vh] min-h-[260px] flex-col gap-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("whatsapp.context.title", locale)}
            </h3>
            {detail?.context ? (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase text-slate-500">
                    {t(`whatsapp.context.${detail.context.type}`, locale)}
                  </span>
                  <span className="truncate font-mono text-xs text-blue-600">{detail.context.code}</span>
                </div>
                {detail.context.status && (
                  <div className="mt-1 text-xs text-slate-500">{detail.context.status}</div>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{t("whatsapp.context.none", locale)}</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("whatsapp.customer.title", locale)}
            </h3>
            {detail?.customer ? (
              <div className="mt-2 space-y-0.5 text-sm">
                <div className="font-medium text-slate-800">{detail.customer.name}</div>
                <div className="font-mono text-xs text-slate-400">{detail.customer.code}</div>
                <div className="text-xs text-slate-500">{detail.customer.email}</div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{t("whatsapp.customer.none", locale)}</p>
            )}
            {linkOk && <p className="mt-1 text-xs font-medium text-green-600">{linkOk}</p>}
          </div>

          {detail && detail.candidates.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("whatsapp.candidates.title", locale)}
              </h3>
              <div className="mt-2 space-y-2">
                {detail.candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-800">{c.name}</div>
                      <div className="truncate font-mono text-[11px] text-slate-400">{c.code}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void linkTo(c.id)}
                      disabled={!canManage || linkBusy}
                      className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t("whatsapp.link", locale)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail && !detail.customer && (
            <div>
              <button
                type="button"
                onClick={() => setLinkOpen((v) => !v)}
                disabled={!canManage}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("whatsapp.link_action", locale)}
              </button>
              {!canManage && (
                <p className="mt-1 text-[11px] text-slate-400">{t("whatsapp.link_no_permission", locale)}</p>
              )}
              {linkOpen && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={linkQuery}
                      onChange={(e) => setLinkQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && linkQuery.trim()) void searchCustomers();
                      }}
                      placeholder={t("whatsapp.link_search_placeholder", locale)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => void searchCustomers()}
                      disabled={linkBusy || linkQuery.trim() === ""}
                      className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t("whatsapp.link_search", locale)}
                    </button>
                  </div>
                  {linkError && <p className="text-xs text-red-600">{linkError}</p>}
                  {linkResults !== null &&
                    (linkResults.length === 0 ? (
                      <p className="text-xs text-slate-400">{t("whatsapp.link_none", locale)}</p>
                    ) : (
                      <div className="space-y-2">
                        {linkResults.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-slate-800">
                                {customerName(c) || c.email}
                              </div>
                              <div className="truncate font-mono text-[11px] text-slate-400">{c.code}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void linkTo(c.id)}
                              disabled={linkBusy}
                              className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {t("whatsapp.link", locale)}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
