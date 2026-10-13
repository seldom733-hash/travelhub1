/**
 * Localize Master Geography names (GeoCity / GeoResort).
 *
 * Problem: the supplier geo ingest stores the supplier label (usually RU)
 * into ALL locale keys — `names.ru = names.en = names.az`. So the EN/AZ
 * storefront renders Cyrillic, and «Садият Айленд» never becomes «Saadiyat
 * Island». The jsonb schema is already multi-locale; only the DATA is flat.
 *
 * Strategy (approved: transliteration + curated dictionary):
 *   1. `PROPER`  — curated names for well-known destinations (exact RU match).
 *   2. `WORDS`   — word-level glossary for common geographic nouns
 *                  (остров→Island, пляж→Beach, бухта→Bay …), applied to the
 *                  EN rendering so «Остров Ган» → «Gan Island», not «Ostrov Gan».
 *   3. BGN/PCGN-style transliteration fallback for the long tail.
 *   AZ uses Azerbaijani Latin orthography (a separate translit table + PROPER).
 *
 * Safety: ONLY rewrites a row when `names.en` is byte-identical to `names.ru`
 * (i.e. the EN value is an untranslated copy of RU). A genuine, distinct EN
 * translation is never touched. Idempotent — re-running finds nothing to do.
 *
 * Usage:
 *   node scripts/geo-localize-names.js            # apply (transactional)
 *   node scripts/geo-localize-names.js --dry-run  # report only, no writes
 */

const { Client } = require("pg");

const DRY = process.argv.includes("--dry-run");

const DB = {
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "Nadir@da7374#",
  database: process.env.PGDATABASE || "travelhub",
};

