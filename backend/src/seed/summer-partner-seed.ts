/**
 * Idempotent seed script: creates Summer Partner + User + Supplier.
 *
 * Reuses existing entities if already present.
 * Safe to run multiple times (idempotent).
 *
 * Security: generates a random temporary password on first creation.
 * The password is printed ONCE to stdout and never stored in source.
 *
 * Usage: npx ts-node src/seed/summer-partner-seed.ts
 */
import "dotenv/config";
import { randomBytes } from "crypto";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const SUMMER_LOGIN = "summer@summertour.az";
const SUMMER_PARTNER_NAME = "Summer / Summertour";
const SUMMER_SUPPLIER_NAME = "Summertour";

function generateTemporaryPassword(): string {
  // 16 bytes = 32 hex chars, split into readable segments
  const raw = randomBytes(16).toString("hex");
  // Format: Xxx-9999-xxxx-9999 (mixed case + digits for readability)
  const upper = raw.substring(0, 4).replace(/[0-9]/g, (c) => String.fromCharCode(65 + parseInt(c)));
  const digits = raw.substring(4, 8).replace(/[^0-9]/g, "9");
  const lower = raw.substring(8, 12).replace(/[0-9]/g, (c) => String.fromCharCode(97 + parseInt(c)));
  const digits2 = raw.substring(12, 16).replace(/[^0-9]/g, "7");
  return `${upper}-${digits}-${lower}-${digits2}`;
}

async function main() {
  console.log("=== Summer Partner Seed (idempotent) ===\n");

  // ── 1. Check/create Partner ────────────────────────────────────────
  let partner = await prisma.partner.findFirst({
    where: { name: SUMMER_PARTNER_NAME },
    select: { id: true, code: true, name: true, status: true },
  });

  if (partner) {
    console.log(`Partner REUSED: ${partner.code} (${partner.id})`);
  } else {
    const timestamp = Date.now().toString(36).toUpperCase();
    const code = `PAR-${timestamp}`;

    partner = await prisma.$transaction(async (tx) => {
      const id = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "crm"."Partner" ("id", "code", "name", "status", "countryCode")
        VALUES (gen_random_uuid(), ${code}, ${SUMMER_PARTNER_NAME}, 'ACTIVE'::"crm"."EntityStatus", 'TR')
        RETURNING "id"
      `.then((r: any) => r[0].id);

      return tx.partner.findUnique({ where: { id }, select: { id: true, code: true, name: true, status: true } });
    });
    console.log(`Partner CREATED: ${partner!.code} (${partner!.id})`);
  }

  // ── 2. Check/create Supplier ──────────────────────────────────────
  let supplier = await prisma.supplier.findFirst({
    where: { name: SUMMER_SUPPLIER_NAME },
    select: { id: true, code: true, name: true },
  });

  if (supplier) {
    console.log(`Supplier REUSED: ${supplier.code} (${supplier.id})`);
  } else {
    const supCode = `SUP-${Date.now().toString(36).toUpperCase()}`;
    supplier = await prisma.$transaction(async (tx) => {
      const id = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "crm"."Supplier" ("id", "code", "name", "status")
        VALUES (gen_random_uuid(), ${supCode}, ${SUMMER_SUPPLIER_NAME}, 'ACTIVE'::"crm"."EntityStatus")
        RETURNING "id"
      `.then((r: any) => r[0].id);
      return tx.supplier.findUnique({ where: { id }, select: { id: true, code: true, name: true } });
    });
    console.log(`Supplier CREATED: ${supplier!.code} (${supplier!.id})`);
  }

  // ── 3. Check/create User ──────────────────────────────────────────
  const role = await prisma.role.findUnique({
    where: { code: "PARTNER" },
    select: { id: true, code: true },
  });
  if (!role) throw new Error("PARTNER role not found");

  let user = await prisma.user.findFirst({
    where: { username: SUMMER_LOGIN },
    select: { id: true, code: true, username: true, partnerId: true },
  });

  let temporaryPassword: string | null = null;

  if (user) {
    console.log(`User REUSED: ${user.code} (${user.username})`);
    if (!user.partnerId && partner) {
      await prisma.user.update({ where: { id: user.id }, data: { partnerId: partner.id } });
      console.log(`User linked to Partner`);
    }
  } else {
    temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const userCode = `USR-SUMMER`;
    user = await prisma.$transaction(async (tx) => {
      const id = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "security"."User" ("id", "code", "username", "passwordHash", "fullName", "status", "roleId", "partnerId", "version", "tokenVersion", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${userCode}, ${SUMMER_LOGIN}, ${passwordHash}, ${SUMMER_PARTNER_NAME}, 'ACTIVE'::"security"."UserStatus", ${role.id}, ${partner!.id}, 1, 0, now(), now())
        RETURNING "id"
      `.then((r: any) => r[0].id);
      return tx.user.findUnique({ where: { id }, select: { id: true, code: true, username: true, partnerId: true } });
    });
    console.log(`User CREATED: ${user!.code} (${user!.username})`);
  }

  // ── 4. Summary ────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  console.log(`Partner ID:    ${partner!.id}`);
  console.log(`Partner Code:  ${partner!.code}`);
  console.log(`Supplier ID:   ${supplier!.id}`);
  console.log(`Supplier Code: ${supplier!.code}`);
  console.log(`User ID:       ${user!.id}`);
  console.log(`User Code:     ${user!.code}`);
  console.log(`Login:         ${SUMMER_LOGIN}`);
  console.log(`Role:          PARTNER`);

  if (temporaryPassword) {
    console.log(`\n========================================`);
    console.log(`SUMMER PARTNER INITIAL CREDENTIALS`);
    console.log(`========================================`);
    console.log(`Login:    ${SUMMER_LOGIN}`);
    console.log(`Password: ${temporaryPassword}`);
    console.log(`========================================`);
    console.log(`(This password is shown ONCE. Save it securely.)`);
  } else {
    console.log(`\n(No new credentials — user already exists.)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
