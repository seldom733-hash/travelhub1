const FEATURES = [
  { icon: "🔒", title: "Безопасная оплата", desc: "Защита всех транзакций" },
  { icon: "💰", title: "Гарантия возврата", desc: "Возврат средств по политике" },
  { icon: "⭐", title: "Проверенные отзывы", desc: "Только реальные отзывы" },
  { icon: "📞", title: "Поддержка 24/7", desc: "Помощь в любое время" },
];

const STATS = [
  { n: "35 000+", label: "Туров" },
  { n: "42 000+", label: "Отелей" },
  { n: "12 000+", label: "Экскурсий" },
  { n: "2 500+", label: "Гидов" },
  { n: "1 800+", label: "Фотографов" },
  { n: "4 000+", label: "Трансферов" },
];

export default function WhyTravelHub() {
  return (
    <section className="bg-gradient-to-br from-secondary via-slate-900 to-blue-950 text-white py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Почему TravelHub?</p>
          <h2 className="text-3xl md:text-4xl font-extrabold">Единая платформа для идеального путешествия</h2>
          <p className="text-white/60 mt-3 max-w-2xl mx-auto">
            Мы объединяем туроператоров, отели, гидов, фотографов и перевозчиков в одном месте.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
          {FEATURES.map((f) => (
            <div key={f.title} className="text-center bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center text-2xl mb-3">{f.icon}</div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-xs text-white/60">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-primary">{s.n}</div>
              <div className="text-xs text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