// ── Curated proper names (RU lowercase key → { en, az }) ───────────────────
// Highest priority. Covers the destinations a traveller actually picks.
const PROPER = {
  // UAE
  "садият айленд": { en: "Saadiyat Island", az: "Sadiyat Adası" },
  "яс айленд": { en: "Yas Island", az: "Yas Adası" },
  "марджан айленд": { en: "Marjan Island", az: "Mərcan Adası" },
  "ворлд острова": { en: "World Islands", az: "Dünya Adaları" },
  "дубай острова": { en: "Dubai Islands", az: "Dubay Adaları" },
  "абу-даби": { en: "Abu Dhabi", az: "Əbu-Dəbi" },
  "абу-даби из баку": { en: "Abu Dhabi from Baku", az: "Bakıdan Əbu-Dəbi" },
  "дубай": { en: "Dubai", az: "Dubay" },
  "дубай из баку": { en: "Dubai from Baku", az: "Bakıdan Dubay" },
  "шарджа": { en: "Sharjah", az: "Şarca" },
  "шарджа из баку": { en: "Sharjah from Baku", az: "Bakıdan Şarca" },
  "шарджа город": { en: "Sharjah City", az: "Şarca şəhəri" },
  "шарджа пляж": { en: "Sharjah Beach", az: "Şarca çimərliyi" },
  "аджман": { en: "Ajman", az: "Əcman" },
  "аджман город": { en: "Ajman City", az: "Əcman şəhəri" },
  "аджман пляж": { en: "Ajman Beach", az: "Əcman çimərliyi" },
  "фуджейра": { en: "Fujairah", az: "Füceyre" },
  "фуджейра город": { en: "Fujairah City", az: "Füceyre şəhəri" },
  "рас аль хайма": { en: "Ras Al Khaimah", az: "Rasəl-Xayme" },
  "рас аль хайма город": { en: "Ras Al Khaimah City", az: "Rasəl-Xayme şəhəri" },
  "умм аль кувейн": { en: "Umm Al Quwain", az: "Umməl-Qüveyn" },
  "аль айн": { en: "Al Ain", az: "Əl-Ayn" },
  "бизнес бэй": { en: "Business Bay", az: "Biznes Körfəzi" },
  "корниш шарджа": { en: "Corniche Sharjah", az: "Şarika Kornişi" },
  "ибн батута": { en: "Ibn Battuta", az: "İbn Battuta" },
  "пальма восток": { en: "Palm East", az: "Palma Şərq" },
  "пальма запад": { en: "Palm West", az: "Palma Qərb" },
  "мирна харбор": { en: "Marina Harbour", az: "Marina Limanı" },
  "марина харбор": { en: "Marina Harbour", az: "Marina Limanı" },
  // Georgia
  "батуми": { en: "Batumi", az: "Batumi" },
  "тбилиси": { en: "Tbilisi", az: "Tiflis" },
  "кутаиси": { en: "Kutaisi", az: "Kutaisi" },
  "гудаури": { en: "Gudauri", az: "Gudauri" },
  "бакуриани": { en: "Bakuriani", az: "Bakuriani" },
  "боржоми": { en: "Borjomi", az: "Borcomi" },
  "казанбеги": { en: "Kazbegi", az: "Qazbegi" },
  "казбеги": { en: "Kazbegi", az: "Qazbegi" },
  "цхалтубо": { en: "Tskhal tubo", az: "Tsxealtubo" },
  "сигнахи": { en: "Signagi", az: "Sığnaği" },
  "сигнаги": { en: "Signagi", az: "Sığnaği" },
  // Turkey
  "анталья": { en: "Antalya", az: "Antalya" },
  "стамбул": { en: "Istanbul", az: "İstanbul" },
  "аланья": { en: "Alanya", az: "Alanya" },
  "алания": { en: "Alanya", az: "Alanya" },
  "белек": { en: "Belek", az: "Belek" },
  "сиде": { en: "Side", az: "Side" },
  "кemer": { en: "Kemer", az: "Kemer" },
  "кемер": { en: "Kemer", az: "Kemer" },
  "кушадасы": { en: "Kusadasi", az: "Kuşadası" },
  "измир": { en: "Izmir", az: "İzmir" },
  "машмутлар": { en: "Mahmutlar", az: "Mahmutlar" },
  "махмутлар": { en: "Mahmutlar", az: "Mahmutlar" },
  "манавгат": { en: "Manavgat", az: "Manavgat" },
  "лавра": { en: "Lara", az: "Lara" },
  "лара": { en: "Lara", az: "Lara" },
  "конаклы": { en: "Konakli", az: "Konaklı" },
  "кemer": { en: "Kemer", az: "Kemer" },
  "чешме": { en: "Cesme", az: "Çeşme" },
  "пляж клеопатра": { en: "Cleopatra Beach", az: "Kleopatra Çimərliyi" },
  // Greece
  "афины": { en: "Athens", az: "Afina" },
  "санторини": { en: "Santorini", az: "Santorini" },
  "миконос": { en: "Mykonos", az: "Mykonos" },
  "рит": { en: "Crete", az: "Krit" },
  "krit": { en: "Crete", az: "Krit" },
  "крит": { en: "Crete", az: "Krit" },
  "родос": { en: "Rhodes", az: "Rodos" },
  "корфу": { en: "Corfu", az: "Korfud" },
  "залкинфос": { en: "Zakynthos", az: "Zakintos" },
  "закинтос": { en: "Zakynthos", az: "Zakintos" },
  "халкидики": { en: "Chalkidiki", az: "Xalkidiki" },
  "хиос": { en: "Chios", az: "Xios" },
  "парос": { en: "Paros", az: "Paros" },
  // Bulgaria
  "софия": { en: "Sofia", az: "Sofiya" },
  "варна": { en: "Varna", az: "Varna" },
  "бургас": { en: "Burgas", az: "Burgas" },
  "пловдив": { en: "Plovdiv", az: "Plovdiv" },
  "балчик": { en: "Balchik", az: "Balçik" },
  "несебр": { en: "Nessebar", az: "Nesebar" },
  "созополь": { en: "Sozopol", az: "Sozopol" },
  "солнечный берег": { en: "Sunny Beach", az: "Günəşli Sahil" },
  "золотые пески": { en: "Golden Sands", az: "Qızıl Qumlar" },
  "банско": { en: "Bansko", az: "Bansko" },
  "боровец": { en: "Borovets", az: "Borovets" },
  "пампорово": { en: "Pamporovo", az: "Pamporovo" },
  "елините": { en: "Elenite", az: "Elenite" },
  "албена": { en: "Albena", az: "Albena" },
  "свети влас": { en: "Sveti Vlas", az: "Sveti Vlas" },
  // Egypt
  "хургада": { en: "Hurghada", az: "Hurqada" },
  "шарм-эль-шейх": { en: "Sharm El Sheikh", az: "Şarm əl-Şeyx" },
  "шарм-эль-шейх из баку (block)": { en: "Sharm El Sheikh from Baku", az: "Bakıdan Şarm əl-Şeyx" },
  "шарм эль шейх": { en: "Sharm El Sheikh", az: "Şarm əl-Şeyx" },
  "марса алам": { en: "Marsa Alam", az: "Marsa Ələm" },
  "дахаб": { en: "Dahab", az: "Dahab" },
  "эль гуна": { en: "El Gouna", az: "Əl-Quna" },
  "эль-гуна": { en: "El Gouna", az: "Əl-Quna" },
  "наама бэй": { en: "Naama Bay", az: "Nama Körfəzi" },
  "шаркс бэй": { en: "Sharks Bay", az: "Köpəkbalığı Körfəzi" },
  "макади бэй": { en: "Makadi Bay", az: "Makadi Körfəzi" },
  "сома бэй": { en: "Soma Bay", az: "Soma Körfəzi" },
  // Thailand
  "пхукет": { en: "Phuket", az: "Phuket" },
  "банкok": { en: "Bangkok", az: "Bankok" },
  "банкок": { en: "Bangkok", az: "Bankok" },
  "паттайя": { en: "Pattaya", az: "Pattaya" },
  "пхукет": { en: "Phuket", az: "Phuket" },
  "крали": { en: "Krabi", az: "Krabi" },
  "краби": { en: "Krabi", az: "Krabi" },
  "самуи": { en: "Koh Samui", az: "Ko Samui" },
  "ко чанг": { en: "Koh Chang", az: "Ko Çanq" },
  "ко ланта": { en: "Koh Lanta", az: "Ko Lanta" },
  "карон": { en: "Karon", az: "Karon" },
  "ката": { en: "Kata", az: "Kata" },
  "камала": { en: "Kamala", az: "Kamala" },
  "джомтьен": { en: "Jomtien", az: "Comtien" },
  "хоа хин": { en: "Hua Hin", az: "Hua Hin" },
  "хуа хин": { en: "Hua Hin", az: "Hua Hin" },
  // Maldives
  "мале": { en: "Male", az: "Malé" },
  // Cyprus
  "ларнака": { en: "Larnaca", az: "Larnaka" },
  "лимассол": { en: "Limassol", az: "Limassol" },
  "пафос": { en: "Paphos", az: "Baf" },
  "никосия": { en: "Nicosia", az: "Lefkoşa" },
  "протарас": { en: "Protaras", az: "Protaras" },
  "айя-напа": { en: "Ayia Napa", az: "Ayia Napa" },
  "айя напа": { en: "Ayia Napa", az: "Ayia Napa" },
  // Spain
  "барселона": { en: "Barcelona", az: "Barselona" },
  "мадрид": { en: "Madrid", az: "Madrid" },
  "ибица": { en: "Ibiza", az: "İbiza" },
  "майорка": { en: "Mallorca", az: "Mallorca" },
  "тенерифе": { en: "Tenerife", az: "Tenerife" },
  "малага": { en: "Malaga", az: "Malaga" },
  "бенидорм": { en: "Benidorm", az: "Benidorm" },
  "фуэнхирола": { en: "Fuengirola", az: "Fuengirola" },
  "альбир": { en: "Albir", az: "Albir" },
  // Italy
  "рим": { en: "Rome", az: "Rim" },
  "милан": { en: "Milan", az: "Milan" },
  "венеция": { en: "Venice", az: "Venesiya" },
  "флоренция": { en: "Florence", az: "Florensiya" },
  "римини": { en: "Rimini", az: "Rimini" },
  "кальяри": { en: "Cagliari", az: "Kalyari" },
  "сицилия": { en: "Sicily", az: "Siciliya" },
  "сардиния": { en: "Sardinia", az: "Sardiniya" },
  // Montenegro
  "будва": { en: "Budva", az: "Budva" },
  "котор": { en: "Kotor", az: "Kotor" },
  "тиват": { en: "Tivat", az: "Tivat" },
  "подгорица": { en: "Podgorica", az: "Podqoritsa" },
  "херцег нови": { en: "Herceg Novi", az: "Herseq Novi" },
  "герцег нови": { en: "Herceg Novi", az: "Herseq Novi" },
  "свети стефан": { en: "Sveti Stefan", az: "Sveti Stefan" },
  "святой стефан": { en: "Sveti Stefan", az: "Sveti Stefan" },
  // Tunisia / Morocco
  "хаммамет": { en: "Hammamet", az: "Hammamet" },
  "джерба": { en: "Djerba", az: "Cərbə" },
  "сус": { en: "Sousse", az: "Susan" },
  "тунис": { en: "Tunis", az: "Tunis" },
  "марракеш": { en: "Marrakech", az: "Mərakeş" },
  "касабланка": { en: "Casablanca", az: "Kasablanka" },
  "агадир": { en: "Agadir", az: "Agadir" },
  // Common junk / excursion-programme rows → keep readable but neutral
  "экскурсии": { en: "Excursions", az: "Ekskursiyalar" },
};

