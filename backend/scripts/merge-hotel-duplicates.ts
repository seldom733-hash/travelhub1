import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const STOP = new Set(["hotel","hotels","resort","resorts","spa","guest","house","guesthouse","apartments","apartment","suites","suite","inn","hostel","villa","villas","club","beach","by","the","and","of","at","in","city","center","centre","luxury","deluxe","grand","royal","palace","boutique","complex","residence","bosphorus","old","new"]);

function norm(name: string): string { return (name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim(); }
function coreToken(name: string): string { return norm(name).split(" ").filter((t) => t.length >= 3 && !STOP.has(t))[0] ?? ""; }
function starsOf(name: string): number { const m = name.match(/(\d+)\s*\*/); return m ? parseInt(m[1], 10) : 0; }
function lev(a: string, b: string): number {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let cur = [i]; for (let j = 1; j <= b.length; j++) { const cost = a[i-1] === b[j-1] ? 0 : 1; cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + cost); } prev = cur; }
  return prev[b.length];
}
function similar(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b); if (na === nb) return true;
  // Stars must agree (if both present) — different stars = different hotel.
  const sa = starsOf(a), sb = starsOf(b);
  if (sa && sb && sa !== sb) return false;
  // Strip stars and compare: one name must contain the other (substring).
  const sa2 = na.replace(/\d+\s*\*/g, "").trim(), sb2 = nb.replace(/\d+\s*\*/g, "").trim();
  if (sa2 && sb2 && (sa2.includes(sb2) || sb2.includes(sa2))) return true;
  return false;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  try {
    const hotels = await prisma.hotel.findMany({
      select: { id: true, name: true, normalizedName: true, countryCode: true, cityName: true, photoFile: true, stars: true, normalizedName: true },
    });
    // group by (country, coreToken)
    const groups = new Map<string, typeof hotels>();
    for (const h of hotels) {
      const key = `${h.countryCode}|${coreToken(h.name)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(h);
    }
    // build merge clusters: pairs of distinct names that are similar
    const merges: Array<{ a: string; b: string; reason: string }> = [];
    for (const [, hs] of groups) {
      if (hs.length < 2) continue;
      if (!coreToken(hs[0].name)) continue; // skip groups with no meaningful token
      const byName = new Map<string, typeof hotels[0][]>();
      for (const h of hs) { const n = norm(h.name); if (!byName.has(n)) byName.set(n, []); byName.get(n)!.push(h); }
      const distinctNames = [...byName.keys()];
      for (let i = 0; i < distinctNames.length; i++) {
        for (let j = i + 1; j < distinctNames.length; j++) {
          const nA = distinctNames[i], nB = distinctNames[j];
          if (!similar(nA, nB)) continue;
          // safety: stars must agree (if both present and non-zero)
          const starsA = byName.get(nA)![0].stars, starsB = byName.get(nB)![0].stars;
          if (starsA && starsB && starsA !== starsB) continue;
          // safety: cities must agree if both present; if one is empty, allow
          // (the registry will inherit the city from the canonical record).
          const cityA = byName.get(nA)![0].cityName, cityB = byName.get(nB)![0].cityName;
          if (cityA && cityB && cityA.toLowerCase() !== cityB.toLowerCase()) continue;
          // all hotel ids in group A and B
          for (const ha of byName.get(nA)!) {
            for (const hb of byName.get(nB)!) {
              if (ha.id === hb.id) continue;
              merges.push({ a: ha.id, b: hb.id, reason: `${ha.name} ||| ${hb.name}` });
            }
          }
        }
      }
    }
    console.log("merge candidates (hotel pairs):", merges.length);
    if (dryRun) {
      console.log(JSON.stringify(merges.slice(0, 50), null, 2));
      return;
    }
    // execute merges: pick canonical = the one with more refs (or photo)
    const deleted = new Set<string>();
    let merged = 0, skipped = 0;
    for (const m of merges) {
      if (deleted.has(m.a) || deleted.has(m.b)) continue;
      const ha = hotels.find((h) => h.id === m.a)!;
      const hb = hotels.find((h) => h.id === m.b)!;
      if (!ha || !hb) continue;
      // pick canonical: prefer one with photo, then more refs
      const refsA = await prisma.hotelSupplierRef.count({ where: { hotelId: ha.id } });
      const refsB = await prisma.hotelSupplierRef.count({ where: { hotelId: hb.id } });
      let canonical = ha, other = hb;
      if ((hb.photoFile && !ha.photoFile) || (hb.photoFile === ha.photoFile && refsB > refsA)) {
        canonical = hb; other = ha;
      }
      try {
        await prisma.$transaction(async (tx) => {
          // move refs
          await tx.hotelSupplierRef.updateMany({ where: { hotelId: other.id }, data: { hotelId: canonical.id } });
          // copy photo if canonical lacks
          if (!canonical.photoFile && other.photoFile) {
            await tx.hotel.update({ where: { id: canonical.id }, data: {
              photoFile: other.photoFile, photoStatus: "OK", photoSource: "tripadvisor",
              photoSourceUrl: other.photoSourceUrl ?? null, photoWidth: other.photoWidth ?? null,
              photoHeight: other.photoHeight ?? null, photoBytes: other.photoBytes ?? null,
              photoUpdatedAt: new Date(),
            }});
          }
          // delete the duplicate hotel
          await tx.hotel.delete({ where: { id: other.id } });
        });
        merged++;
        deleted.add(other.id);
      } catch (e) {
        skipped++;
        console.log("SKIP", other.id, (e as Error).message);
      }
    }
    console.log(`done: merged=${merged} skipped=${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
