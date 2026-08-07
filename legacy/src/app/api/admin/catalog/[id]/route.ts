import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, CATALOG_ROLES } from "@/lib/admin-access";
import { serverErrorResponse } from "@/lib/server-error";
import { SERVICE_STATUS_LABELS } from "@/lib/admin-data";
import { recordAudit, requestContext } from "@/lib/audit";

/**
 * Карточка услуги Catalog Center (Гл. 4.4–4.10):
 *
 * GET /api/admin/catalog/[id] — полная карточка: основная информация, цены,
 *   доступность/квоты, контент/медиа, связанные услуги, история версий (4.12)
 *   и AI-анализ карточки (4.13).
 * PATCH /api/admin/catalog/[id] — обновление полей и/или смена статуса
 *   жизненного цикла. Каждое изменение фиксируется в ServiceHistory (4.12).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, CATALOG_ROLES);
    if (denied) return denied;

    const { id } = await params;
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        provider: { select: { id: true, companyName: true, email: true } },
        history: { orderBy: { createdAt: "desc" }, take: 50 },
        _count: { select: { bookings: true, reviews: true } },
      },
    });
    if (!service) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    // Object scope (RBAC Matrix §3): PARTNER видит только свои продукты.
    if (user.role === "PARTNER" && service.providerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: доступ только к своим продуктам" }, { status: 403 });
    }

    // Связанные услуги (Гл. 4.9): названия по id из relatedIds.
    let related: { id: string; code: string; title: string; type: string; price: number; currency: string; status: string }[] = [];
    let relatedIds: string[] = [];
    try {
      relatedIds = service.relatedIds ? (JSON.parse(service.relatedIds) as string[]) : [];
    } catch {
      relatedIds = [];
    }
    if (relatedIds.length) {
      const rows = await prisma.service.findMany({
        where: { id: { in: relatedIds } },
        select: { id: true, code: true, title: true, type: true, price: true, currency: true, status: true },
      });
      related = rows;
    }

    const images = safeArr(service.images);
    const tags = safeArr(service.tags);
    const channels = safeArr(service.channels);

    const detail = {
      id: service.id,
      code: service.code,
      type: service.type,
      title: service.title,
      slug: service.slug,
      description: service.description,
      shortDesc: service.shortDesc,
      price: service.price,
      currency: service.currency,
      discountPrice: service.discountPrice,
      city: service.city,
      country: service.country,
      countryCode: service.countryCode,
      duration: service.duration,
      maxGuests: service.maxGuests,
      languages: service.languages,
      rating: service.rating,
      reviewCount: service.reviewCount,
      images,
      isFeatured: service.isFeatured,
      isHot: service.isHot,
      hotDiscount: service.hotDiscount,
      status: service.status,
      statusLabel: SERVICE_STATUS_LABELS[service.status] ?? service.status,
      version: service.version,
      category: service.category,
      tags,
      manager: service.manager
        ? { id: service.manager.id, name: `${service.manager.firstName} ${service.manager.lastName ?? ""}`.trim() }
        : null,
      provider: service.provider
        ? { id: service.provider.id, name: service.provider.companyName ?? service.provider.email }
        : null,
      salesStart: service.salesStart,
      salesEnd: service.salesEnd,
      serviceStart: service.serviceStart,
      serviceEnd: service.serviceEnd,
      quota: {
        total: service.quotaTotal ?? 0,
        booked: service.quotaBooked ?? 0,
        reserved: service.quotaReserved ?? 0,
        available: (service.quotaTotal ?? 0) - (service.quotaBooked ?? 0) - (service.quotaReserved ?? 0),
      },
      seo: {
        title: service.seoTitle,
        description: service.seoDescription,
        keywords: service.seoKeywords,
      },
      channels,
      publishedAt: service.publishedAt,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      isActive: service.isActive,
      bookingsCount: service._count.bookings,
      reviewsCount: service._count.reviews,
      related,
      relatedIds,
      history: service.history.map((h) => ({
        id: h.id,
        version: h.version,
        action: h.action,
        from: h.from,
        to: h.to,
        fields: h.fields ? safeObj(h.fields) : null,
        actorName: h.actorName,
        comment: h.comment,
        createdAt: h.createdAt,
      })),
      // AI-анализ карточки (Гл. 4.13): готовность, рекомендации, цена vs категория
      ai: await buildServiceAi(service, related, service._count.bookings),
    };

    return NextResponse.json({ service: detail });
  } catch (error) {
    return serverErrorResponse(error, "Admin catalog detail error");
  }
}

/** PATCH /api/admin/catalog/[id] — обновление карточки и/или статуса. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(user, CATALOG_ROLES);
    if (denied) return denied;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    // Object scope (RBAC Matrix §3): PARTNER работает только со своими продуктами
    // в статусе черновика/согласования и НЕ публикует напрямую (Baseline §14):
    // публикация — прерогатива MODERATOR/ADMIN после модерации.
    const action = typeof body.action === "string" ? body.action : "";
    if (user.role === "PARTNER") {
      if (existing.providerId !== user.id) {
        return NextResponse.json({ error: "Forbidden: доступ только к своим продуктам" }, { status: 403 });
      }
      if (["publish", "unpublish", "suspend", "archive", "restore"].includes(action)) {
        return NextResponse.json(
          { error: "Forbidden: публикация выполняется после модерации (MODERATOR/ADMIN)" },
          { status: 403 }
        );
      }
      if (!["DRAFT", "REVIEW", "READY"].includes(existing.status)) {
        return NextResponse.json({ error: "Недоступно: продукт не в статусе черновика" }, { status: 403 });
      }
    }

    // Поля карточки (Гл. 4.5–4.8): обновляются только переданные значения.
    const data: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const str = (v: unknown, key: string) => {
      if (v !== undefined) {
        data[key] = typeof v === "string" ? v : null;
        if (data[key] !== (existing as unknown as Record<string, unknown>)[key]) changedFields.push(key);
      }
    };
    const num = (v: unknown, key: string) => {
      if (v !== undefined) {
        data[key] = typeof v === "number" ? v : null;
        if (data[key] !== (existing as unknown as Record<string, unknown>)[key]) changedFields.push(key);
      }
    };
    const bool = (v: unknown, key: string) => {
      if (v !== undefined) {
        data[key] = Boolean(v);
        changedFields.push(key);
      }
    };

    str(body.title, "title");
    str(body.shortDesc, "shortDesc");
    str(body.description, "description");
    str(body.city, "city");
    str(body.country, "country");
    str(body.countryCode, "countryCode");
    str(body.duration, "duration");
    str(body.languages, "languages");
    str(body.category, "category");
    // Валюта — обязательное поле (NOT NULL): обновляем только корректным значением
    if (body.currency !== undefined) {
      if (typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency)) {
        data.currency = body.currency;
        changedFields.push("currency");
      } else if (body.currency !== null && body.currency !== "") {
        return NextResponse.json({ error: "Некорректная валюта" }, { status: 400 });
      }
    }
    str(body.seoTitle, "seoTitle");
    str(body.seoDescription, "seoDescription");
    str(body.seoKeywords, "seoKeywords");
    num(body.price, "price");
    num(body.discountPrice, "discountPrice");
    num(body.maxGuests, "maxGuests");
    bool(body.isFeatured, "isFeatured");
    bool(body.isHot, "isHot");
    if (body.tags !== undefined) {
      const arr = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === "string") : [];
      data.tags = JSON.stringify(arr);
      changedFields.push("tags");
    }
    if (body.managerId !== undefined) {
      data.managerId = typeof body.managerId === "string" && body.managerId ? body.managerId : null;
      changedFields.push("managerId");
    }
    // Квоты и периоды (Гл. 4.7)
    const quotaNum = (v: unknown, key: string) => {
      if (v !== undefined) {
        data[key] = typeof v === "number" && v >= 0 ? Math.floor(v) : 0;
        changedFields.push(key);
      }
    };
    quotaNum(body.quotaTotal, "quotaTotal");
    quotaNum(body.quotaBooked, "quotaBooked");
    quotaNum(body.quotaReserved, "quotaReserved");
    const dateField = (v: unknown, key: string) => {
      if (v !== undefined) {
        data[key] = typeof v === "string" && v ? new Date(v) : null;
        changedFields.push(key);
      }
    };
    dateField(body.salesStart, "salesStart");
    dateField(body.salesEnd, "salesEnd");
    dateField(body.serviceStart, "serviceStart");
    dateField(body.serviceEnd, "serviceEnd");
    if (body.channels !== undefined) {
      const arr = Array.isArray(body.channels) ? body.channels.filter((c) => typeof c === "string") : [];
      data.channels = JSON.stringify(arr);
      changedFields.push("channels");
    }
    if (body.relatedIds !== undefined) {
      const arr = Array.isArray(body.relatedIds) ? body.relatedIds.filter((x) => typeof x === "string") : [];
      data.relatedIds = JSON.stringify(arr);
      changedFields.push("relatedIds");
    }

    // Смена статуса жизненного цикла (Гл. 4.12): отдельное поле action.
    // (action уже прочитан выше для проверки прав PARTNER)
    const VALID_STATUS = ["DRAFT", "REVIEW", "READY", "PUBLISHED", "SUSPENDED", "ARCHIVED"];
    let newStatus: string | null = null;
    let actionComment = "";
    if (action === "publish" && existing.status !== "PUBLISHED") {
      newStatus = "PUBLISHED";
      actionComment = "Опубликована, доступна для продажи";
    } else if (action === "unpublish" && existing.status === "PUBLISHED") {
      newStatus = "READY";
      actionComment = "Снята с публикации";
    } else if (action === "suspend" && existing.status === "PUBLISHED") {
      newStatus = "SUSPENDED";
      actionComment = "Продажи приостановлены";
    } else if (action === "archive" && existing.status !== "ARCHIVED") {
      newStatus = "ARCHIVED";
      actionComment = "Услуга архивирована";
    } else if (action === "restore" && existing.status === "ARCHIVED") {
      newStatus = "PUBLISHED";
      actionComment = "Восстановлена из архива";
    } else if (action === "review") {
      newStatus = "REVIEW";
      actionComment = "Отправлено на согласование";
    } else if (action === "ready") {
      newStatus = "READY";
      actionComment = "Готова к публикации";
    } else if (action === "draft") {
      newStatus = "DRAFT";
      actionComment = "Возвращено в черновик";
    }
    if (newStatus && VALID_STATUS.includes(newStatus)) {
      data.status = newStatus;
      data.isActive = newStatus === "PUBLISHED" || newStatus === "SUSPENDED";
      if (newStatus === "PUBLISHED" && !existing.publishedAt) data.publishedAt = new Date();
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    const actorName = `${user.firstName} ${user.lastName ?? ""}`.trim() || "Администратор";
    const updated = await prisma.$transaction(async (tx) => {
      const nextVersion = existing.version + 1;
      const svc = await tx.service.update({
        where: { id },
        data: { ...data, version: nextVersion },
        select: { id: true, code: true, title: true, status: true, version: true, updatedAt: true },
      });
      // Действие журнала (Гл. 4.12): восстановление из архива — «restore»,
      // остальные переходы статусов — publish/archive/suspend/update.
      const historyAction = action === "restore"
        ? "restore"
        : newStatus
          ? newStatus === "PUBLISHED"
            ? "publish"
            : newStatus === "ARCHIVED"
              ? "archive"
              : newStatus === "SUSPENDED"
                ? "suspend"
                : "update"
          : body.price !== undefined && Object.keys(data).every((k) => k === "price" || k === "discountPrice")
            ? "price"
            : "update";
      await tx.serviceHistory.create({
        data: {
          serviceId: id,
          version: nextVersion,
          action: historyAction,
          from: existing.status,
          to: newStatus ?? existing.status,
          fields: changedFields.length ? JSON.stringify(changedFields) : null,
          actorId: user.id,
          actorName,
          comment: newStatus ? actionComment : changedFields.length ? `Изменено: ${changedFields.join(", ")}` : "Обновление карточки",
        },
      });
      return svc;
    });

    // Гл. 3.18: изменение карточки и/или статуса жизненного цикла фиксируется
    // в журнале аудита. Статусный переход — action «status», только стоимость —
    // «price», прочие правки полей — «update».
    const ctx = requestContext(request);
    const onlyPrice =
      !newStatus && body.price !== undefined && Object.keys(data).every((k) => k === "price" || k === "discountPrice");
    const auditAction = newStatus ? "status" : onlyPrice ? "price" : "update";
    await recordAudit({
      user,
      category: "Пользовательские действия",
      action: auditAction,
      objectType: "Услуга",
      objectId: id,
      objectNumber: existing.code,
      fromData: newStatus ? { status: existing.status } : null,
      toData: newStatus
        ? { status: newStatus }
        : changedFields.length
          ? { fields: changedFields }
          : null,
      comment: newStatus ? actionComment : `Изменено: ${changedFields.join(", ")}`,
      source: "Web",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      criticality: newStatus === "ARCHIVED" || newStatus === "SUSPENDED" ? "warning" : "info",
    });

    return NextResponse.json({ service: updated, changedFields });
  } catch (error) {
    return serverErrorResponse(error, "Admin catalog update error");
  }
}

/** Парсинг JSON-массива. */
function safeArr(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Парсинг JSON-объекта. */
function safeObj(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * AI-анализ карточки (Гл. 4.13): оценка готовности, рекомендации по заполнению,
 * анализ стоимости относительно категории, оценка публикации.
 */
function buildServiceAi(
  svc: Awaited<ReturnType<typeof prisma.service.findUnique>>,
  related: { id: string; code: string; title: string; type: string; price: number; currency: string; status: string }[],
  bookingsCount: number
): Promise<{
  readiness: number;
  missing: string[];
  recommendations: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[];
  priceInsight: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string } | null;
  forecast: { attractiveness: number; sellProbability: number; competitiveness: string };
  checks: { ok: boolean; label: string }[];
}> {
  return (async () => {
    if (!svc) {
      return { readiness: 0, missing: [], recommendations: [], priceInsight: null, forecast: { attractiveness: 0, sellProbability: 0, competitiveness: "—" }, checks: [] };
    }
  const checks: { ok: boolean; label: string }[] = [
    { ok: !!svc.shortDesc && svc.shortDesc.length > 20, label: "Краткое описание" },
    { ok: !!svc.description && svc.description.length > 80, label: "Подробное описание" },
    { ok: safeArr(svc.images).length > 0, label: "Фотографии" },
    { ok: svc.price > 0, label: "Базовая стоимость" },
    { ok: !!svc.country && !!svc.city, label: "Направление (страна/город)" },
    { ok: !!svc.providerId, label: "Поставщик" },
    { ok: !!svc.duration, label: "Продолжительность" },
    { ok: !!svc.category, label: "Категория" },
    { ok: !!svc.seoTitle && !!svc.seoDescription, label: "SEO-параметры" },
    { ok: !!svc.salesStart && !!svc.salesEnd, label: "Период продажи" },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const readiness = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  // Рекомендации с причиной (Гл. 4.13 «Генерация рекомендаций»)
  const recommendations: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string }[] = [];
  if (missing.length) {
    recommendations.push({
      level: "high",
      title: "Не заполнены обязательные разделы",
      detail: missing.join(", "),
    });
  }
  if (!svc.images || safeArr(svc.images).length < 3) {
    recommendations.push({
      level: "medium",
      title: "Добавьте фотографии высокого разрешения",
      detail: "В галерее менее 3 изображений — карточка выглядит менее привлекательно",
    });
  }
  if (svc.description && svc.description.length < 120) {
    recommendations.push({
      level: "medium",
      title: "Расширьте описание услуги",
      detail: "Подробное описание короче 120 символов — добавьте программу и преимущества",
    });
  }
  if (svc.updatedAt && Date.now() - new Date(svc.updatedAt).getTime() > 90 * 86400000) {
    recommendations.push({
      level: "medium",
      title: "Продукт давно не обновлялся",
      detail: "С момента последнего изменения прошло более 90 дней",
    });
  }
  if (!related.length) {
    recommendations.push({
      level: "info",
      title: "Добавьте связанные услуги",
      detail: "Связанные услуги повышают средний чек и упрощают допродажи",
    });
  }

  // Анализ стоимости (Гл. 4.13): сравнение со средней по категории
  let priceInsight: { level: "positive" | "medium" | "high" | "info"; title: string; detail: string } | null = null;
  if (svc.price > 0) {
    const peers = await prisma.service.aggregate({
      where: { type: svc.type, status: "PUBLISHED", price: { gt: 0 } },
      _avg: { price: true },
    });
    const avg = peers._avg.price ?? svc.price;
    const diff = ((svc.price - avg) / avg) * 100;
    if (Math.abs(diff) > 15) {
      priceInsight = {
        level: diff > 0 ? "high" : "positive",
        title: diff > 0 ? `Стоимость выше средней по категории на ${Math.abs(diff).toFixed(0)}%` : `Стоимость ниже средней по категории на ${Math.abs(diff).toFixed(0)}%`,
        detail: `Средняя стоимость по категории ${Math.round(avg)} ${svc.currency || "USD"} — проверьте тариф`,
      };
    } else {
      priceInsight = {
        level: "positive",
        title: "Стоимость в пределах рыночного диапазона",
        detail: `Отклонение от средней по категории ${Math.abs(diff).toFixed(0)}%`,
      };
    }
  }

  // Прогноз эффективности (Гл. 4.13): на основе готовности и продаж
  const attractiveness = Math.min(100, readiness + (bookingsCount > 0 ? 10 : 0) + (svc.rating > 4.2 ? 8 : 0));
  const forecast = {
    attractiveness,
    sellProbability: Math.min(95, Math.max(20, Math.round(attractiveness * 0.85))),
    competitiveness: avgNote(priceInsight?.level),
  };

  return {
    readiness,
    missing,
    recommendations,
    priceInsight,
    forecast,
    checks,
  };
  })();
}

/** Оценка конкурентоспособности для прогноза. */
function avgNote(level: string | undefined): string {
  if (level === "positive") return "Выше средней";
  if (level === "high") return "Ниже средней";
  return "Средняя";
}
