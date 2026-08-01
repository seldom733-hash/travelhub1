import { parseImages, formatPrice, TYPE_META } from "@/lib/service-utils";

export interface ServiceCardData {
  id: string;
  type: string;
  title: string;
  slug: string;
  price: number;
  discountPrice: number | null;
  currency: string;
  city?: string | null;
  country?: string | null;
  rating: number;
  reviewCount: number;
  images: string;
  duration?: string | null;
  isHot?: boolean;
  hotDiscount?: number | null;
}

export default function ServiceCard({ s }: { s: ServiceCardData }) {
  const img = parseImages(s.images)[0] || "/placeholder.svg";
  const meta = TYPE_META[s.type] || { label: "Услуга", icon: "🧳", per: "" };
  const finalPrice = s.discountPrice ?? s.price;

  return (
    <a
      href={`/services/${s.slug}`}
      className="group bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={img}
          alt={s.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="bg-white/95 backdrop-blur rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-700 shadow-sm">
            {meta.icon} {meta.label}
          </span>
        </div>
        {s.discountPrice && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-[11px] font-bold rounded-lg px-2 py-1 shadow-lg">
            −{Math.round(((s.price - s.discountPrice) / s.price) * 100)}%
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-star">★</span>
          <span className="text-sm font-bold text-secondary">{s.rating.toFixed(1)}</span>
          <span className="text-xs text-gray-400">({s.reviewCount})</span>
        </div>
        <h3 className="text-[15px] font-bold text-secondary leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {s.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {s.city && <span>{s.city}</span>}
          {s.country && <span>{s.city ? ", " : ""}{s.country}</span>}
          {s.duration ? <span> · {s.duration}</span> : null}
        </p>

        <div className="mt-auto pt-3 flex items-end justify-between">
          <div>
            {s.discountPrice && (
              <div className="text-xs text-gray-400 line-through">{formatPrice(s.price, s.currency)}</div>
            )}
            <div className="text-lg font-extrabold text-primary">{formatPrice(finalPrice, s.currency)}</div>
            <div className="text-[10px] text-gray-400">{meta.per}</div>
          </div>
          <span className="text-primary group-hover:translate-x-0.5 transition-transform">→</span>
        </div>
      </div>
    </a>
  );
}
