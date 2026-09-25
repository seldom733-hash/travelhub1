export interface FlightAirport {
  code: string;
  city: string;
  country: string;
  airport: string;
  search: string;
}

/**
 * Flight airport directory used by the aviation search UI.
 * The code is the IATA code sent to suppliers such as AZAL.
 */
export const FLIGHT_AIRPORTS: FlightAirport[] = [
  {
    code: "BAK",
    city: "Баку",
    country: "Азербайджан",
    airport: "Baku / Heydar Aliyev",
    search: "baku баку baki bakı",
  },
  {
    code: "GYD",
    city: "Баку",
    country: "Азербайджан",
    airport: "Heydar Aliyev International",
    search: "gyd baku баку",
  },
  {
    code: "KVD",
    city: "Гянджа",
    country: "Азербайджан",
    airport: "Ganja International",
    search: "ganja гянджа gəncə",
  },
  {
    code: "NAJ",
    city: "Нахчыван",
    country: "Азербайджан",
    airport: "Nakhchivan International",
    search: "nakhchivan нахчыван нахичевань",
  },
  {
    code: "IST",
    city: "Стамбул",
    country: "Турция",
    airport: "Istanbul Airport",
    search: "istanbul стамбул",
  },
  {
    code: "SAW",
    city: "Стамбул",
    country: "Турция",
    airport: "Sabiha Gökçen",
    search: "sabiha saw istanbul стамбул",
  },
  {
    code: "TBS",
    city: "Тбилиси",
    country: "Грузия",
    airport: "Tbilisi International",
    search: "tbilisi тбилиси",
  },
  {
    code: "DXB",
    city: "Дубай",
    country: "ОАЭ",
    airport: "Dubai International",
    search: "dubai дубай",
  },
  {
    code: "DOH",
    city: "Доха",
    country: "Катар",
    airport: "Hamad International",
    search: "doha доха",
  },
  {
    code: "LON",
    city: "Лондон",
    country: "Великобритания",
    airport: "All London airports",
    search: "london лондон",
  },
  {
    code: "LHR",
    city: "Лондон",
    country: "Великобритания",
    airport: "Heathrow",
    search: "heathrow лондон lhr",
  },
  {
    code: "CDG",
    city: "Париж",
    country: "Франция",
    airport: "Charles de Gaulle",
    search: "paris париж",
  },
  {
    code: "BER",
    city: "Берлин",
    country: "Германия",
    airport: "Berlin Brandenburg",
    search: "berlin берлин",
  },
  {
    code: "DME",
    city: "Москва",
    country: "Россия",
    airport: "Domodedovo",
    search: "moscow москва",
  },
  {
    code: "BUD",
    city: "Будапешт",
    country: "Венгрия",
    airport: "Ferenc Liszt International",
    search: "budapest будапешт bud",
  },
  {
    code: "VIE",
    city: "Вена",
    country: "Австрия",
    airport: "Vienna",
    search: "vie vienna вена",
  },
  {
    code: "FZL",
    city: "Физули",
    country: "Азербайджан",
    airport: "Fuzuli",
    search: "fzl fuzuli физули",
  },
  {
    code: "GNJ",
    city: "Гянджа",
    country: "Азербайджан",
    airport: "Ganja",
    search: "gnj ganja гянджа ганджа",
  },
  {
    code: "BRU",
    city: "Брюссель",
    country: "Бельгия",
    airport: "Brussels Airport / Charleroi Brussels South Airport",
    search: "bru brussels брюссель brussels airport crl charleroi brussels south airport",
  },
  {
    code: "BAH",
    city: "Бахрейн",
    country: "Бахрейн",
    airport: "Al Muharraq",
    search: "bah bahrain бахрейн al muharraq",
  },
  {
    code: "MSQ",
    city: "Минск",
    country: "Беларусь",
    airport: "Minsk",
    search: "msq minsk минск",
  },
  {
    code: "BJS",
    city: "Пекин",
    country: "Китай",
    airport: "Beijing Capital International Airport / Beijing Daxing International Airport",
    search: "bjs beijing пекин pek beijing capital international airport pkx beijing daxing international airport",
  },
  {
    code: "PRG",
    city: "Прага",
    country: "Чешская Республика",
    airport: "Prague",
    search: "prg prague прага",
  },
  {
    code: "FRA",
    city: "Франкфурт",
    country: "Германия",
    airport: "Frankfurt/Main International / Frankfurt Hahn Airport",
    search: "fra frankfurt франкфурт frankfurt/main international hhn frankfurt hahn airport",
  },
  {
    code: "DBB",
    city: "Эль-Аламейн",
    country: "Египет",
    airport: "El Alamein International Airport",
    search: "dbb el alamein эль-аламейн el alamein international airport",
  },
  {
    code: "SSH",
    city: "Шарм-эль-Шейх",
    country: "Египет",
    airport: "Sharm El Sheikh",
    search: "ssh sharm el sheikh шарм-эль-шейх шарм-эш-шейх шарм",
  },
  {
    code: "BCN",
    city: "Барселона",
    country: "Испания",
    airport: "Barcelona Airport El Prat",
    search: "bcn barcelona барселона barcelona airport el prat",
  },
  {
    code: "PAR",
    city: "Париж",
    country: "Франция",
    airport: "Beauvais-Tille Airport / Charles De Gaulle / Le Bourget / Paris Orly Airport",
    search: "par paris париж bva beauvais-tille airport cdg charles de gaulle lbg le bourget ory paris orly airport",
  },
  {
    code: "BUS",
    city: "Батуми",
    country: "Грузия",
    airport: "Batumi",
    search: "bus batumi батуми",
  },
  {
    code: "HER",
    city: "Ираклион",
    country: "Греция",
    airport: "Heraklion",
    search: "her heraklion ираклион гераклион",
  },
  {
    code: "TLV",
    city: "Тель-Авив",
    country: "Израиль",
    airport: "Ben Gurion",
    search: "tlv tel aviv тель-авив ben gurion",
  },
  {
    code: "BOM",
    city: "Мумбаи",
    country: "Индия",
    airport: "Mumbai",
    search: "bom mumbai мумбаи мумбай",
  },
  {
    code: "DEL",
    city: "Нью-Дели",
    country: "Индия",
    airport: "Indira Gandhi International",
    search: "del new delhi нью-дели дели индия indira gandhi international",
  },
  {
    code: "TBZ",
    city: "Тебриз",
    country: "Иран",
    airport: "Tabriz",
    search: "tbz tabriz тебриз",
  },
  {
    code: "THR",
    city: "Тегеран",
    country: "Иран",
    airport: "Imam Khomeini International Airport",
    search: "thr tehran тегеран ika imam khomeini international airport",
  },
  {
    code: "MIL",
    city: "Милан",
    country: "Италия",
    airport: "Orio al Serio International Airport / Milano Linate Airport / Malpensa",
    search: "mil milan милан bgy orio al serio international airport lin milano linate airport mxp malpensa",
  },
  {
    code: "AMM",
    city: "Амман",
    country: "Иордания",
    airport: "Marka International Airport / Amman",
    search: "amm amman амман adj marka international airport",
  },
  {
    code: "FRU",
    city: "Бишкек",
    country: "Кыргызстан",
    airport: "Manas International Airport",
    search: "fru bishkek бишкек bsz manas international airport",
  },
  {
    code: "AKX",
    city: "Актобе",
    country: "Казахстан",
    airport: "Aktobe Airport",
    search: "akx aktobe актобе aktobe airport",
  },
  {
    code: "ALA",
    city: "Алматы",
    country: "Казахстан",
    airport: "Almaty",
    search: "ala almaty алматы",
  },
  {
    code: "CIT",
    city: "Шымкент",
    country: "Казахстан",
    airport: "Shymkent",
    search: "cit shymkent шымкент чимкент",
  },
  {
    code: "GUW",
    city: "Атырау",
    country: "Казахстан",
    airport: "Atyrau",
    search: "guw atyrau атырау",
  },
  {
    code: "NQZ",
    city: "Астана",
    country: "Казахстан",
    airport: "Nursultan Nazarbayev International Airport",
    search: "nqz astana астана nursultan nazarbayev international airport",
  },
  {
    code: "SCO",
    city: "Актау",
    country: "Казахстан",
    airport: "Aktau",
    search: "sco aktau актау",
  },
  {
    code: "RIX",
    city: "Рига",
    country: "Латвия",
    airport: "Riga International Airport",
    search: "rix riga рига riga international airport",
  },
  {
    code: "RMO",
    city: "Кишинев",
    country: "Молдова",
    airport: "Chisinau",
    search: "rmo chisinau кишинев кишинёв",
  },
  {
    code: "TIV",
    city: "Тиват",
    country: "Черногория",
    airport: "Tivat",
    search: "tiv tivat тиват",
  },
  {
    code: "MLE",
    city: "Мале",
    country: "Мальдивы",
    airport: "Male",
    search: "mle male мале",
  },
  {
    code: "MCT",
    city: "Мускат",
    country: "Оман",
    airport: "Muscat International Airport / Sohar Airport",
    search: "mct muscat мускат muscat international airport ohs sohar airport",
  },
  {
    code: "ISB",
    city: "Исламабад",
    country: "Пакистан",
    airport: "Islamabad",
    search: "isb islamabad исламабад",
  },
  {
    code: "KHI",
    city: "Карачи",
    country: "Пакистан",
    airport: "Karachi",
    search: "khi karachi карачи",
  },
  {
    code: "LHE",
    city: "Лахор",
    country: "Пакистан",
    airport: "Lahore",
    search: "lhe lahore лахор",
  },
  {
    code: "BEG",
    city: "Белград",
    country: "Сербия",
    airport: "Belgrade Nikola Tesla Airport",
    search: "beg belgrade белград belgrade nikola tesla airport",
  },
  {
    code: "ASF",
    city: "Астрахань",
    country: "Россия",
    airport: "Astrakhan",
    search: "asf astrakhan астрахань",
  },
  {
    code: "LED",
    city: "Санкт-Петербург",
    country: "Россия",
    airport: "St Petersburg",
    search: "led st petersburg санкт-петербург петербург питер спб",
  },
  {
    code: "MOW",
    city: "Москва",
    country: "Россия",
    airport: "Domodedovo Airport / Sheremetyevo International Airport / Vnukovo international airport / Zhukovsky International Airport",
    search: "mow moscow москва dme domodedovo airport svo sheremetyevo international airport vko vnukovo international airport zia zhukovsky international airport",
  },
  {
    code: "SVX",
    city: "Екатеринбург",
    country: "Россия",
    airport: "Ekaterinburg",
    search: "svx ekaterinburg екатеринбург",
  },
  {
    code: "DMM",
    city: "Даммам",
    country: "Саудовская Аравия",
    airport: "Dammam",
    search: "dmm dammam даммам эд-даммам",
  },
  {
    code: "JED",
    city: "Джидда",
    country: "Саудовская Аравия",
    airport: "Jeddah",
    search: "jed jeddah джидда джедда",
  },
  {
    code: "MED",
    city: "Медина",
    country: "Саудовская Аравия",
    airport: "Prince Mohammed Bin Abdulaziz International Airport",
    search: "med medina медина prince mohammed bin abdulaziz international airport",
  },
  {
    code: "RUH",
    city: "Эр-Рияд",
    country: "Саудовская Аравия",
    airport: "Riyadh",
    search: "ruh riyadh эр-рияд",
  },
  {
    code: "DYU",
    city: "Душанбе",
    country: "Таджикистан",
    airport: "Dushanbe International Airport",
    search: "dyu dushanbe душанбе dushanbe international airport",
  },
  {
    code: "ANK",
    city: "Анкара",
    country: "Турция",
    airport: "Esenboga",
    search: "ank ankara анкара esb esenboga",
  },
  {
    code: "AYT",
    city: "Анталия",
    country: "Турция",
    airport: "Antalya",
    search: "ayt antalya анталия анталья",
  },
  {
    code: "BJV",
    city: "Бодрум",
    country: "Турция",
    airport: "Bodrum / Imsik",
    search: "bjv bodrum бодрум bxn imsik",
  },
  {
    code: "COV",
    city: "Адана - Мерсин",
    country: "Турция",
    airport: "Cukurova Airport",
    search: "cov adana - mersin адана - мерсин cukurova airport",
  },
  {
    code: "DLM",
    city: "Даламан",
    country: "Турция",
    airport: "Dalaman",
    search: "dlm dalaman даламан",
  },
  {
    code: "GZP",
    city: "Аланья",
    country: "Турция",
    airport: "Gazipasa",
    search: "gzp alanya аланья алания gazipasa",
  },
  {
    code: "IZM",
    city: "Измир",
    country: "Турция",
    airport: "Adnan Menderes",
    search: "izm izmir измир adb adnan menderes",
  },
  {
    code: "KSY",
    city: "Карс",
    country: "Турция",
    airport: "Kars",
    search: "ksy kars карс",
  },
  {
    code: "TZX",
    city: "Трабзон",
    country: "Турция",
    airport: "Trabzon International Airport",
    search: "tzx trabzon трабзон trabzon international airport",
  },
  {
    code: "SKD",
    city: "Самарканд",
    country: "Узбекистан",
    airport: "Samarkand",
    search: "skd samarkand самарканд",
  },
  {
    code: "TAS",
    city: "Ташкент",
    country: "Узбекистан",
    airport: "Tashkent",
    search: "tas tashkent ташкент",
  },
];

