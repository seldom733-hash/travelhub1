"use client";

import { useEffect, useState } from "react";

function useCountdown() {
  const [left, setLeft] = useState(3 * 24 * 3600);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { h, m, s, pad };
}

export default function HotTours() {
  const { h, m, s, pad } = useCountdown();
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="relative rounded-[2rem] bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 text-white overflow-hidden p-8 md:p-12">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #fff 2px, transparent 2.5px)", backgroundSize: "40px 40px" }} />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-2">🔥 Горящие туры</p>
            <h2 className="text-3xl md:text-4xl font-extrabold">Скидки до 40%</h2>
            <p className="text-white/80 mt-2 max-w-md">
              Успейте забронировать по лучшим ценам — предложения обновляются каждый день.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center text-2xl font-extrabold">{pad(h)}</div>
              <div className="text-[10px] text-white/70 mt-1 uppercase">часов</div>
            </div>
            <span className="text-2xl font-bold">:</span>
            <div className="text-center">
              <div className="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center text-2xl font-extrabold">{pad(m)}</div>
              <div className="text-[10px] text-white/70 mt-1 uppercase">минут</div>
            </div>
            <span className="text-2xl font-bold">:</span>
            <div className="text-center">
              <div className="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center text-2xl font-extrabold">{pad(s)}</div>
              <div className="text-[10px] text-white/70 mt-1 uppercase">секунд</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
