const PARTNER_TYPES = [
  { icon: "🏢", label: "Туроператоры" },
  { icon: "🏨", label: "Отели" },
  { icon: "🏥", label: "Санатории" },
  { icon: "🧭", label: "Гиды" },
  { icon: "📷", label: "Фотографы" },
  { icon: "🚐", label: "Перевозчики" },
  { icon: "🏛", label: "Экскурсии" },
];

export default function ForPartners() {
  return (
    <section className="py-20 bg-gradient-to-br from-primary via-orange-500 to-primary-dark overflow-hidden relative">
      <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <span className="text-sm font-medium text-white">🤝 Партнёрам</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Размещайте свои услуги на TravelHub
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg">
              Присоединяйтесь к платформе и получайте заказы от тысяч путешественников по всему миру.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {PARTNER_TYPES.map((type) => (
                <div key={type.label} className="flex items-center gap-2 text-white/90">
                  <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                </div>
              ))}
            </div>
            <a
              href="/partner"
              className="inline-flex items-center gap-2 h-14 px-8 bg-white text-primary rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all hover:shadow-lg active:scale-95"
            >
              Стать партнёром →
            </a>
          </div>
          <div className="hidden md:block">
            <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-6">💎 Преимущества партнёра</h3>
              <div className="space-y-4">
                {[
                  { icon: "📈", text: "Рост продаж и новых клиентов" },
                  { icon: "💳", text: "Прозрачные комиссии платформы" },
                  { icon: "🛡", text: "Безопасные онлайн-оплаты" },
                  { icon: "🎯", text: "Умные рекомендации по ценообразованию" },
                  { icon: "🌍", text: "Доступ к туристам из 100+ стран" },
                  { icon: "📊", text: "Детальная аналитика продаж" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
                    <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg shrink-0">{item.icon}</span>
                    <span className="text-white/90 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
