import Image from "next/image";

const DESTINATIONS = [
  { name: "Турция", icon: "🇹🇷", count: "3 240 туров", img: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=600&q=80" },
  { name: "Грузия", icon: "🇬🇪", count: "1 870 туров", img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80" },
  { name: "ОАЭ", icon: "🇦🇪", count: "2 130 туров", img: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80" },
  { name: "Азербайджан", icon: "🇦🇿", count: "1 540 туров", img: "https://images.unsplash.com/photo-1565113961-eeab10cbb7ef?w=600&q=80" },
  { name: "Мальдивы", icon: "🇲🇻", count: "960 туров", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80" },
  { name: "Таиланд", icon: "🇹🇭", count: "1 420 туров", img: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=600&q=80" },
];

export default function PopularDestinations() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-14">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">🌍 Направления</p>
          <h2 className="text-3xl font-extrabold text-secondary">Популярные направления</h2>
          <p className="text-gray-400 mt-2">Самые востребованные направления сезона</p>
        </div>
        <a href="/search" className="hidden sm:block text-sm font-semibold text-primary hover:text-primary-dark">
          Все направления →
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {DESTINATIONS.map((d) => (
          <a
            key={d.name}
            href={`/search?country=${encodeURIComponent(d.name)}`}
            className="group relative rounded-3xl overflow-hidden h-44 shadow-sm hover:shadow-xl transition-all duration-300"
          >
            <Image src={d.img} alt={d.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <div className="text-lg font-bold">{d.icon} {d.name}</div>
              <div className="text-[11px] text-white/70">{d.count}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
