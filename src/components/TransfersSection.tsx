import { parseImages, formatPrice } from "@/lib/service-utils";

const FLAGS: Record<string, string> = {
  AZ: "🇦🇿", TR: "🇹🇷", GE: "🇬🇪", AE: "🇦🇪", RU: "🇷🇺", TH: "🇹🇭", MV: "🇲🇻",
};

interface TransferData {
  id: string;
  title: string;
  slug: string;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  rating: number;
  reviewCount: number;
  price: number;
  discountPrice: number | null;
  currency: string;
  images: string;
  duration?: string | null;
  maxGuests?: number | null;
}

export default function TransfersSection({ transfers }: { transfers: TransferData[] }) {
  if (!transfers.length) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">🚐 Трансферы</p>
            <h2 className="text-3xl font-extrabold text-secondary mb-3">Трансферы</h2>
            <p className="text-gray-500 text-lg">Комфортные поездки от аэропорта до отеля</p>
          </div>
          <a href="/transfers" className="hidden md:inline-flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors">
            Все трансферы →
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {transfers.map((tr) => {
            const img = parseImages(tr.images)[0] || "/placeholder.svg";
            const price = tr.discountPrice ?? tr.price;
            return (
              <a
                key={tr.id}
                href={`/services/${tr.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <div className="relative h-48 overflow-hidden">
                  <img src={img} alt={tr.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  {tr.duration && (
                    <div className="absolute top-3 left-3">
                      <span className="bg-white/90 backdrop-blur-sm text-secondary text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                        ⏱ {tr.duration}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-secondary mb-1 group-hover:text-primary transition-colors text-sm leading-tight line-clamp-1">{tr.title}</h3>
                  <p className="text-xs text-gray-500 mb-2">
                    {FLAGS[tr.countryCode || ""] || "🏳"} {tr.city}
                  </p>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`text-xs ${i < Math.floor(tr.rating) ? "text-amber-400" : "text-gray-300"}`}>★</span>
                    ))}
                    <span className="text-xs text-gray-400">({tr.reviewCount || 0})</span>
                  </div>
                  {tr.maxGuests ? (
                    <p className="text-xs text-gray-400 mb-2">👥 до {tr.maxGuests} чел.</p>
                  ) : null}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div>
                      {tr.discountPrice ? (
                        <span className="text-xs text-gray-400 line-through mr-1">{formatPrice(tr.price, tr.currency)}</span>
                      ) : null}
                      <span className="text-lg font-bold text-primary">{formatPrice(price, tr.currency)}</span>
                    </div>
                    <span className="text-xs text-gray-400">за поездку</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
