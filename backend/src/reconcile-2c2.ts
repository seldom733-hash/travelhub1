/**
 * Round 2C.2 — Commercial Cross-View Consistency Audit
 */
import { PrismaService } from './prisma/prisma.service';

const prisma = new PrismaService();

const CA = 'crm."CrmActivity"';
const ORD = '"order"."Order"';
const BKG = '"booking"."Booking"';
const PAY = '"finance"."Payment"';
const RFD = '"finance"."Refund"';
const CRM_CUST = 'crm."Customer"';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function q(sql: string, ...args: any[]): Promise<any[]> {
  // @ts-ignore
  return prisma.$queryRawUnsafe(sql, ...args);
}

async function main() {
  console.log('=== ROUND 2C.2 — COMMERCIAL CROSS-VIEW CONSISTENCY AUDIT ===\n');

  // 1. Global CrmActivity counts
  console.log('--- CrmActivity Global Counts ---');
  const globalCounts = await q(`
    SELECT "sourceType" as source_type, COUNT(*)::int as cnt
    FROM ${CA} GROUP BY "sourceType" ORDER BY "sourceType"
  `);
  for (const c of globalCounts) console.log(`  ${c.source_type}: ${c.cnt}`);
  console.log();

  // 2. Top customers by commercial activity
  console.log('--- Top Customers by Commercial Activity ---');
  const topCustomers = await q(`
    SELECT "customerId" as customer_id, COUNT(*)::int as cnt
    FROM ${CA}
    WHERE "sourceType" IN ('ORDER','BOOKING','PAYMENT','REFUND')
      AND "customerId" IS NOT NULL
    GROUP BY "customerId" ORDER BY cnt DESC LIMIT 10
  `);
  for (const c of topCustomers) console.log(`  ${c.customer_id}: ${c.cnt}`);
  console.log();

  if (topCustomers.length === 0) { console.log('NO COMMERCIAL ACTIVITY'); return; }

  const cidA = topCustomers[0].customer_id;
  const cidB = (topCustomers.find((c: any) => c.customer_id !== cidA) || {}).customer_id;

  const crmA = await q(`SELECT code, "firstName", "lastName" FROM ${CRM_CUST} WHERE id = $1`, cidA);
  const nameA = [crmA[0]?.firstName, crmA[0]?.lastName].filter(Boolean).join(' ') || crmA[0]?.code;
  console.log(`=== CUSTOMER A: ${crmA[0]?.code} (${nameA}) [${cidA}] ===`);
  if (cidB) {
    const crmB = await q(`SELECT code, "firstName", "lastName" FROM ${CRM_CUST} WHERE id = $1`, cidB);
    const nameB = [crmB[0]?.firstName, crmB[0]?.lastName].filter(Boolean).join(' ') || crmB[0]?.code;
    console.log(`=== CUSTOMER B: ${crmB[0]?.code} (${nameB}) [${cidB}] ===`);
  }
  console.log();

  // Helpers
  const getOrders = async (cid: string) => q(`SELECT id, code, status, "customerId", "createdAt" as created FROM ${ORD} WHERE "customerId" = $1 ORDER BY "createdAt" ASC`, cid);
  const getBookings = async (cid: string) => q(`SELECT b.id, b.code, b.status, b."createdAt" as created FROM ${BKG} b JOIN ${ORD} o ON o.id = b."orderId" WHERE o."customerId" = $1 ORDER BY b."createdAt" ASC`, cid);
  const getPayments = async (cid: string) => q(`SELECT id, code, status, amount, "createdAt" as created, "paidAt" as paid FROM ${PAY} WHERE "customerId" = $1 ORDER BY "createdAt" ASC`, cid);
  const getRefunds = async (cid: string) => q(`SELECT r.id, r.code, r.status, r.amount, r."createdAt" as created, r."processedAt" as processed FROM ${RFD} r JOIN ${PAY} p ON p.id = r."paymentId" WHERE p."customerId" = $1 ORDER BY r."createdAt" ASC`, cid);
  const getAct = async (cid: string, st: string) => q(`SELECT "sourceId" as source_id, "activityType" as event, "occurredAt" as occurred, metadata FROM ${CA} WHERE "customerId" = $1 AND "sourceType" = $2 ORDER BY "occurredAt" ASC`, cid, st);

  // === ORDER ===
  console.log('--- ORDER RECONCILIATION ---');
  const aOrd = await getOrders(cidA);
  const aOrdA = await getAct(cidA, 'ORDER');
  console.log(`  Canonical: ${aOrd.length} | Activity: ${aOrdA.length}`);
  const aOrdIds = new Set(aOrd.map((o: any) => o.id));
  const aOrdAIds = new Set(aOrdA.map((a: any) => a.source_id));
  const ordMiss = aOrd.filter((o: any) => !aOrdAIds.has(o.id));
  const ordExtra = aOrdA.filter((a: any) => !aOrdIds.has(a.source_id));
  console.log(`  Missing: ${ordMiss.length} ${ordMiss.length > 0 ? ordMiss.map((o: any) => o.code).join(', ') : 'CLEAN'}`);
  console.log(`  Extra: ${ordExtra.length} ${ordExtra.length > 0 ? 'LEAK' : 'CLEAN'}`);
  console.log();

  // === BOOKING ===
  console.log('--- BOOKING RECONCILIATION ---');
  const aBkg = await getBookings(cidA);
  const aBkgA = await getAct(cidA, 'BOOKING');
  console.log(`  Canonical: ${aBkg.length} | Activity: ${aBkgA.length}`);
  const aBkgIds = new Set(aBkg.map((b: any) => b.id));
  const aBkgAIds = new Set(aBkgA.map((a: any) => a.source_id));
  const bkgMiss = aBkg.filter((b: any) => !aBkgAIds.has(b.id));
  const bkgExtra = aBkgA.filter((a: any) => !aBkgIds.has(a.source_id));
  console.log(`  Missing: ${bkgMiss.length} ${bkgMiss.length > 0 ? bkgMiss.map((b: any) => b.code).join(', ') : 'CLEAN'}`);
  console.log(`  Extra: ${bkgExtra.length} ${bkgExtra.length > 0 ? 'LEAK' : 'CLEAN'}`);
  console.log();

  // === PAYMENT ===
  console.log('--- PAYMENT RECONCILIATION ---');
  const aPay = await getPayments(cidA);
  const aPayA = await getAct(cidA, 'PAYMENT');
  console.log(`  Canonical: ${aPay.length} | Activity: ${aPayA.length}`);
  for (const p of aPay) console.log(`    ${p.code} [${p.status}] paid=${p.paid}`);
  for (const a of aPayA) console.log(`    Act: ${a.source_id} ${a.event} meta_code=${(a.metadata || {}).code}`);

  const payActIds = new Set(aPayA.map((a: any) => a.source_id));
  const payZero = aPay.filter((p: any) => !payActIds.has(p.id));
  console.log(`  Missing (zero events): ${payZero.length} ${payZero.length > 0 ? payZero.map((p: any) => p.code).join(', ') : 'CLEAN'}`);

  // Code authority
  let codeMismatches = 0;
  for (const a of aPayA) {
    const mc = (a.metadata || {}).code;
    const canon = aPay.find((p: any) => p.id === a.source_id);
    if (canon && mc && mc !== canon.code) {
      console.log(`  ❌ CODE MISMATCH: ${a.source_id} meta=${mc} canon=${canon.code}`);
      codeMismatches++;
    }
  }
  console.log(`  Code mismatches: ${codeMismatches}`);
  console.log();

  // === REFUND ===
  console.log('--- REFUND RECONCILIATION ---');
  const aRef = await getRefunds(cidA);
  const aRefA = await getAct(cidA, 'REFUND');
  console.log(`  Canonical: ${aRef.length} | Activity: ${aRefA.length}`);
  for (const r of aRef) console.log(`    ${r.code} [${r.status}] processed=${r.processed}`);

  const aRefIds = new Set(aRef.map((r: any) => r.id));
  const aRefAIds = new Set(aRefA.map((a: any) => a.source_id));
  const refMiss = aRef.filter((r: any) => !aRefAIds.has(r.id));
  const refExtra = aRefA.filter((a: any) => !aRefIds.has(a.source_id));
  console.log(`  Missing: ${refMiss.length} ${refMiss.length > 0 ? refMiss.map((r: any) => r.code).join(', ') : 'CLEAN'}`);
  console.log(`  Extra: ${refExtra.length} ${refExtra.length > 0 ? 'LEAK' : 'CLEAN'}`);
  console.log();

  // === PAYMENT FINDING ===
  console.log('--- PAYMENT FINDING: PAY-00007001 / 557 / 616 ---');
  for (const code of ['PAY-00007001', 'PAY-00000557', 'PAY-00000616']) {
    const pay = await q(`SELECT id, code, "customerId" as cid, "orderId" as oid, status FROM ${PAY} WHERE code = $1`, code);
    if (pay.length === 0) { console.log(`  ${code}: NOT FOUND`); continue; }
    const p = pay[0];
    console.log(`  ${code}: id=${p.id} customer=${p.cid} order=${p.oid} status=${p.status}`);
    const act = await q(`SELECT "customerId" as cid, "activityType" as event, metadata FROM ${CA} WHERE "sourceId" = $1 AND "sourceType" = 'PAYMENT'`, p.id);
    for (const a of act) console.log(`    → Activity: customerId=${a.cid} event=${a.event} meta_code=${(a.metadata || {}).code}`);
  }
  console.log();

  // === WRONG-SUBJECT ===
  console.log('--- WRONG-SUBJECT DETECTION ---');
  const ow = await q(`SELECT COUNT(*)::int as cnt FROM ${CA} a JOIN ${ORD} o ON o.id = a."sourceId" WHERE a."sourceType" = 'ORDER' AND a."customerId" != o."customerId"`);
  console.log(`  ORDER: ${ow[0]?.cnt ?? 0} ${Number(ow[0]?.cnt ?? 0) === 0 ? '✅' : '❌'}`);

  const pw = await q(`SELECT COUNT(*)::int as cnt FROM ${CA} a JOIN ${PAY} p ON p.id = a."sourceId" WHERE a."sourceType" = 'PAYMENT' AND a."customerId" IS DISTINCT FROM p."customerId"`);
  console.log(`  PAYMENT: ${pw[0]?.cnt ?? 0} ${Number(pw[0]?.cnt ?? 0) === 0 ? '✅' : '❌'}`);

  const bw = await q(`SELECT COUNT(*)::int as cnt FROM ${CA} a JOIN ${BKG} b ON b.id = a."sourceId" JOIN ${ORD} o ON o.id = b."orderId" WHERE a."sourceType" = 'BOOKING' AND a."customerId" != o."customerId"`);
  console.log(`  BOOKING: ${bw[0]?.cnt ?? 0} ${Number(bw[0]?.cnt ?? 0) === 0 ? '✅' : '❌'}`);

  const rw2 = await q(`SELECT COUNT(*)::int as cnt FROM ${CA} a JOIN ${RFD} r ON r.id = a."sourceId" JOIN ${PAY} p ON p.id = r."paymentId" WHERE a."sourceType" = 'REFUND' AND a."customerId" IS DISTINCT FROM p."customerId"`);
  console.log(`  REFUND: ${rw2[0]?.cnt ?? 0} ${Number(rw2[0]?.cnt ?? 0) === 0 ? '✅' : '❌'}`);
  console.log();

  // === ORPHANS ===
  console.log('--- ORPHAN DETECTION ---');
  for (const [st, tbl] of [['ORDER',ORD], ['BOOKING',BKG], ['PAYMENT',PAY], ['REFUND',RFD]]) {
    const orphans = await q(`SELECT COUNT(*)::int as cnt FROM ${CA} a WHERE a."sourceType" = $1 AND a."sourceId" NOT IN (SELECT id FROM ${tbl})`, st);
    console.log(`  ${st}: ${orphans[0]?.cnt ?? 0} ${Number(orphans[0]?.cnt ?? 0) === 0 ? '✅' : '❌'}`);
  }
  console.log();

  // === DUPLICATES ===
  console.log('--- DUPLICATE DETECTION ---');
  const dupes = await q(`SELECT "sourceType" as st, "sourceId" as sid, COUNT(*)::int as cnt FROM ${CA} WHERE "sourceType" IN ('ORDER','BOOKING','PAYMENT','REFUND') GROUP BY "sourceType", "sourceId" HAVING COUNT(*) > 1`);
  if (dupes.length === 0) console.log('  CLEAN: 0 duplicates');
  else for (const d of dupes) console.log(`  ❌ ${d.st}/${d.sid}: ${d.cnt} rows`);
  console.log();

  // === CROSS-CUSTOMER ISOLATION ===
  if (cidB) {
    console.log('--- CROSS-CUSTOMER ISOLATION ---');
    const bOrdIds = (await getOrders(cidB)).map((o: any) => o.id);
    const bBkgIds = (await getBookings(cidB)).map((b: any) => b.id);
    const bPayIds = (await getPayments(cidB)).map((p: any) => p.id);
    const bRefIds = (await getRefunds(cidB)).map((r: any) => r.id);
    const bAll = new Set([...bOrdIds, ...bBkgIds, ...bPayIds, ...bRefIds]);

    const aAct = await q(`SELECT "sourceId" as sid FROM ${CA} WHERE "customerId" = $1 AND "sourceType" IN ('ORDER','BOOKING','PAYMENT','REFUND')`, cidA);
    const aLeak = aAct.filter((a: any) => bAll.has(a.sid));
    console.log(`  A→B leakage: ${aLeak.length} ${aLeak.length === 0 ? '✅' : '❌'}`);

    const aOrdIds2 = (await getOrders(cidA)).map((o: any) => o.id);
    const aBkgIds2 = (await getBookings(cidA)).map((b: any) => b.id);
    const aPayIds2 = (await getPayments(cidA)).map((p: any) => p.id);
    const aRefIds2 = (await getRefunds(cidA)).map((r: any) => r.id);
    const aAll = new Set([...aOrdIds2, ...aBkgIds2, ...aPayIds2, ...aRefIds2]);

    const bAct = await q(`SELECT "sourceId" as sid FROM ${CA} WHERE "customerId" = $1 AND "sourceType" IN ('ORDER','BOOKING','PAYMENT','REFUND')`, cidB);
    const bLeak = bAct.filter((a: any) => aAll.has(a.sid));
    console.log(`  B→A leakage: ${bLeak.length} ${bLeak.length === 0 ? '✅' : '❌'}`);
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

main().catch(console.error).finally(() => (prisma as any).$disconnect());
