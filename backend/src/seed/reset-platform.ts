/**
 * ПОЛНОЕ ОБНУЛЕНИЕ ПЛАТФОРМЫ (dev) — строки бизнес-данных удаляются, САМИ
 * таблицы остаются (schema/migrations не трогаем).
 *
 * ОСТАЁТСЯ НЕПУСТЫМ:
 *  - public._prisma_migrations     — состояние миграций;
 *  - security.User                 — ТОЛЬКО один пользователь `admin`
 *                                    (его роль/права остаются рабочими);
 *  - security.Permission/Role/RolePermission — RBAC-каталог (иначе admin
 *                                    теряет права и платформа не работает);
 *  - geo.* (страны/города/аэропорты/курорты) — гео-справочник;
 *  - catalog-словари (категории, типы номеров/питания/виды) — словари;
 *  - events.BusinessSequence       — счётчики кодов, значения сбрасываются
 *                                    (новые сущности начнут с 00000001).
 *
 * УДАЛЯЕТСЯ: поставщики и партнёры, их товары/тарифы, клиенты, их оплаты,
 * заявки, заказы, брони, переписка, аналитика, audit-лог, WhatsApp,
 * конструктор витрин, inbox/outbox-события, все пользователи кроме admin.
 *
 * СБРОС СЧЁТЧИКОВ: value → 0, кроме USR → 1 (admin занимает USR-00000001 —
 * иначе следующий пользователь получил бы коллизию по unique code).
 *
 * Запуск: npm run reset:platform   (идемпотентен: повторный запуск — no-op)
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Админ — единственный пользователь, которого не удаляем. */
const KEEP_USER = "admin";

/** Таблицы, которые НИКОГДА не обнуляются (сверяются до/после). */
const KEEP_TABLES = [
  ["public", "_prisma_migrations"],
  ["security", "Permission"],
  ["security", "Role"],
  ["security", "RolePermission"],
  ["geo", "GeoCountry"],
  ["geo", "GeoCity"],
  ["geo", "GeoAirport"],
  ["geo", "GeoResort"],
  ["catalog", "Category"],
  ["catalog", "CategorySchema"],
  ["catalog", "MealType"],
  ["catalog", "RoomType"],
  ["catalog", "RoomView"],
  ["catalog", "ViewType"],
  ["catalog", "HotelCategory"],
  ["catalog", "PlacementType"],
] as const;

/** Бизнес-данные: эти таблицы обнуляются. */
const TRUNCATE_TABLES = [
  "booking.Booking", "booking.BookingHistory", "booking.Passenger",
  "catalog.Availability", "catalog.CommercialPeriod", "catalog.MarketplaceBehavioralEvent",
  "catalog.ModerationSubmission", "catalog.Product", "catalog.ProductHistory",
  "catalog.ProductPublicationChannel", "catalog.PublicSellerProfile",
  "catalog.ServiceUnit", "catalog.StorefrontSubscriptionPlan", "catalog.Tariff",
  "communication.Communication",
  "constructor.ConstructorPage", "constructor.ConstructorPageAuditLog",
  "constructor.ConstructorPageSection", "constructor.ConstructorPageVersion",
  "crm.Customer", "crm.CustomerHistory", "crm.Partner", "crm.Supplier",
  "decision.DecisionSignal",
  "events.ExternalIdempotencyRecord", "events.InboxEvent", "events.OutboxEvent",
  "finance.MarkupRule", "finance.MarkupRuleHistory", "finance.Payment",
  "finance.PaymentHistory", "finance.SupplierFxRate", "finance.SupplierFxRateHistory",
  "geo.SupplierGeoLink",
  "order.Fulfillment", "order.Order", "order.OrderHistory", "order.OrderItem",
  "order.OrderTraveler", "order.Request", "order.RequestHistory", "order.RequestTraveler",
  "security.AuditLog", "security.PartnerApplication", "security.PartnerApplicationHistory",
  "security.ActivationToken", "security.UserWorkspaceLayout",
  "whatsapp.WhatsAppAccount", "whatsapp.WhatsAppContact", "whatsapp.WhatsAppConversation",
  "whatsapp.WhatsAppInboundMessage", "whatsapp.WhatsAppOutboundMessage",
  "whatsapp.WhatsAppSessionLease",
];

const keepKey = (s: string, t: string): string => `${s}.${t}`;

