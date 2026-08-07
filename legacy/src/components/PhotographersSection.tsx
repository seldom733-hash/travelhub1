import Image from "next/image";
import { parseImages, formatPrice } from "@/lib/service-utils";

interface PhotoData {
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
}

export default function PhotographersSection({ photographers }: { photographers: PhotoData[] }) {
  if (!photographers.length) return null;

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">📷 Фотографы</p>
            <h2 className="text-3xl font-extrabold text-secondary mb-3">Фотографы</h2>
            <p className="text-gray-500 text-lg">Профессиональная съёмка для вашего путешествия</p>
          </div>
          <a href="/photographers" className="hidden md:inline-flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors">
            Все фотографы →
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {photographers.map((p) => {
            const imgs = parseImages(p.images);
            const price = p.discountPrice ?? p.price;
            return (
              <a
                key={p.id}
                href={`/services/${p.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-pink-300 hover:shadow-lg transition-all"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image src={imgs[0] || "/placeholder.svg"} alt={p.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  {imgs[1] && (
                    <div className="absolute top-3 right-3">
                      <Image src={imgs[1]} alt={p.title} width={48} height={48} className="rounded-full border-2 border-white object-cover shadow-lg" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-secondary group-hover:text-pink-500 transition-colors line-clamp-1">{p.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">📍 {p.city}, {p.country}</p>
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-sm font-semibold text-secondary">{p.rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-400">({p.reviewCount})</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <span className="text-xl font-bold text-primary">от {formatPrice(price, p.currency)}</span>
                    <span className="text-xs text-primary font-medium group-hover:translate-x-1 transition-transform">Заказать →</span>
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
