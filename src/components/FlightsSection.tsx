import { formatPrice } from "@/lib/service-utils";

interface FlightData {
  id: string;
  title: string;
  slug: string;
  city?: string | null;
  country?: string | null;
  price: number;
  discountPrice: number | null;
  currency: string;
  duration?: string | null;
  images: string;
}

export default function FlightsSection({ flights }: { flights: FlightData[] }) {
  if (!flights.length) return null;

  return (
    <section className="py-16 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">✈ Авиабилеты</p>
          <h2 className="text-3xl font-extrabold text-secondary mb-3">Авиабилеты</h2>
          <p className="text-gray-500 text-lg">Лучшие цены на перелёты по всему миру</p>
        </div>
        <div className="space-y-4 max-w-5xl mx-auto">
          {flights.map((flight) => {
            const [fromRaw = "", toRaw = ""] = flight.title.split("→");
            const from = fromRaw.trim();
            const to = toRaw.trim();
            const price = flight.discountPrice ?? flight.price;
            return (
              <a
                key={flight.id}
                href={`/services/${flight.slug}`}
                className="group block bg-white rounded-2xl border border-gray-100 hover:border-sky-300 hover:shadow-lg transition-all p-5 md:p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0">
                  <div className="flex items-center gap-3 md:w-40 shrink-0">
                    <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-xl">✈</div>
                    <div>
                      <p className="text-sm font-semibold text-secondary">{from}</p>
                      <p className="text-xs text-gray-400">Прямой рейс</p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-4 md:gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-secondary">{from.slice(0, 3).toUpperCase()}</p>
                      <p className="text-sm text-gray-500">{flight.city}</p>
                    </div>
                    <div className="flex-1 relative px-2">
                      <div className="h-px bg-gray-300 w-full" />
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center">
                        <span className="text-sky-600 text-sm">✈</span>
                      </div>
                      {flight.duration && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">{flight.duration}</div>
                      )}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-secondary">{to.slice(0, 3).toUpperCase()}</p>
                      <p className="text-sm text-gray-500">{flight.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-6 md:w-64 shrink-0">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Сегодня</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">от {formatPrice(price, flight.currency)}</p>
                    </div>
                    <span className="hidden md:inline-flex w-10 h-10 bg-primary/10 rounded-xl items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">→</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <a
            href="/flights"
            className="inline-flex items-center gap-2 h-12 px-8 bg-primary hover:bg-primary-dark text-white rounded-2xl font-semibold transition-all hover:shadow-lg hover:shadow-primary/30"
          >
            ✈ Все авиабилеты
          </a>
        </div>
      </div>
    </section>
  );
}
