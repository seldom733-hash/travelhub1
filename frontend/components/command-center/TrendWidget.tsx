"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  dashboardApi,
  type TrendResponse,
  type DashboardSection,
  type PeriodPreset,
  SUPPORTED_TREND_METRICS,
} from "@/lib/dashboard-api";
import { t, type Locale } from "@/lib/i18n";

interface Props {
  metric: string;
  title: string;
  section: DashboardSection;
  /** Current period state from parent */
  periodPreset: PeriodPreset;
  customStart?: string;
  customEnd?: string;
  /** Server-authoritative available metrics — metric must be in this list */
  availableMetrics: string[];
  unsupported?: boolean;
  locale?: Locale;
}

export function TrendWidget({
  metric,
  title,
  periodPreset,
  customStart,
  customEnd,
  availableMetrics,
  unsupported,
  locale = "ru",
}: Props) {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // GATE: metric must be in availableMetrics AND in SUPPORTED_TREND_METRICS
  const isSupportedBackend =
    (SUPPORTED_TREND_METRICS as readonly string[]).includes(metric) &&
    (availableMetrics as readonly string[]).includes(metric);

  useEffect(() => {
    if (unsupported || !isSupportedBackend) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const params: {
      preset: PeriodPreset;
      metric: string;
      timezone: string;
      startDate?: string;
      endDate?: string;
    } = {
      preset: periodPreset,
      metric,
      timezone: "UTC",
    };
    if (periodPreset === "CUSTOM") {
      params.startDate = customStart;
      params.endDate = customEnd;
    }

    dashboardApi
      .getTrend(params, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (err.name === "TrendNotAvailableError") {
          setError(t("cc.trend_unsupported", locale));
        } else if (err.name === "ForbiddenError") {
          setError(t("cc.trend_no_access", locale));
        } else {
          setError(t("cc.trend_error", locale));
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, [metric, unsupported, isSupportedBackend, periodPreset, customStart, customEnd, locale]);

  // Do not render if metric is not supported
  if (!isSupportedBackend && !unsupported) return null;

  if (unsupported) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
        <div className="mt-2 text-sm text-slate-400">
          {t("cc.trend_unsupported", locale)}
        </div>
        {/* Screen reader: no data available */}
        <div className="sr-only" role="status">{t("cc.trend_unsupported", locale)}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-slate-100" aria-busy role="status" aria-label={t("cc.loading", locale)} />
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
        <div className="mt-2 text-sm text-slate-400">{error}</div>
      </div>
    );
  }

  if (!data || data.buckets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
        <div className="mt-4 text-center text-sm text-slate-400">{t("cc.no_data", locale)}</div>
      </div>
    );
  }

  const chartData = data.buckets.map((b) => ({
    name: b.label,
    value: b.value,
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-3" style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Accessible data table (screen readers) */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>{t("cc.period.start", locale)}</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.buckets.map((b, i) => (
            <tr key={i}>
              <td>{b.label}</td>
              <td>{b.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