async function countRow(schema: string, table: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT count(*)::bigint AS n FROM "${schema}"."${table}"`,
  );
  return Number(r[0].n);
}

async function countSafe(schema: string, table: string): Promise<number> {
  try {
    return await countRow(schema, table);
  } catch {
    return -1;
  }
}

async function main(): Promise<void> {
  // ── 0. Снимок KEEP-таблиц: проверим, что они не пострадали ───────────────
  const before = new Map<string, number>();
  for (const [s, t] of KEEP_TABLES) before.set(keepKey(s, t), await countSafe(s, t));
  const usersBefore = await countRow("security", "User");

  console.log("=== ДО обнуления ===");
  console.log(`  security.User: ${usersBefore}`);
  for (const [k, v] of before) console.log(`  ${k}: ${v}`);

  // ── 1. TRUNCATE (одним оператором — Postgres сам разрулит порядок FK) ─────
  //  CASCADE безопасен: доказано, что НИ ОДНА KEEP-таблица не имеет FK на
  //  обнуляемую (см. проверку FK-графа) — каскад физически не может её тронуть.
  //  Ниже — вторая страховка: явно дописываем любую таблицу, ссылающуюся на
  //  security.User (нужно, чтобы DELETE non-admin прошёл без нарушения FK).
  const userDeps = await prisma.$queryRawUnsafe<{ child_schema: string; child_table: string }[]>(`
    SELECT DISTINCT kcu.table_schema AS child_schema, kcu.table_name AS child_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'security' AND ccu.table_name = 'User'
  `);

  const truncateSet = new Set<string>(TRUNCATE_TABLES);
  for (const d of userDeps) {
    const key = `${d.child_schema}.${d.child_table}`;
    if (KEEP_TABLES.some(([s, t]) => keepKey(s, t) === key)) {
      throw new Error(`SAFE-STOP: KEEP-таблица ${key} ссылается на security.User — ручная проверка`);
    }
    truncateSet.add(key);
  }

  const targets = [...truncateSet]
    .map((f) => {
      const [s, t] = f.split(".");
      return `"${s}"."${t}"`;
    })
    .join(", ");

  console.log(`\n=== TRUNCATE ${truncateSet.size} таблиц ===`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${targets} CASCADE`);

  // ── 2. Пользователи: оставляем ТОЛЬКО admin ──────────────────────────────
  const deletedUsers = await prisma.$executeRawUnsafe(
    `DELETE FROM "security"."User" WHERE "username" <> $1`,
    KEEP_USER,
  );
  console.log(`\n=== Пользователи удалено: ${Number(deletedUsers)} (оставлен ${KEEP_USER}) ===`);

  // ── 3. Счётчики кодов: в 0, кроме USR (admin = USR-00000001) ─────────────
  await prisma.$executeRawUnsafe(`UPDATE "events"."BusinessSequence" SET "value" = 0`);
  await prisma.$executeRawUnsafe(
    `UPDATE "events"."BusinessSequence" SET "value" = 1 WHERE "prefix" = 'USR'`,
  );
  // Мусорные артефакты concurrency-тестов.
  await prisma.$executeRawUnsafe(
    `DELETE FROM "events"."BusinessSequence" WHERE "prefix" LIKE 'REFSEQ:%'`,
  );

  // ── 4. Верификация: KEEP не тронут + бизнес пуст ─────────────────────────
  console.log("\n=== ПРОВЕРКА ===");
  let failed = false;
  for (const [k, v] of before) {
    const [s, t] = k.split(".");
    const now = await countSafe(s, t);
    const ok = now === v;
    if (!ok) failed = true;
    console.log(`  ${ok ? "OK  " : "FAIL"} ${k}: ${now} (было ${v})`);
  }

  const usersAfter = await countRow("security", "User");
  const adminRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM "security"."User" WHERE "username" = '${KEEP_USER}'`,
  );
  const usersOk = usersAfter === 1 && Number(adminRows[0].n) === 1;
  if (!usersOk) failed = true;
  console.log(`  ${usersOk ? "OK  " : "FAIL"} security.User: ${usersAfter} (admin=${Number(adminRows[0].n)})`);

  const empties: string[] = [];
  for (const f of truncateSet) {
    const [s, t] = f.split(".");
    const n = await countSafe(s, t);
    if (n > 0) {
      failed = true;
      empties.push(`${f}=${n}`);
    }
  }
  console.log(
    `  ${empties.length === 0 ? "OK  " : "FAIL"} обнуленные таблицы пусты${
      empties.length ? " (не пусты: " + empties.join(", ") + ")" : ""
    }`,
  );

  const seq = await prisma.$queryRawUnsafe<{ prefix: string; value: number }[]>(
    `SELECT prefix, value FROM "events"."BusinessSequence" WHERE prefix IN ('PRN','PRD','USR','ORD','SFX','SUP') ORDER BY prefix`,
  );
  console.log("  счётчики: " + seq.map((r) => `${r.prefix}=${r.value}`).join(", "));

  if (failed) {
    throw new Error("VERIFICATION FAILED — см. вывод выше");
  }
  console.log("\nГотово: платформа обнулена, admin и справочники на месте.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\nОШИБКА:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
