import { prisma } from "@/lib/prisma";

export default async function Footer() {
  let tours = 0, hotels = 0, users = 0;
  try {
    const [t, h, u] = await Promise.all([
      prisma.service.count({ where: { type: "TOUR", isActive: true } }),
      prisma.service.count({ where: { type: "HOTEL", isActive: true } }),
      prisma.user.count(),
    ]);
    tours = t; hotels = h; users = u;
  } catch {
    // Футер не должен ронять страницу при недоступной БД
  }

  const columns = [
    { title: "Компания", links: [["О нас", "/about"], ["Блог", "/blog"], ["Контакты", "/contacts"]] },
    { title: "Категории", links: [["Туры", "/tours"], ["Отели", "/hotels"], ["Санатории", "/sanatoriums"], ["Экскурсии", "/excursions"]] },
    { title: "Партнерам", links: [["Комиссии", "/partners/commissions"], ["API", "/partners/api"], ["Документация", "/partners/docs"]] },
    { title: "Поддержка", links: [["FAQ", "/faq"], ["Возвраты", "/returns"], ["Политика", "/policy"]] },
  ];

  return (
    <footer className="bg-secondary text-white">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12 pb-12 border-b border-white/10">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-primary mb-1">{Math.max(tours, 1).toLocaleString("ru-RU")}+</div>
            <div className="text-sm text-gray-400">Услуг</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-primary mb-1">{hotels.toLocaleString("ru-RU")}+</div>
            <div className="text-sm text-gray-400">Отелей</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-primary mb-1">{users.toLocaleString("ru-RU")}+</div>
            <div className="text-sm text-gray-400">Пользователей</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-primary mb-1">24/7</div>
            <div className="text-sm text-gray-400">Поддержка</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-3 lg:col-span-1 mb-4 lg:mb-0">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg">T</div>
              <span className="text-xl font-bold">Travel<span className="text-primary">Hub</span></span>
            </a>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">Единая платформа для путешествий: туры, отели, авиабилеты, экскурсии и многое другое.</p>
            <div className="flex gap-3">
              {["f", "📷", "𝕏", "▶"].map((s, i) => (
                <a key={i} href="#" className="w-10 h-10 bg-white/10 hover:bg-primary rounded-xl flex items-center justify-center transition-colors" target="_blank" rel="noopener noreferrer">
                  <span className="text-sm">{s}</span>
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="text-sm text-gray-400 hover:text-primary transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} TravelHub. Все права защищены.</p>
          <div className="flex items-center gap-6">
            <a href="/terms" className="text-sm text-gray-500 hover:text-white transition-colors">Условия использования</a>
            <a href="/privacy" className="text-sm text-gray-500 hover:text-white transition-colors">Политика конфиденциальности</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
