import { prisma } from "@/lib/prisma";
import ServiceCard, { ServiceCardData } from "@/components/ServiceCard";
import { TYPE_META, TYPE_LIST } from "@/lib/service-utils";

export const dynamic = "force-dynamic";

const SELECT = {
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
} as const;

interface SearchParams {
  searchParams: Promise<{ type?: string; q?: string; country?: string; hot?: string }>;
}

export default async function SearchPage({ searchParams }: SearchParams) {
  const sp = await searchParams;
  const type = sp.type && TYPE_LIST.includes(sp.type) ? (sp.type as never) : undefined;
  const q = sp.q?.trim();
  const country = sp.country?.trim();
  const hot = sp.hot === "1";

  // Один общий OR-массив — при одновременных country и q оба фильтра применяются
  const orFilters: object[] = [];
  if (country) {
    orFilters.push({ country: { contains: country } }, { city: { contains: country } });
  }
  if (q) {
    orFilters.push({ title: { contains: q } }, { country: { contains: q } }, { city: { contains: q } });
  }

  const where = {
    isActive: true,
    ...(type ? { type } : {}),
    ...(hot ? { isHot: true } : {}),
    ...(orFilters.length ? { OR: orFilters } : {}),
  };

  const services = await prisma.service.findMany({
    where,
    select: SELECT,
    orderBy: { reviewCount: "desc" },
    take: 48,
  });

  const title = type
    ? `Найдено: ${TYPE_META[sp.type as string]?.label ?? "услуги"}`
    : hot
      ? "Горящие туры"
      : "Результаты поиска";

  return (
    <main className="min-h-[60vh] max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-secondary">{title}</h1>
        <p className="text-gray-400 mt-1">
          {q ? `По запросу «${q}» ` : ""}
          {country ? ` · страна «${country}»` : ""}— найдено услуг: {services.length}
        </p>
      </div>

      {services.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {services.map((s) => (
            <ServiceCard key={s.id} s={s as unknown as ServiceCardData} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 py-20 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-medium text-gray-600">Ничего не найдено</p>
          <p className="text-xs text-gray-400 mt-1">Попробуйте изменить запрос или категорию</p>
          <a href="/" className="inline-block mt-4 px-5 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors leading-10">
            На главную
          </a>
        </div>
      )}
    </main>
  );
}
