/**
 * Временный скрипт: полный реестр клиентов платформы TravelHub.
 * Выгружает из dev-БД (backend/.env DATABASE_URL):
 *   - security.User (все, с ролями и статусами)
 *   - crm.Customer
 *   - crm.Partner (с привязкой к Company)
 *   - crm.Company
 * Результат — текстовый файл UTF-8.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const pad = (s: string, n: number) => (s ?? "").padEnd(n);

async function main() {
  await prisma.$connect();

  const lines: string[] = [];
  const hr = "=".repeat(100);

  // ── 1. Users ────────────────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "asc" },
  });
  lines.push(hr);
  lines.push("1. ПОЛЬЗОВАТЕЛИ (security.User) — все авторизованные аккаунты платформы");
  lines.push(`   Всего: ${users.length}`);
  lines.push(hr);
  lines.push(
    [pad("CODE", 14), pad("USERNAME", 22), pad("EMAIL", 32), pad("FULL NAME", 26), pad("ROLE", 15), pad("STATUS", 10), pad("CUSTOMER", 40), pad("PARTNER", 40), "CREATED AT"].join("|"),
  );
  lines.push("-".repeat(100));
  for (const u of users) {
    lines.push(
      [
        pad(u.code, 14),
        pad(u.username, 22),
        pad(u.email ?? "", 32),
        pad(u.fullName ?? "", 26),
        pad(u.role.code, 15),
        pad(u.status, 10),
        pad(u.customerId ?? "", 40),
        pad(u.partnerId ?? "", 40),
        u.createdAt.toISOString(),
      ].join("|"),
    );
  }
  lines.push("");

  // ── 2. Customers ─────────────────────────────────────────────────────────────
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: "asc" } });
  lines.push(hr);
  lines.push("2. КЛИЕНТЫ (crm.Customer) — покупатели / лица CRM");
  lines.push(`   Всего: ${customers.length}`);
  lines.push(hr);
  lines.push(
    [pad("CODE", 14), pad("TYPE", 10), pad("FIRST NAME", 20), pad("LAST NAME", 20), pad("COMPANY", 26), pad("EMAIL", 34), pad("PHONE", 18), pad("STATUS", 10), "CREATED AT"].join("|"),
  );
  lines.push("-".repeat(100));
  for (const c of customers) {
    lines.push(
      [
        pad(c.code, 14),
        pad(c.type, 10),
        pad(c.firstName ?? "", 20),
        pad(c.lastName ?? "", 20),
        pad(c.companyName ?? "", 26),
        pad(c.email, 34),
        pad(c.phone ?? "", 18),
        pad(c.status, 10),
        c.createdAt.toISOString(),
      ].join("|"),
    );
  }
  lines.push("");

  // ── 3. Partners ──────────────────────────────────────────────────────────────
  const partners = await prisma.partner.findMany({ include: { company: true }, orderBy: { code: "asc" } });
  lines.push(hr);
  lines.push("3. ПАРТНЁРЫ (crm.Partner) — продавцы платформы");
  lines.push(`   Всего: ${partners.length}`);
  lines.push(hr);
  lines.push(
    [pad("CODE", 14), pad("NAME", 30), pad("STATUS", 10), pad("EMAIL", 32), pad("REG.NUMBER", 18), pad("TAX ID", 14), pad("COUNTRY", 10), pad("COMPANY", 26)].join("|"),
  );
  lines.push("-".repeat(100));
  for (const p of partners) {
    lines.push(
      [
        pad(p.code, 14),
        pad(p.name, 30),
        pad(p.status, 10),
        pad(p.contactEmail ?? "", 32),
        pad(p.registrationNumber ?? "", 18),
        pad(p.taxId ?? "", 14),
        pad(p.countryCode ?? "", 10),
        pad(p.company?.name ?? "", 26),
      ].join("|"),
    );
  }
  lines.push("");

  // ── 4. Companies ─────────────────────────────────────────────────────────────
  const companies = await prisma.company.findMany({ orderBy: { code: "asc" } });
  lines.push(hr);
  lines.push("4. КОМПАНИИ (crm.Company)");
  lines.push(`   Всего: ${companies.length}`);
  lines.push(hr);
  lines.push([pad("CODE", 14), pad("NAME", 40), pad("INN", 16), pad("STATUS", 10)].join("|"));
  lines.push("-".repeat(100));
  for (const c of companies) {
    lines.push([pad(c.code, 14), pad(c.name, 40), pad(c.inn ?? "", 16), pad(c.status, 10)].join("|"));
  }
  lines.push("");

  // ── 5. Связки User ↔ Customer / Partner ─────────────────────────────────────
  lines.push(hr);
  lines.push("5. СВЯЗКИ: User → Customer / Partner (object scope, RBAC §3)");
  lines.push(hr);
  for (const u of users) {
    const scope = u.customerId ? `CUSTOMER: ${u.customerId}` : u.partnerId ? `PARTNER: ${u.partnerId}` : "— (staff/system)";
    lines.push(`${pad(u.code, 14)} ${pad(u.username, 22)} → ${scope}`);
  }
  lines.push("");

  const out = lines.join("\n");
  const outPath = path.resolve(__dirname, "../../clients-report.txt");
  fs.writeFileSync(outPath, out, "utf8");
  console.log(`Отчёт записан: ${outPath}`);
  console.log(`Users=${users.length}, Customers=${customers.length}, Partners=${partners.length}, Companies=${companies.length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
