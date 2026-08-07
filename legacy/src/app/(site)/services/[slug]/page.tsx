import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatPrice, TYPE_META } from "@/lib/service-utils";
import { getCatalog } from "@/lib/catalog";
import ServiceCard, { ServiceCardData } from "@/components/ServiceCard";
import ServiceGallery from "@/components/ServiceGallery";

export const dynamic = "force-dynamic";

const DETAIL_SELECT = {
  id: true,
  type: true,
  title: true,
  slug: true,
  description: true,
  shortDesc: true,
  price: true,
  discountPrice: true,
  currency: true,
  city: true,
  country: true,
  countryCode: true,
  rating: true,
  reviewCount: true,
  images: true,
  duration: true,
  isHot: true,
  hotDiscount: true,
  languages: true,
  maxGuests: true,
  latitude: true,
  longitude: true,
  isActive: true,
  provider: {
    select: { firstName: true, lastName: true, companyName: true },
  },
} as const;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
    select: { title: true, shortDesc: true, city: true, country: true },
  });
  if (!service) return { title: "Услуга не найдена — TravelHub" };
  return {
    title: `${service.title} — TravelHub`,
    description: service.shortDesc || `${service.city}, ${service.country}`,
  };
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`text-sm ${i < Math.round(rating) ? "text-star" : "text-gray-300"}`}>★</span>
      ))}
    </div>
  );
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
    select: DETAIL_SELECT,
  });
  if (!service || !service.isActive) notFound();

  const meta = TYPE_META[service.type] || { label: "Услуга", icon: "🧳", per: "" };
  const catalog = getCatalog(service.type);
  const finalPrice = service.discountPrice ?? service.price;
  const discountPct = service.discountPrice
    ? Math.round(((service.price - service.discountPrice) / service.price) * 100)
    : 0;
  const langs = (service.languages || "")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  // Похожие услуги того же типа
  const similar = await prisma.service.findMany({
    where: { type: service.type, isActive: true, id: { not: service.id } },
    select: {
      id: true,
      type: true,
      title: true,
      slug: true,
      price: true,
      discountPrice: true,
      currency: true,
      city: true,
      country: true,
      rating: true,
      reviewCount: true,
      images: true,
      duration: true,
      isHot: true,
      hotDiscount: true,
    },
    orderBy: { reviewCount: "desc" },
    take: 4,
  });

  return (
    <main className="min-h-[60vh]">
      {/* Хлебные крошки */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-primary transition-colors">Главная</Link>
          <span>→</span>
          {catalog && (
            <>
              <a href={catalog.path} className="hover:text-primary transition-colors">{catalog.title}</a>
              <span>→</span>
            </>
          )}
          <span className="text-gray-600 truncate max-w-[200px]">{service.title}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-[1.2fr_1fr] gap-8">
        {/* Левая колонка: галерея + описание */}
        <div>
          <ServiceGallery images={service.images} title={service.title} />

          {/* Описание */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-secondary mb-3">Описание</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">
              {service.description || service.shortDesc || "Описание скоро появится. Обратитесь к нам — поможем подобрать идеальный вариант."}
            </p>
          </div>

          {/* Характеристики */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {service.duration && (
              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <div className="text-xl mb-1">⏱</div>
                <div className="text-xs text-gray-400">Длительность</div>
                <div className="text-sm font-bold text-secondary mt-0.5">{service.duration}</div>
              </div>
            )}
            {service.maxGuests && (
              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <div className="text-xl mb-1">👥</div>
                <div className="text-xs text-gray-400">Группа</div>
                <div className="text-sm font-bold text-secondary mt-0.5">до {service.maxGuests} чел.</div>
              </div>
            )}
            {langs.length > 0 && (
              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <div className="text-xl mb-1">🗣</div>
                <div className="text-xs text-gray-400">Языки</div>
                <div className="text-sm font-bold text-secondary mt-0.5">{langs.join(", ")}</div>
              </div>
            )}
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="text-xl mb-1">📍</div>
              <div className="text-xs text-gray-400">Локация</div>
              <div className="text-sm font-bold text-secondary mt-0.5">{service.city}, {service.country}</div>
            </div>
            {service.provider?.companyName && (
              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <div className="text-xl mb-1">🏢</div>
                <div className="text-xs text-gray-400">Партнёр</div>
                <div className="text-sm font-bold text-secondary mt-0.5">{service.provider.companyName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка: карточка бронирования */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="rounded-3xl border border-gray-100 shadow-xl p-6 md:p-8 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{meta.icon}</span>
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{meta.label}</span>
              {service.isHot && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">🔥 Горящий</span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-secondary leading-tight mb-3">
              {service.title}
            </h1>
            <p className="text-sm text-gray-500 mb-4">
              📍 {service.city}, {service.country}
            </p>

            <div className="flex items-center gap-2 mb-6">
              <StarRow rating={service.rating} />
              <span className="text-sm font-bold text-secondary">{service.rating.toFixed(1)}</span>
              <span className="text-sm text-gray-400">({service.reviewCount} отзывов)</span>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-end justify-between mb-5">
                <div>
                  {service.discountPrice && (
                    <div className="text-sm text-gray-400 line-through mb-0.5">
                      {formatPrice(service.price, service.currency)}
                    </div>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-primary">
                      {formatPrice(finalPrice, service.currency)}
                    </span>
                    <span className="text-sm text-gray-400">{meta.per}</span>
                  </div>
                </div>
                {service.discountPrice && (
                  <span className="bg-red-50 text-red-500 text-xs font-bold px-2.5 py-1 rounded-full">
                    −{discountPct}%
                  </span>
                )}
              </div>

              <a
                href={`mailto:info@travelhub.az?subject=${encodeURIComponent(`Бронирование: ${service.title}`)}`}
                className="block w-full py-3.5 rounded-2xl bg-primary hover:bg-primary-dark text-white text-center font-bold transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
              >
                🔒 Забронировать
              </a>
              <p className="text-[11px] text-gray-400 text-center mt-3">
                Безопасная оплата · Мгновенное подтверждение · Гарантия возврата
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Похожие услуги */}
      {similar.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-secondary">Похожие услуги</h2>
              <p className="text-sm text-gray-400 mt-1">Возможно, вам понравится</p>
            </div>
            {catalog && (
              <a href={catalog.path} className="text-sm font-semibold text-primary hover:text-primary-dark">
                Все {catalog.title.toLowerCase()} →
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {similar.map((s) => (
              <ServiceCard key={s.id} s={s as unknown as ServiceCardData} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
