import Image from "next/image";
import { parseImages, formatPrice } from "@/lib/service-utils";

interface GuideData {
  id: string;
  title: string;
  slug: string;
  city?: string | null;
  country?: string | null;
  rating: number;
  reviewCount: number;
  price: number;
  discountPrice: number | null;
  currency: string;
  images: string;
  languages?: string | null;
}

export default function GuidesSection({ guides }: { guides: GuideData[] }) {
  if (!guides.length) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">🧭 Гиды</p>
            <h2 className="text-3xl font-extrabold text-secondary mb-3">Гиды</h2>
            <p className="text-gray-500 text-lg">Профессиональные гиды в любом городе</p>
          </div>
          <a href="/guides" className="hidden md:inline-flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors">
            Все гиды →
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {guides.map((guide) => {
            const img = parseImages(guide.images)[0] || "/placeholder.svg";
            const langs = (guide.languages || "RU, EN").split(",").map((l) => l.trim()).filter(Boolean);
            const price = guide.discountPrice ?? guide.price;
            return (
              <a
                key={guide.id}
                href={`/services/${guide.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image src={img} alt={guide.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">✓ Лицензия</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-secondary mb-1 group-hover:text-primary transition-colors line-clamp-1">{guide.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">📍 {guide.city}, {guide.country}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {langs.map((lang) => (
                      <span key={lang} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">{lang}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-amber-400 text-xs">★</span>
                    ))}
                    <span className="text-xs font-semibold text-secondary">{guide.rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-400">({guide.reviewCount})</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <span className="text-xl font-bold text-primary">{formatPrice(price, guide.currency)}</span>
                    <span className="text-xs text-primary font-medium group-hover:translate-x-1 transition-transform">Написать →</span>
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
