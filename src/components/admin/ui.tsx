"use client";

import React, { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Sparkline } from "@/components/admin/charts";

/* ─────────────────────────────────────────────────────────────
   Единый UI-кит административной панели (все вкладки).
   Примитивы реализуют дизайн-токены из .ac-* классов в globals.css:
   единые размеры, радиусы, шрифты, кнопки, блоки, таблицы, фильтры.
   ───────────────────────────────────────────────────────────── */

/* ── Кнопка ── */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

export function Button({
  variant = "primary",
  size,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "lg" }) {
  const sizeCls = size === "sm" ? "ac-btn-sm" : size === "lg" ? "ac-btn-lg" : "";
  return <button className={`ac-btn ac-btn-${variant} ${sizeCls} ${className}`} {...props} />;
}

/* ── Карточка-секция с единым заголовком ── */
export function SectionCard({
  icon,
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  icon?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`ac-card ${className}`}>
      {(icon || title || subtitle || actions) && (
        <div className="flex items-start justify-between gap-3 flex-wrap px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title && (
              <h2 className="ac-card-title flex items-center gap-2">
                {icon && <span className="shrink-0">{icon}</span>}
                <span className="truncate">{title}</span>
              </h2>
            )}
            {subtitle && <p className="ac-card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
        </div>
      )}
      <div className={`px-4 pb-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ── Заголовок страницы: единое расположение на всех вкладках ── */
export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 flex-wrap ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl lg:text-2xl font-bold text-[var(--admin-text)] leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-[var(--admin-muted)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Табы (разделы страницы / рабочие пространства) ── */
export function Tabs({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { key: string; label: ReactNode }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`ac-tabs ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`ac-tab ${value === o.key ? "ac-tab-active" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Период-табы: единый набор и внешний вид ── */
export function PeriodTabs({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return <Tabs options={options} value={value} onChange={onChange} className={className} />;
}

/* ── KPI-карточка: единая структура иконка + значение + подпись ── */
export function KpiCard({
  icon,
  title,
  value,
  unit = "",
  change,
  changeSuffix,
  detail,
  color = "#0f172a",
  spark,
  onClick,
  isActive,
  activeHint = "⇣ фильтр",
  valueFormatter,
}: {
  icon?: string;
  title: string;
  value: ReactNode;
  unit?: string;
  change?: number;
  changeSuffix?: string;
  detail?: ReactNode;
  color?: string;
  spark?: number[];
  onClick?: () => void;
  isActive?: boolean;
  activeHint?: string;
  valueFormatter?: (v: number) => string;
}) {
  const Comp = onClick ? "button" : "div";
  const cardCls = `ac-card group p-3.5 text-left w-full transition-all ${onClick ? "hover:shadow-lg hover:border-primary/40 cursor-pointer" : ""} ${
    isActive ? "ring-2 ring-primary" : ""
  }`;
  return (
    <Comp
      className={cardCls}
      onClick={onClick}
      {...(onClick ? { type: "button", title: "Кликните для детализации" } : {})}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="ac-kpi-icon" style={{ background: `${color}1a`, color }}>
              {icon}
            </span>
          )}
          <span className="text-[11px] font-medium text-[var(--admin-muted)] leading-tight line-clamp-2">{title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <span className="ac-badge bg-primary/10 text-primary" style={{ background: `${color}1a`, color }}>
              ✕ снять
            </span>
          )}
          {onClick && !isActive && <span className="text-[10px] text-[var(--admin-muted)] opacity-0 group-hover:opacity-100 transition-opacity">{activeHint}</span>}
        </div>
      </div>
      <div className="mt-2.5">
        <span className="ac-kpi-value" style={{ color }}>
          {valueFormatter ? valueFormatter(Number(value)) : value}
          {unit && <span className="text-sm font-semibold ml-1" style={{ color: "var(--admin-muted)" }}>{unit}</span>}
        </span>
      </div>
      {detail && <div className="text-[10px] text-[var(--admin-muted)] mt-1 line-clamp-2">{detail}</div>}
      {change !== undefined && change !== null && (
        <div className="mt-1">
          <ChangeBadge change={change} suffix={changeSuffix} />
        </div>
      )}
      {spark && spark.length > 1 && (
        <div className="mt-2 h-7">
          <Sparkline data={spark.slice(-12)} color={color} height={28} />
        </div>
      )}
    </Comp>
  );
}

/* ── Бейдж изменения ▲/▼ ── */
export function ChangeBadge({ change, suffix = "" }: { change: number; suffix?: string }) {
  const up = change >= 0;
  return (
    <span className={`ac-change ${up ? "ac-change-up" : "ac-change-down"}`}>
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(change % 1 === 0 ? 0 : 1)}%
      {suffix && <span className="text-[var(--admin-muted)] font-normal"> {suffix}</span>}
    </span>
  );
}

/* ── Бейдж (статус и т.п.) ── */
export function Badge({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`ac-badge ${className}`} style={style}>
      {children}
    </span>
  );
}

/* ── Селект-фильтр с подписью ── */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = "",
  ...props
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-[11px] font-medium text-[var(--admin-muted)] block mb-1">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`ac-select w-full ${label ? "" : "h-9"}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ── Поле поиска с иконкой ── */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
  ...props
}: { value: string; onChange: (v: string) => void; placeholder?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className={`relative flex-1 min-w-[200px] ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-muted)] pointer-events-none">🔍</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ac-input w-full pl-9"
        {...props}
      />
    </div>
  );
}

/* ── Таблица с единой шапкой ── */
export function TableShell({
  columns,
  children,
  minWidth = "min-w-[900px]",
  className = "",
}: {
  columns: ReactNode[];
  children: ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`ac-table text-sm ${minWidth} ${className}`}>
        <thead>
          <tr>{columns.map((c, i) => <th key={i} className="ac-th">{c}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, className = "", ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`ac-tr border-b border-[var(--admin-border)]/60 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function Td({ children, className = "", ...props }: { children?: ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`ac-td ${className}`} {...props}>
      {children}
    </td>
  );
}

/* ── Чип-фильтр (быстрые фильтры) ── */
export function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button onClick={onClick} className={`ac-chip ${active ? "ac-chip-active" : ""} ${className}`}>
      {children}
    </button>
  );
}

/* ── Скелетон загрузки ── */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`ac-skeleton ${className}`} />;
}

/* ── Карточка-заглушка для пустых состояний ── */
export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-[var(--admin-muted)]">
      <div className="text-3xl mb-2">{icon}</div>
      {text}
    </div>
  );
}
