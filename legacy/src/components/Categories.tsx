import { TYPE_META, TYPE_LIST } from "@/lib/service-utils";

const COUNTS: Record<string, string> = {
  TOUR: "35 000+ туров",
  HOTEL: "42 000+ объектов",
  SANATORIUM: "800+ санаториев",
  FLIGHT: "500+ направлений",
  TRAIN: "3 000+ маршрутов",
  EXCURSION: "12 000+ экскурсий",
  GUIDE: "2 500+ гидов",
  TRANSFER: "4 000+ маршрутов",
  PHOTOGRAPHER: "1 800+ фотографов",
};

const COLORS: Record<string, string> = {
  TOUR: "from-orange-500 to-amber-500",
  HOTEL: "from-blue-500 to-indigo-500",
  SANATORIUM: "from-emerald-500 to-teal-500",
  FLIGHT: "from-sky-500 to-cyan-500",
  TRAIN: "from-violet-500 to-purple-500",
  EXCURSION: "from-rose-500 to-pink-500",
  GUIDE: "from-teal-500 to-emerald-500",
  TRANSFER: "from-slate-600 to-slate-800",
  PHOTOGRAPHER: "from-fuchsia-500 to-purple-600",
};

export default function Categories() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-14">
      <div className="text-center mb-10">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">🌍 Каталог услуг</p>
        <h2 className="text-3xl font-extrabold text-secondary">Выберите категорию</h2>
        <p className="text-gray-400 mt-2">Более 100 000 услуг для вашего идеального путешествия</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {TYPE_LIST.map((t) => {
          const meta = TYPE_META[t];
          return (
            <a
              key={t}
              href={`/search?type=${t}`}
              className="group bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${COLORS[t] || "from-gray-500 to-gray-700"} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}
              >
                {meta.icon}
              </div>
              <h3 className="font-bold text-secondary mt-4 group-hover:text-primary transition-colors">{meta.label}</h3>
              <p className="text-[11px] text-gray-400 mt-1">{COUNTS[t]}</p>
              <span className="inline-block mt-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Подробнее →</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
