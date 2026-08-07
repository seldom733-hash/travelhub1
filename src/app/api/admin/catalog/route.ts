import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, CATALOG_ROLES } from "@/lib/admin-access";
import { serverErrorResponse } from "@/lib/server-error";
import { SERVICE_STATUS_LABELS, SERVICE_TYPE_LABELS } from "@/lib/admin-data";
import { ruPlural } from "@/lib/admin-data";
import { recordAudit, requestContext } from "@/lib/audit";
import { nextBusinessCode } from "@/lib/ids";

/**
 * Catalog Center (Гл. 4): единый реестр услуг платформы.
 *
 * GET /api/admin/catalog — список с фильтрами и KPI-панелью:
 *   search, type, status, category, country, city, providerId, managerId,
 *   priceMin, priceMax, availability (1 = только с квотой), sort, page, limit
 * POST /api/admin/catalog — создание новой карточки услуги (Гл. 4.5).
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, CATALOG_ROLES);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category")?.trim() || "";
    const country = searchParams.get("country")?.trim() || "";
    const city = searchParams.get("city")?.trim() || "";
    const providerId = searchParams.get("providerId") || "";
    const managerId = searchParams.get("managerId") || "";
    const priceMin = searchParams.get("priceMin") ? Number(searchParams.get("priceMin")) : null;
    const priceMax = searchParams.get("priceMax") ? Number(searchParams.get("priceMax")) : null;
    const onlyQuota = searchParams.get("availability") === "1";
    const sort = searchParams.get("sort") || "updated";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));

    const where: Record<string, unknown> = {};
    // Object scope (RBAC Matrix §3): PARTNER видит только свои продукты.
    if (user.role === "PARTNER") where.providerId = user.id;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { code: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
        { city: { contains: search } },
        { country: { contains: search } },
        { category: { contains: search } },
      ];
    }
    if (type) where.type = type;
    if (status) where.status = status;
    if (category) where.category = { contains: category };
    if (country) where.country = { contains: country };
    if (city) where.city = { contains: city };
    if (providerId) where.providerId = providerId;
    if (managerId) where.managerId = managerId;
    if (priceMin !== null) where.price = { gte: priceMin, ...(where.price as object) };
    if (priceMax !== null) where.price = { lte: priceMax, ...(where.price as object) };
    // «С ограниченной квотой» (Гл. 4.7): услуги с заданной вместимостью.
    if (onlyQuota) {
      where.status = where.status ?? "PUBLISHED";
      where.quotaTotal = { gt: 0 };
    }

    const orderBy: Record<string, "asc" | "desc"> =
      sort === "title"
        ? { title: "asc" }
        : sort === "price"
          ? { price: "asc" }
          : sort === "price_desc"
            ? { price: "desc" }
            : sort === "created"
              ? { createdAt: "desc" }
              : sort === "rating"
                ? { rating: "desc" }
                : { updatedAt: "desc" };

    const [total, services, statusCounts, typeCounts, providers, managers, countries] = await Promise.all([
      prisma.service.count({ where }),
      prisma.service.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          code: true,
          type: true,
          title: true,
          slug: true,
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
          status: true,
          version: true,
          category: true,
          quotaTotal: true,
          quotaBooked: true,
          quotaReserved: true,
          salesStart: true,
          salesEnd: true,
          serviceStart: true,
          serviceEnd: true,
          publishedAt: true,
          updatedAt: true,
          createdAt: true,
          isActive: true,
          manager: { select: { id: true, firstName: true, lastName: true } },
          provider: { select: { id: true, companyName: true } },
          _count: { select: { bookings: true, reviews: true } },
        },
      }),
      prisma.service.groupBy({ by: ["status"], _count: true }),
      prisma.service.groupBy({ by: ["type"], _count: true }),
      prisma.user.findMany({
        where: { role: "PARTNER", isActive: true },
        orderBy: { companyName: "asc" },
        select: { id: true, companyName: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SALES_MANAGER", "MODERATOR", "DIRECTOR", "OPERATOR"] }, isActive: true },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.service.findMany({ where: { country: { not: null } }, distinct: ["country"], select: { country: true } }),
    ]);

    // ── KPI-панель каталога (Гл. 4.2/4.3) ──
    const counts: Record<string, number> = {};
    for (const s of statusCounts) counts[s.status] = s._count;
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const newCount = await prisma.service.count({ where: { createdAt: { gte: weekAgo } } });
    // Требуют обновления: опубликованы, но не обновлялись 90+ дней
    const staleDate = new Date(Date.now() - 90 * 86400000);
    const needUpdateCount = await prisma.service.count({
      where: { status: { in: ["PUBLISHED", "SUSPENDED"] }, updatedAt: { lt: staleDate } },
    });
    const totalCount = total;
    const kpi = {
      total: { value: totalCount, detail: `${ruPlural(totalCount, "услуга", "услуги", "услуг")} в каталоге` },
      published: { value: counts["PUBLISHED"] ?? 0, detail: "Опубликованы и доступны" },
      drafts: { value: counts["DRAFT"] ?? 0, detail: "В подготовке" },
      review: { value: counts["REVIEW"] ?? 0, detail: "На согласовании" },
      ready: { value: counts["READY"] ?? 0, detail: "Ожидают публикации" },
      suspended: { value: counts["SUSPENDED"] ?? 0, detail: "Продажи приостановлены" },
      archived: { value: counts["ARCHIVED"] ?? 0, detail: "В архиве" },
      new: { value: newCount, detail: "За последние 7 дней" },
      needUpdate: { value: needUpdateCount, detail: "Не обновлялись 90+ дней" },
    };

    const typeBreakdown = typeCounts.map((t) => ({
      type: t.type,
      label: SERVICE_TYPE_LABELS[t.type] ?? t.type,
      count: t._count,
    }));

    const list = services.map((s) => ({
      ...s,
      images: safeJson(s.images),
      managerName: s.manager ? `${s.manager.firstName} ${s.manager.lastName ?? ""}`.trim() : null,
      providerName: s.provider?.companyName ?? null,
      statusLabel: SERVICE_STATUS_LABELS[s.status] ?? s.status,
      bookingsCount: s._count.bookings,
    }));

    return NextResponse.json({
      kpi,
      services: list,
      typeBreakdown,
      filters: {
        providers: providers.map((p) => ({ id: p.id, name: p.companyName ?? p.id })),
        managers: managers.map((m) => ({
          id: m.id,
          name: `${m.firstName} ${m.lastName ?? ""}`.trim(),
        })),
        countries: countries.map((c) => c.country).filter(Boolean).sort((a, b) => (a as string).localeCompare(b as string)),
        statuses: Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      },
      pagination: { page, limit, total: totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)) },
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin catalog API error");
  }
}

/** POST /api/admin/catalog — создание новой услуги (Гл. 4.5 «Основные сведения»). */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, CATALOG_ROLES);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const type = typeof body.type === "string" ? body.type : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const price = typeof body.price === "number" && body.price >= 0 ? body.price : null;
    if (!type || !title || price === null) {
      return NextResponse.json({ error: "Укажите тип, наименование и стоимость услуги" }, { status: 400 });
    }
    const VALID_TYPES = ["TOUR", "HOTEL", "SANATORIUM", "FLIGHT", "TRAIN", "EXCURSION", "GUIDE", "TRANSFER", "PHOTOGRAPHER"];
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Некорректный тип услуги" }, { status: 400 });
    }

    // Код услуги = канонический PRD-* (Baseline §0.8): максимальный + 1.
    const rows = await prisma.service.findMany({ select: { code: true } });
    const code = nextBusinessCode("PRD", rows.map((r) => r.code));
    // Slug-суффикс — порядковый номер из кода (PRD-00000042 → tour-0042).
    const codeSeq = Number.parseInt(code.split("-")[1] ?? "0", 10);

    const created = await prisma.$transaction(async (tx) => {
      const svc = await tx.service.create({
        data: {
          code,
          type: type as never,
          title,
          slug: `${type.toLowerCase()}-${String(codeSeq).padStart(4, "0")}`,
          price,
          currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
          discountPrice: typeof body.discountPrice === "number" ? body.discountPrice : null,
          shortDesc: typeof body.shortDesc === "string" ? body.shortDesc : null,
          description: typeof body.description === "string" ? body.description : null,
          city: typeof body.city === "string" && body.city ? body.city : null,
          country: typeof body.country === "string" && body.country ? body.country : null,
          countryCode: typeof body.countryCode === "string" && body.countryCode ? body.countryCode : null,
          duration: typeof body.duration === "string" && body.duration ? body.duration : null,
          maxGuests: typeof body.maxGuests === "number" ? body.maxGuests : null,
          languages: typeof body.languages === "string" ? body.languages : null,
          status: "DRAFT",
          version: 1,
          // PARTNER создаёт продукт от своего имени (object scope, RBAC Matrix §3).
          providerId: user.role === "PARTNER" ? user.id : typeof body.providerId === "string" && body.providerId ? body.providerId : null,
          managerId: typeof body.managerId === "string" && body.managerId ? body.managerId : user.id,
          category: typeof body.category === "string" && body.category ? body.category : null,
          quotaTotal: typeof body.quotaTotal === "number" ? body.quotaTotal : null,
          isActive: false,
        },
        select: { id: true, code: true, title: true },
      });
      await tx.serviceHistory.create({
        data: {
          serviceId: svc.id,
          version: 1,
          action: "created",
          from: null,
          to: "DRAFT",
          actorId: user.id,
          actorName: `${user.firstName} ${user.lastName ?? ""}`.trim() || "Администратор",
          comment: "Карточка услуги создана",
        },
      });
      return svc;
    });

    // Гл. 3.18: создание услуги фиксируется в журнале аудита.
    const ctx = requestContext(request);
    await recordAudit({
      user,
      category: "Пользовательские действия",
      action: "create",
      objectType: "Услуга",
      objectId: created.id,
      objectNumber: created.code,
      toData: { type, title, price, currency: typeof body.currency === "string" && body.currency ? body.currency : "USD" },
      comment: `Создана карточка услуги «${created.title}»`,
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      criticality: "info",
    });

    return NextResponse.json({ service: created }, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error, "Admin catalog create error");
  }
}

/** Парсинг JSON-полей с безопасным фолбэком. */
function safeJson(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
