import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const STOP = new Set(["hotel","hotels","resort","resorts","spa","guest","house","guesthouse","apartments","apartment","suites","suite","inn","hostel","villa","villas","club","beach","by","the","and","of","at","in","city","center","centre","luxury","deluxe","grand","royal","palace","boutique","complex","residence","bosphorus","old","new"]);

function norm(name: string): string {
  return (name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function coreToken(name: string): string {
  return norm(name).split(" ").filter((t) => t.length >= 3 && !STOP.has(t))[0] ?? "";
}

function starsOf(name: string): number {
  const m = name.match(/(\d+)\s*\*/);
  return m ? parseInt(m[1], 10) : 0;
}

// Levenshtein distance
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function similar(a: string, b: string): boolean {
  if (a === b) return true;
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  // one contains the other (after stripping stars/parens)
  const sa = na.replace(/\d+\s*\*/g, "").trim();
  const sb = nb.replace(/\d+\s*\*/g, "").trim();
  if (sa && sb && (sa.includes(sb) || sb.includes(sa))) return true;
  // small edit distance on the full normalized name
  const d = lev(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen > 0 && d / maxLen < 0.15) return true;
  // same core + same stars + one name's tokens subset of the other
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  if (ta.size > 0 && tb.size > 0 && inter / Math.min(ta.size, tb.size) >= 0.8) return true;
  return false;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  try {
    const hotels = await prisma.hotel.findMany({
      select: { id: true, name: true, normalizedName: true, countryCode: true, cityName: true, photoFile: true, stars: true },
    });
    // group by (country, coreToken)
    const groups = new Map<string, typeof hotels>();
    for (const h of hotels) {
      const key = `${h.countryCode}|${coreToken(h.name)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(h);
    }
    const dupes: any[] = [];
    for (const [key, hs] of groups) {
      if (hs.length < 2) continue;
      // find pairs of distinct names that are similar
      const byName = new Map<string, typeof hotels[0][]>();
      for (const h of hs) {
        const n = norm(h.name);
        if (!byName.has(n)) byName.set(n, []);
        byName.get(n)!.push(h);
      }
      const distinctNames = [...byName.keys()];
      const similarPairs: Array<[string, string]> = [];
      for (let i = 0; i < distinctNames.length; i++) {
        for (let j = i + 1; j < distinctNames.length; j++) {
          if (similar(distinctNames[i], distinctNames[j])) {
            similarPairs.push([distinctNames[i], distinctNames[j]]);
          }
        }
      }
      if (similarPairs.length === 0) continue;
      dupes.push({ key, hotels: hs.map((h) => ({ id: h.id, name: h.name, city: h.cityName, stars: h.stars, photo: h.photoFile })), pairs: similarPairs });
    }
    console.log("total hotels:", hotels.length);
    console.log("candidate duplicate groups:", dupes.length);
    const out = dupes.slice(0, 500);
    fs.writeFileSync(path.resolve(__dirname, "../data/hotels/duplicate-candidates.json"), JSON.stringify(out, null, 2));
    console.log("written (first 500 groups)");
    const byCountry = new Map<string, number>();
    for (const d of dupes) {
      const cc = d.key.split("|")[0];
      byCountry.set(cc, (byCountry.get(cc) ?? 0) + 1);
    }
    console.log("by country:", Object.fromEntries(byCountry));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
