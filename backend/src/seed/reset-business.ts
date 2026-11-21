/**
 * ЧАСТИЧНОЕ ОБНУЛЕНИЕ БИЗНЕС-ДАННЫХ.
 *
 * Очищает: клиентов, сделки (заявки/заказы/брони), документы, платежи,
 * возвраты, обязательства/выплаты поставщикам и связанные номера.
 *
 * Не трогает: сотрудников (кроме пользователей-покупателей), партнёров/
 * поставщиков, курсы поставщиков, товары, справочники и настройки.
 *
 * Запуск: npm run reset:business
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const TRUNCATE_TABLES = [
  "documents.DocumentHistory", "documents.DocumentVersion", "documents.Document",
  "booking.BookingHistory", "booking.Passenger", "booking.Booking",
  "order.Fulfillment", "order.OrderItem", "order.OrderTraveler", "order.OrderHistory",
  "order.Order", "order.RequestService", "order.RequestTraveler", "order.RequestHistory", "order.Request",
  "finance.PaymentWebhookEvent", "finance.PaymentHistory", "finance.Payment",
  "finance.RefundHistory", "finance.Refund",
  "finance.CommissionAccrual", "finance.Commission",
  "finance.SupplierPayoutAllocation", "finance.SupplierPayout", "finance.Payout",
  "finance.SupplierObligationEvent", "finance.SupplierObligation",
  "finance.SupplierPaymentEvidence", "finance.SupplierPaymentInstallment", "finance.SupplierPaymentPlan",
  "finance.OrderFinancialAdjustment", "finance.OrderFinancialSettlement", "finance.OrderPaymentSchedule",
  "finance.OrderCancellationSupplierTerm", "finance.CancellationApproval",
  "finance.DisputeHistory", "finance.Dispute", "finance.Invoice",
  "finance.ProviderFee", "finance.Settlement",
  "finance.ClientDebtWriteOff", "finance.SupplierDebtWriteOff",
  "crm.PartnerCustomerRelationHistory", "crm.PartnerCustomerRelation",
  "crm.CrmActivity", "crm.OperationalNote", "crm.CustomerHistory", "crm.Customer",
  "decision.DecisionSignal",
  "communication.Communication", "communication.CommunicationThread",
  "security.UserNotification", "security.UserWorkspaceLayout", "security.ActivationToken",
] as const;

/** Номера, которые относятся к очищаемым бизнес-объектам. */
const RESET_SEQUENCES = [
  "CUS", "REQ", "ORD", "BKG", "PAY", "RFD", "SBO", "SPO", "VCH", "PPD",
  "SET", "FAD", "CNA", "CDW", "SDW", "CMS", "CAA", "LTX",
];

async function main(): Promise<void> {
  const targets = TRUNCATE_TABLES.map((f) => {
    const [schema, table] = f.split(".");
    return `"${schema}"."${table}"`;
  }).join(", ");

  console.log(`=== TRUNCATE ${TRUNCATE_TABLES.length} таблиц ===`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${targets} CASCADE`);

  // Покупатели удаляются вместе с клиентами. Сотрудники и партнёрские
  // пользователи остаются.
  const buyerRoles = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "security"."Role" WHERE "code" = 'BUYER'`,
  );
  const buyerRoleIds = buyerRoles.map((r) => r.id);
  const buyers = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "security"."User"
     WHERE "customerId" IS NOT NULL
        OR ("roleId" = ANY($1::text[]))`,
    buyerRoleIds,
  );
  if (buyers.length > 0) {
    const ids = buyers.map((u) => u.id);
    await prisma.$executeRawUnsafe(
      `DELETE FROM "security"."UserRoleAssignment" WHERE "userId" = ANY($1::text[])`,
      ids,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "security"."User" WHERE id = ANY($1::text[])`,
      ids,
    );
    console.log(`=== Пользователей-покупателей удалено: ${ids.length} ===`);
  } else {
    console.log("=== Пользователей-покупателей нет ===");
  }

  if (RESET_SEQUENCES.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "events"."BusinessSequence" SET "value" = 0 WHERE "prefix" = ANY($1::text[])`,
      RESET_SEQUENCES,
    );
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM "events"."BusinessSequence" WHERE "prefix" LIKE 'REFSEQ:%'`,
  );

  // USR продолжает нумерацию оставшихся пользователей, чтобы новый
  // покупатель не получил существующий код.
  const maxUser = await prisma.$queryRawUnsafe<{ n: number | null }[]>(
    `SELECT MAX(NULLIF(regexp_replace("code", '\\D', '', 'g'), '')::int) AS n
     FROM "security"."User" WHERE "code" LIKE 'USR-%'`,
  );
  const usr = Number(maxUser[0]?.n ?? 0);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "events"."BusinessSequence" ("prefix","value") VALUES ('USR',$1)
     ON CONFLICT ("prefix") DO UPDATE SET "value" = EXCLUDED."value"`,
    usr,
  );

  console.log("=== Проверка ===");
  for (const table of ["crm.Customer", "order.Request", "order.Order", "booking.Booking", "documents.Document", "finance.Payment", "finance.Refund", "finance.SupplierObligation"]) {
    const [schema, name] = table.split(".");
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${schema}"."${name}"`,
    );
    console.log(`  ${table}: ${Number(rows[0].n)}`);
  }
  const users = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM "security"."User"`,
  );
  console.log(`  security.User: ${Number(users[0].n)}`);
  console.log("  USR sequence:", usr);
  console.log("\nГотово: клиенты, сделки, документы и финансы обнулены; сотрудники, поставщики и справочники сохранены.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\nОШИБКА:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
