import { prisma } from "@/lib/prisma";
import ServiceCard, { ServiceCardData } from "@/components/ServiceCard";
import CatalogFilters from "@/components/CatalogFilters";
import { SERVICE_SELECT, CatalogConfig, SORT_LABELS, orderByFor, SortKey, toArr } from "@/lib/catalog";

const SORT_KEYS: SortKey[] = ["popular", "cheap", "expensive", "rating"];

export interface CatalogSearchParams {
  sort?: string | string[];
  country?: string | string[];
  city?: string | string[];
  language?: string | string[];
  minPrice?: string | string[];
  maxPrice?: string | string[];
  minRating?: string | string[];
  hot?: string | string[];
  hotTour?: string | string[];
  [key: string]: string | string[] | undefined;
}

interface Props {
  config: CatalogConfig;
  searchParams: Promise<CatalogSearchParams>;
}

/** Число из searchParams; undefined для NaN/отрицательных значений. */
function numParam(v: string | string[] | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function CatalogPage({ config, searchParams }: Props) {
  const sp = await searchParams;
  const sort = typeof sp.sort === "string" ? sp.sort : undefined;
  const orderBy = orderByFor(sort);

  const countries = toArr(sp.country);
  const cities = toArr(sp.city);
  const languages = toArr(sp.language);
  const minPrice = numParam(sp.minPrice);
  const maxPrice = numParam(sp.maxPrice);
  const minRating = numParam(sp.minRating);
  const hot = sp.hot === "1" || toArr(sp.hotTour).includes("hot");

  // Общий OR-массив: страны/города/языки фильтруются одновременно.
  // Страна в URL приходит кодом (country=TR), но в БД поле country хранит
  // русское имя («Турция»), а код — в countryCode. Поэтому матчим по обоим.
  const orFilters: object[] = [];
  if (countries.length) {
    orFilters.push({
      OR: [{ countryCode: { in: countries } }, { country: { in: countries } }],
    });
  }
  cities.forEach((c) => orFilters.push({ city: { contains: c } }));
  languages.forEach((l) => orFilters.push({ languages: { contains: l } }));

  const priceFilter =
    minPrice !== undefined || maxPrice !== undefined
      ? { price: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {};

  const where = {
    isActive: true,
    type: config.type as never,
    ...priceFilter,
    ...(minRating !== undefined ? { rating: { gte: minRating } } : {}),
    ...(hot ? { isHot: true } : {}),
    ...(orFilters.length ? { OR: orFilters } : {}),
  };

  const [services, total, geoRows] = await Promise.all([
    prisma.service.findMany({
      where,
      select: SERVICE_SELECT,
      orderBy,
      take: 48,
    }),
    prisma.service.count({ where }),
    prisma.service.groupBy({
      by: ["country", "city"],
      where: { type: config.type as never, isActive: true },
      _count: { id: true },
    }),
  ]);

  // Уникальные страны и города для фильтров (сортировка по количеству услуг)
  const countryCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  for (const row of geoRows) {
    if (row.country) countryCounts.set(row.country, (countryCounts.get(row.country) || 0) + row._count.id);
    if (row.city) cityCounts.set(row.city, (cityCounts.get(row.city) || 0) + row._count.id);
  }


  const buildSortHref = (key: SortKey) => {
    const p = new URLSearchParams();
    countries.forEach((c) => p.append("country", c));
    cities.forEach((c) => p.append("city", c));
    languages.forEach((l) => p.append("language", l));
    if (typeof sp.minPrice === "string") p.set("minPrice", sp.minPrice);
    if (typeof sp.maxPrice === "string") p.set("maxPrice", sp.maxPrice);
    if (typeof sp.minRating === "string") p.set("minRating", sp.minRating);
    if (hot) p.set("hot", "1");
    if (key !== "popular") p.set("sort", key);
    return `${config.path}${p.toString() ? `?${p.toString()}` : ""}`;
  };

  return (
    <main className="min-h-[60vh]">
      {/* Шапка каталога */}
      <section className={`bg-gradient-to-br ${config.gradient} text-white`}>
        <div className="max-w-7xl mx-auto px-4 py-14">
          <nav className="flex items-center gap-1.5 text-xs text-white/60 mb-4">
            <a href="/" className="hover:text-white transition-colors">Главная</a>
            <span>→</span>
            <span className="text-white/90">{config.title}</span>
          </nav>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center text-4xl shadow-lg shrink-0">
              {config.icon}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">{config.title}</h1>
              <p className="text-white/80 mt-1.5 max-w-xl">{config.subtitle}</p>
            </div>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-1.5 text-sm font-medium">
            Найдено: {total} {config.title.toLowerCase()}
          </div>
        </div>
      </section>

      {/* Содержимое: фильтры + сетка */}
      <div className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-[300px_1fr] gap-8 items-start">
        <CatalogFilters
          type={config.type}
          filterCategory={config.filterCategory}
          path={config.path}
          sort={sort}
        />

        <div>
          {/* Сортировка */}
          <div className="flex items-center gap-2 flex-wrap mb-6">
            <span className="text-xs text-gray-400 font-medium mr-1">Сортировка:</span>
            {SORT_KEYS.map((key) => {
              const active = (sort || "popular") === key;
              return (
                <a
                  key={key}
                  href={buildSortHref(key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? "bg-secondary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {SORT_LABELS[key]}
                </a>
              );
            })}
          </div>

          {/* Сетка услуг */}
          {services.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {services.map((s) => (
                <ServiceCard key={s.id} s={s as unknown as ServiceCardData} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 py-20 text-center">
              <div className="text-4xl mb-3">{config.icon}</div>
              <p className="text-sm font-medium text-gray-600">Ничего не найдено</p>
              <p className="text-xs text-gray-400 mt-1">Попробуйте изменить фильтры</p>
              <a
                href={config.path}
                className="inline-block mt-4 px-5 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors leading-10"
              >
                Сбросить фильтры
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