export function findFlightAirports(query: string): FlightAirport[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    return FLIGHT_AIRPORTS;
  }

  return FLIGHT_AIRPORTS.filter((airport) =>
    `${airport.code} ${airport.city} ${airport.country} ${airport.airport} ${airport.search}`
      .toLowerCase()
      .includes(q),
  );
}

/**
 * Backward-compatible helper used by the existing AZAL search flow.
 * Keeps the existing export while allowing the new airport selector
 * to use the structured directory above.
 */
export function getFlightLocationCode(value: string): string {
  const normalized = value.trim().toUpperCase();

  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  const airport = FLIGHT_AIRPORTS.find(
    (item) =>
      item.city.toUpperCase() === normalized ||
      item.airport.toUpperCase() === normalized ||
      item.search
        .split(" ")
        .some((term) => term.toUpperCase() === normalized),
  );

  if (airport) {
    return airport.code;
  }

  const aliases: Record<string, string> = {
    "БАКУ": "BAK",
    "БАКУ, АЗЕРБАЙДЖАН": "BAK",
    "СТАМБУЛ": "IST",
    "СТАМБУЛ, ТУРЦИЯ": "IST",
    "ГЯНДЖА": "KVD",
    "ГЯНДЖА, АЗЕРБАЙДЖАН": "KVD",
    "НАХЧЫВАН": "NAJ",
    "НАХИЧЕВАНЬ": "NAJ",
    "ТБИЛИСИ": "TBS",
    "ДУБАЙ": "DXB",
    "ДОХА": "DOH",
    "ЛОНДОН": "LON",
    "ПАРИЖ": "CDG",
    "БЕРЛИН": "BER",
    "МОСКВА": "DME",
    "БУДАПЕШТ": "BUD",
    "БУДАПЕШТ, ВЕНГРИЯ": "BUD",
  };

  return aliases[normalized] ?? normalized;
}