// ── Word glossary (RU lowercase → EN), applied to EN rendering ─────────────
const WORDS_EN = {
  "остров": "Island", "острова": "Islands", "островов": "Islands",
  "пляж": "Beach", "пляжа": "Beach", "пляжи": "Beaches",
  "бич": "Beach", "бэй": "Bay", "бей": "Bay", "бухта": "Bay",
  "залив": "Bay", "гавань": "Harbor", "порт": "Port",
  "город": "City", "города": "City", "центр": "Center", "центральный": "Central",
  "северный": "North", "север": "North", "южный": "South", "юг": "South",
  "восточный": "East", "восток": "East", "западный": "West", "запад": "West",
  "верхний": "Upper", "нижний": "Lower", "новый": "New", "старый": "Old",
  "национальный": "National", "парк": "Park", "курорт": "Resort",
  "горы": "Mountains", "гора": "Mount", "озеро": "Lake", "река": "River",
  "равнина": "Plain", "побережье": "Coast", "берег": "Shore",
  "дельта": "Delta", "ривьера": "Riviera", "коста": "Costa",
  "район": "District", "область": "Region", "округ": "County",
  "прилет": "Arrival", "прибытие": "Arrival", "из баку": "from Baku",
  "вилладж": "Village", "деревня": "Village", "коттедж": "Cottage",
  "мыс": "Cape", "半岛": "Peninsula", "полуостров": "Peninsula",
  "лагуна": "Lagoon", "водопад": "Waterfall", "пещера": "Cave",
};

