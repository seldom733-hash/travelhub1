"use client";

import type { MouseEvent } from "react";

/**
 * Лёгкие SVG-графики без внешних зависимостей.
 */

export function Sparkline({
  data,
  color = "#22c55e",
  height = 36,
  onPointClick,
  pointLabels,
  activeIndex,
}: {
  data: number[];
  color?: string;
  height?: number;
  // Drill-down (Гл. 3.6): клик по спарклайну (у ненулевой точки) → фильтр
  // реестра по бакету (день/час). Индекс — позиция в переданном массиве data.
  onPointClick?: (index: number) => void;
  // Подписи точек для тултипов (должны соответствовать data по индексу).
  pointLabels?: string[];
  // Активный бакет (drill-down, Гл. 3.6): кольцо-подсветка выбранной точки.
  activeIndex?: number;
}) {
  const w = 120;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const xAt = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * w : w / 2);
  const yAt = (v: number) => height - 3 - ((v - min) / range) * (height - 6);
  const pts = data.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  const last = data[data.length - 1] ?? 0;
  const lastY = yAt(last);

  // Клик по всему SVG: ищем ближайшую НЕНУЛЕВУЮ точку (клик по нулевому бакету
  // не открывает пустой список). Обработчик на SVG (а не на отдельных rect)
  // делает область клика шире и надёжнее; stopPropagation не даёт клику по
  // графику сработать как клик по KPI-карточке.
  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPointClick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * w;
    let best = -1;
    let bestDist = Infinity;
    data.forEach((v, i) => {
      if (v <= 0) return;
      const d = Math.abs(xAt(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    // Клик вне «полосы» точек (ближе к нулевым участкам) игнорируем
    if (best >= 0 && bestDist <= (w / data.length) * 0.7) onPointClick(best);
    e.stopPropagation();
  };

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className={`w-full h-full ${onPointClick ? "cursor-pointer" : ""}`}
      preserveAspectRatio="none"
      onClick={handleClick}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Маркеры ненулевых точек — видимые зоны клика (drill-down, Гл. 3.6) */}
      {onPointClick &&
        data.map((v, i) =>
          v > 0 ? (
            <circle key={i} cx={xAt(i)} cy={yAt(v)} r={i === data.length - 1 ? 3 : 2.2} fill={color}>
              {pointLabels?.[i] && <title>{`${pointLabels[i]} · ${v}`}</title>}
            </circle>
          ) : null
        )}
      {/* Кольцо активного бакета (drill-down, Гл. 3.6) — поверх маркера точки */}
      {activeIndex != null && activeIndex >= 0 && activeIndex < data.length && data[activeIndex] > 0 && (
        <circle cx={xAt(activeIndex)} cy={yAt(data[activeIndex])} r="5" fill="none" stroke={color} strokeWidth="1.6" opacity="0.85" />
      )}
      {/* Фиксированный маркер последней точки — только если её нет среди
          интерактивных маркеров (нулевое значение или неинтерактивный график) */}
      {(!onPointClick || last <= 0) && <circle cx={w} cy={lastY} r="2.5" fill={color} />}
    </svg>
  );
}

export interface SeriesPoint {
  label: string;
  value: number;
}

type ChartMode = "line" | "bar" | "area";

/** График доходов: линия / столбцы / область (SVG). */
export function RevenueChart({
  data,
  mode = "line",
  height = 220,
  color = "#f97316",
}: {
  data: SeriesPoint[];
  mode?: ChartMode;
  height?: number;
  color?: string;
}) {
  const w = 640;
  const pad = { top: 16, right: 12, bottom: 24, left: 40 };
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1) * 1.1;

  const x = (i: number) => pad.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const step = Math.max(1, Math.ceil(data.length / 12));
  // Тики сетки: при малых суммах округление даёт дубликаты (0,0,1,1) — убираем их,
  // а ключ берём по индексу, чтобы он всегда был уникальным.
  const ticks = [...new Set(Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i)))];

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const areaPath =
    data.length > 1
      ? `${linePath} L${x(data.length - 1).toFixed(1)},${pad.top + innerH} L${x(0).toFixed(1)},${pad.top + innerH} Z`
      : "";

  const barW = Math.max(2, Math.min(18, (innerW / Math.max(1, data.length)) * 0.7));

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
        {/* сетка */}
        {ticks.map((t, i) => (
          <g key={`tick-${i}`}>
            <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke="var(--admin-border)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--admin-muted)">
              {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
            </text>
          </g>
        ))}

        {mode === "bar" ? (
          data.map((d, i) => (
            <rect
              key={`bar-${i}`}
              x={x(i) - barW / 2}
              y={y(d.value)}
              width={barW}
              height={Math.max(1, pad.top + innerH - y(d.value))}
              rx="3"
              fill={color}
              opacity="0.85"
            >
              <title>{`${d.label}: ${d.value} $`}</title>
            </rect>
          ))
        ) : (
          <>
            {mode === "area" && areaPath && <path d={areaPath} fill={color} opacity="0.18" />}
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) =>
              i % step === 0 ? <circle key={`dot-${i}`} cx={x(i)} cy={y(d.value)} r="3" fill={color} stroke="var(--admin-card)" strokeWidth="1.5" /> : null
            )}
          </>
        )}

        {/* подписи оси X */}
        {data.map((d, i) =>
          i % step === 0 ? (
            <text key={`lbl-${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--admin-muted)">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

/** Кольцевая диаграмма продаж по категориям. */
export function DonutChart({
  data,
  size = 200,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 22;
  const circ = 2 * Math.PI * r;

  // Кумулятивные смещения сегментов — без мутации во время рендера
  const segments = data.map((d, i) => ({
    ...d,
    dash: (d.value / total) * circ,
    offset: data.slice(0, i).reduce((a, x) => a + (x.value / total) * circ, 0),
  }));

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--admin-bg)" strokeWidth={stroke} />
        {segments.map((d) => (
          <circle
            key={d.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={stroke}
            strokeDasharray={`${d.dash} ${circ - d.dash}`}
            strokeDashoffset={-d.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          >
            <title>{`${d.label}: ${d.value} $`}</title>
          </circle>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="bold" fill="var(--admin-text)">
          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : Math.round(total)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--admin-muted)">
          всего, $
        </text>
      </svg>
      <div className="flex-1 min-w-[140px] space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="flex-1 truncate text-[var(--admin-muted)]">{d.label}</span>
            <span className="font-semibold">{d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : Math.round(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CHART_COLORS = ["#f97316", "#06b6d4", "#22c55e", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6", "#14b8a6", "#a3e635"];
