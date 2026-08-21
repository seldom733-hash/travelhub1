"use client";

import { useEffect, useRef, useState } from "react";
import { dashboardApi, type TrendResponse, type DashboardSection } from "@/lib/dashboard-api";

interface Props {
  metric: string;
  title: string;
  section: DashboardSection;
  unsupported?: boolean;
}

export function TrendWidget({ metric, title, unsupported }: Props) {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (unsupported) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    dashboardApi
      .getTrend(
        { preset: "MONTH", metric, timezone: "UTC", granularity: "DAY" },
        controller.signal,
      )
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (err.name === "TrendNotAvailableError") {
          setError("Метрика пока не поддерживается");
        } else if (err.name === "ForbiddenError") {
          setError("Нет доступа к этой метрике");
        } else {
          setError("Ошибка загрузки тренда");
        }
        setLoading(false);
      });

    return () => controller.abort();
  }, [metric, unsupported]);

  if (unsupported) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
        <div className="mt-2 text-sm text-slate-400">
          Метрика пока не поддерживается backend
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-slate-100" aria-busy />
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
        <div className="mt-4 text-center text-sm text-slate-400">Нет данных за выбранный период</div>
      </div>
    );
  }

  // Simple bar chart using CSS (recharts available but using CSS for minimal footprint)
  const max = Math.max(...data.buckets.map((b) => b.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-3 flex items-end gap-1" style={{ height: 100 }}>
        {data.buckets.map((bucket, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-blue-500 transition-all"
            style={{ height: `${(bucket.value / max) * 100}%`, minHeight: bucket.value > 0 ? 2 : 0 }}
            title={`${bucket.label}: ${bucket.value}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data.buckets[0]?.label}</span>
        <span>{data.buckets[data.buckets.length - 1]?.label}</span>
      </div>
      {/* Accessible data table (screen readers) */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Period</th>
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
