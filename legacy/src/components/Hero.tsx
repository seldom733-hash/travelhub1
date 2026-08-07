"use client";

import { useState, useEffect } from "react";
import { TYPE_LIST, TYPE_META } from "@/lib/service-utils";

interface Stats {
  services: { tours: number; hotels: number; excursions: number };
}

function formatCount(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)} 000+`;
  return `${n}+`;
}

export default function Hero() {
  const [type, setType] = useState("TOUR");
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.services) setStats(data);
      })
      .catch(() => {});
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("type", type);
    if (query.trim()) params.set("q", query.trim());
    window.location.href = `/search?${params.toString()}`;
  };

  return (
    <section className="relative min-h-[600px] lg:min-h-[720px] flex items-center overflow-hidden">
      {/* Фон: фото + градиентные оверлеи */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/8c1f6b8a-ab32-4328-bd69-dc88fa854597.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="max-w-3xl">
          {/* Бейдж — как в старом проекте */}
          <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2.5 mb-8 animate-fadeInUp border border-white/20">
            <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
            <span className="text-white text-[11px] sm:text-xs font-extrabold tracking-widest uppercase">
              Travel Holiday Unified Booking (TravelHUB) — единая платформа для бронирования
            </span>
          </div>

          {/* Заголовок — как в старом проекте */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold text-white leading-[1.15] mb-7 animate-fadeInUp">
            <span className="block text-white">Единая экосистема</span>
            <span className="block mt-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-amber-400 to-primary">
                для путешествий
              </span>
            </span>
          </h1>

          {/* Подзаголовок — как в старом проекте */}
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl animate-fadeInUp leading-relaxed font-medium">
            TravelHUB объединяет туры, отели, авиабилеты, экскурсии, гидов, фотографов и трансферы в единой платформе для бронирования всех туристических услуг. Забронируйте путешествие мечты за несколько кликов.
          </p>

          {/* Поиск */}
          <form onSubmit={onSearch} className="max-w-3xl bg-white rounded-3xl p-3 shadow-2xl animate-fadeInUp">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-2xl px-4 h-12">
                <span className="text-gray-400">📍</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Куда поедем?"
                  className="flex-1 bg-transparent outline-none text-sm text-secondary placeholder-gray-400"
                />
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 h-12 min-w-48">
                <span className="text-gray-400">🧭</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-secondary font-medium"
                >
                  {TYPE_LIST.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary-dark text-white text-sm font-bold transition-all shadow-lg shadow-primary/30 active:scale-[0.98]"
              >
                🔍 Найти
              </button>
            </div>
          </form>

          {/* Статистика */}
          <div className="grid grid-cols-3 gap-6 sm:gap-8 mt-14 pt-8 border-t border-white/20 animate-fadeInUp">
            {[
              { value: stats ? formatCount(stats.services.tours) : null, label: "Туров", icon: "🏖" },
              { value: stats ? formatCount(stats.services.hotels) : null, label: "Отелей", icon: "🏨" },
              { value: stats ? formatCount(stats.services.excursions) : null, label: "Экскурсий", icon: "🏛" },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{s.icon}</span>
                  {s.value ? (
                    <span className="text-2xl sm:text-3xl font-extrabold text-primary">{s.value}</span>
                  ) : (
                    <span className="inline-block w-20 h-8 bg-white/10 rounded-lg animate-pulse" />
                  )}
                </div>
                <div className="text-sm text-white/70 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