// ── BGN/PCGN-style RU → EN transliteration ────────────────────────────────
const TR_EN = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
  "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
  "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
  "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
};

// ── RU → AZ transliteration (Azerbaijani Latin orthography) ───────────────
const TR_AZ = {
  "а": "a", "б": "b", "в": "v", "г": "q", "д": "d", "е": "e", "ё": "yo",
  "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
  "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "x", "ц": "s", "ч": "ç", "ш": "ş", "щ": "ş",
  "ъ": "", "ы": "ı", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  "қ": "q", "ғ": "ğ", "ө": "ö", "ү": "ü",
};

const isCyr = (s) => /[Ѐ-ӿ]/.test(s || "");

function translit(text, table) {
  return [...text].map((ch) => {
    const lower = ch.toLowerCase();
    const rep = table[lower];
    if (rep === undefined) return ch;
    // Preserve initial capitalisation.
    return ch === ch.toUpperCase() && ch !== ch.toLowerCase()
      ? rep.charAt(0).toUpperCase() + rep.slice(1)
      : rep;
  }).join("");
}

/** Title-case each whitespace-separated word (keeps hyphens/inner caps). */
function titleCase(s) {
  return s.replace(/(^|[\s\-\/)(])([a-zа-яё])/g, (m, p, c) => p + c.toUpperCase());
}

