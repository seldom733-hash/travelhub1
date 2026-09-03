/**
 * D5 — additive dev fixture (MKT-ORD-D5FIX-0001).
 * Marketplace D3-shape Order, status NEW, finalConfirmedAt NULL,
 * 1 OrderTraveler (INCOMPLETE: только имена) — для browser evidence
 * action/editing/audit flows. Идемпотентен: повторный запуск не дублирует.
 */
import "dotenv/config";
import pg from "pg";

const PINNED = {
  firstName: "REQUIRED",
  lastName: "REQUIRED",
  birthDate: "OPTIONAL",
  citizenship: "REQUIRED",
  gender: "OPTIONAL",
  passportNumber: "REQUIRED",
  passportExpiry: "OPTIONAL",
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const ex = await client.query('SELECT id FROM "order"."Order" WHERE "referenceNumber" = $1', ["MKT-ORD-D5FIX-0001"]);
  if (ex.rows.length) {
    console.log("exists", ex.rows[0].id);
  } else {
    const order = await client.query(
      `INSERT INTO "order"."Order"
        (id, code, number, "referenceNumber", status, "paymentStatus", currency, amount,
         "acquisitionSource", "termsAcceptedAt", "finalConfirmedAt", "travelerCount",
         "pinnedRequirements", version, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, 'NEW', 'UNPAID', 'USD', 0, 'MARKETPLACE',
         now(), NULL, 1, $4::jsonb, 1, now(), now())
       RETURNING id`,
      ["ORD-D5FIX-0001", "TH-D5FIX-0001", "MKT-ORD-D5FIX-0001", JSON.stringify(PINNED)],
    );
    const oid = order.rows[0].id;
    await client.query(
      `INSERT INTO "order"."OrderTraveler"
        (id, "orderId", position, "firstName", "lastName", "dataCompleteness", version)
       VALUES (gen_random_uuid(), $1, 1, $2, $3, 'INCOMPLETE', 1)`,
      [oid, "Айтен", "Мамедова"],
    );
    console.log("created", oid);
  }
} finally {
  await client.end();
}