/** EN name for a Cyrillic RU label: PROPER → word-gloss → translit. */
function enFromRu(ru) {
  const key = ru.trim().toLowerCase();
  if (PROPER[key]) return PROPER[key].en;
  // Whole-phrase word gloss then translit for the rest.
  const words = ru.split(/(\s+)/); // keep separators
  let out = "";
  for (const token of words) {
    const clean = token.toLowerCase().replace(/[^а-яё]/g, "");
    if (/\s/.test(token) || !token.trim()) { out += token; continue; }
    if (clean && WORDS_EN[clean] && !isCyr(token) === false) {
      out += WORDS_EN[clean];
    } else if (isCyr(token)) {
      out += titleCase(translit(token, TR_EN));
    } else {
      out += token; // already Latin
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/** AZ name for a Cyrillic RU label: PROPER → translit (AZ orthography). */
function azFromRu(ru) {
  const key = ru.trim().toLowerCase();
  if (PROPER[key]) return PROPER[key].az;
  return titleCase(translit(ru, TR_AZ)).replace(/\s+/g, " ").trim();
}

async function main() {
  const client = new Client(DB);
  await client.connect();
  try {
    // Only rows where EN is an untranslated copy of RU (and RU is Cyrillic).
    const { rows } = await client.query(`
      SELECT id, code, names FROM geo."GeoResort"
      WHERE names->>'ru' = names->>'en' AND names->>'ru' ~ '[Ѐ-ӿ]'
    `);
    const { rows: cityRows } = await client.query(`
      SELECT id, code, names FROM geo."GeoCity"
      WHERE names->>'ru' = names->>'en' AND names->>'ru' ~ '[Ѐ-ӿ]'
    `);

    const all = [
      ...rows.map((r) => ({ ...r, kind: "resort" })),
      ...cityRows.map((r) => ({ ...r, kind: "city" })),
    ];

    let updated = 0;
    const sample = [];
    await client.query("BEGIN");
    for (const row of all) {
      const ru = row.names.ru;
      const en = enFromRu(ru);
      const az = azFromRu(ru);
      if (!en || !az) continue;
      const names = { ...row.names, en, az };
      if (!DRY) {
        const table = row.kind === "resort" ? 'geo."GeoResort"' : 'geo."GeoCity"';
        await client.query(
          `UPDATE ${table} SET names = $1::jsonb, "updatedAt" = NOW(), "updatedBy" = 'geo-localize' WHERE id = $2`,
          [JSON.stringify(names), row.id],
        );
      }
      updated++;
      if (sample.length < 25) sample.push(`${row.kind[0].toUpperCase()} ${row.code}: ${ru} → EN "${en}" / AZ "${az}"`);
    }
    if (DRY) await client.query("ROLLBACK");
    else await client.query("COMMIT");

    console.log(`\n${DRY ? "[DRY-RUN] would update" : "Updated"} ${updated} entities (resorts+cities) with Cyrillic EN.`);
    console.log("─".repeat(70));
    for (const s of sample) console.log("  " + s);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
