/**
 * Comprehensive countries database with cities and trilingual localization.
 * Used by CountryFilter, CityFilter, and API routes.
 */

export interface City {
  name: { ru: string; en: string };
}

export interface CountryData {
  code: string;
  name: { ru: string; en: string };
  cities: City[];
}

function c(ru: string, en: string): City {
  return { name: { ru, en } };
}

const _countriesRaw: CountryData[] = [
  // ==================== ПОПУЛЯРНЫЕ НАПРАВЛЕНИЯ ====================
  { code: "TR", name: { ru: "Турция", en: "Turkey" }, cities: [
    c("Стамбул", "Istanbul"), c("Анталья", "Antalya"), c("Бодрум", "Bodrum"),
    c("Мармарис", "Marmaris"), c("Кемер", "Kemer"), c("Каппадокия", "Cappadocia"),
    c("Измир", "Izmir"), c("Аланья", "Alanya"), c("Даламан", "Dalaman"),
    c("Фетхие", "Fethiye"), c("Кушадасы", "Kusadasi"), c("Памуккале", "Pamukkale"),
    c("Сиде", "Side"), c("Белек", "Belek"), c("Олюдениз", "Oludeniz"),
    c("Чешме", "Cesme"), c("Дидим", "Didim"), c("Каш", "Kas"),
    c("Олюдениз", "OluDeniz"), c("Гёбекли Тепе", "Gobekli Tepe"),
  ]},
  { code: "AE", name: { ru: "ОАЭ", en: "UAE" }, cities: [
    c("Дубай", "Dubai"), c("Абу-Даби", "Abu Dhabi"), c("Шарджа", "Sharjah"),
    c("Рас-эль-Хайма", "Ras Al Khaimah"), c("Аджман", "Ajman"),
    c("Фуджейра", "Fujairah"), c("Умм-эль-Кувейн", "Umm Al Quwain"),
  ]},
  { code: "EG", name: { ru: "Египет", en: "Egypt" }, cities: [
    c("Каир", "Cairo"), c("Шарм-эль-Шейх", "Sharm El Sheikh"),
    c("Хургада", "Hurghada"), c("Александрия", "Alexandria"),
    c("Луксор", "Luxor"), c("Асуан", "Aswan"), c("Марса-Алам", "Marsa Alam"),
    c("Таба", "Taba"), c("Дахаб", "Dahab"), c("Макади-Бей", "Makadi Bay"),
  ]},
  { code: "TH", name: { ru: "Таиланд", en: "Thailand" }, cities: [
    c("Бангкок", "Bangkok"), c("Пхукет", "Phuket"), c("Паттайя", "Pattaya"),
    c("Чиангмай", "Chiang Mai"), c("Краби", "Krabi"), c("Ко-Самуи", "Koh Samui"),
    c("Ко-Ланта", "Koh Lanta"), c("Ко-Чанг", "Koh Chang"), c("Хуа-Хин", "Hua Hin"),
    c("Сураттхани", "Surat Thani"), c("Нонг-Хай", "Nong Khai"),
    c("Пхи-Пхи", "Phi Phi"), c("Ко-Панган", "Koh Phangan"),
  ]},
  { code: "GE", name: { ru: "Грузия", en: "Georgia" }, cities: [
    c("Тбилиси", "Tbilisi"), c("Батуми", "Batumi"), c("Кутаиси", "Kutaisi"),
    c("Мцхета", "Mtskheta"), c("Зугдиди", "Zugdidi"), c("Казбеги", "Kazbegi"),
    c("Гудаури", "Gudauri"), c("Боржоми", "Borjomi"), c("Телави", "Telavi"),
    c("Сигнахи", "Sighnaghi"), c("Местия", "Mestia"), c("Кварели", "Kvareli"),
  ]},
  { code: "AZ", name: { ru: "Азербайджан", en: "Azerbaijan" }, cities: [
    c("Баку", "Baku"), c("Гянджа", "Ganja"), c("Нафталан", "Naftalan"),
    c("Ленкорань", "Lankaran"), c("Шеки", "Sheki"), c("Габала", "Gabala"),
    c("Нахичевань", "Nakhchivan"), c("Загатала", "Zagatala"), c("Гусар", "Gusar"),
    c("Мингечевир", "Mingachevir"), c("Шамкир", "Shamkir"),
  ]},
  { code: "RU", name: { ru: "Россия", en: "Russia" }, cities: [
    c("Москва", "Moscow"), c("Санкт-Петербург", "Saint Petersburg"),
    c("Сочи", "Sochi"), c("Казань", "Kazan"), c("Калининград", "Kaliningrad"),
    c("Новосибирск", "Novosibirsk"), c("Екатеринбург", "Yekaterinburg"),
    c("Краснодар", "Krasnodar"), c("Самара", "Samara"), c("Нижний Новгород", "Nizhny Novgorod"),
    c("Владивосток", "Vladivostok"), c("Мурманск", "Murmansk"),
    c("Архангельск", "Arkhangelsk"), c("Петрозаводск", "Petrozavodsk"),
    c("Иркутск", "Irkutsk"), c("Красноярск", "Krasnoyarsk"),
  ]},
  { code: "IT", name: { ru: "Италия", en: "Italy" }, cities: [
    c("Рим", "Rome"), c("Милан", "Milan"), c("Венеция", "Venice"),
    c("Флоренция", "Florence"), c("Неаполь", "Naples"), c("Турин", "Turin"),
    c("Генуя", "Genoa"), c("Палермо", "Palermo"), c("Катания", "Catania"),
    c("Болонья", "Bologna"), c("Верона", "Verona"), c("Пиза", "Pisa"),
    c("Амальфи", "Amalfi"), c("Поситано", "Positano"), c("Сорренто", "Sorrento"),
    c("Милан", "Milano"), c("Сицилия", "Sicily"), c("Сардиния", "Sardinia"),
  ]},
  { code: "ES", name: { ru: "Испания", en: "Spain" }, cities: [
    c("Барселона", "Barcelona"), c("Мадрид", "Madrid"), c("Малага", "Malaga"),
    c("Севилья", "Seville"), c("Валенсия", "Valencia"), c("Бильбао", "Bilbao"),
    c("Ивиса", "Ibiza"), c("Тенерифе", "Tenerife"), c("Гран-Канария", "Gran Canaria"),
    c("Пальма-де-Майорка", "Palma de Mallorca"), c("Аликанте", "Alicante"),
    c("Марбелья", "Marbella"), c("Коста Брава", "Costa Brava"),
    c("Коста Дорада", "Costa Dorada"), c("Сан-Себастьян", "San Sebastian"),
  ]},
  { code: "FR", name: { ru: "Франция", en: "France" }, cities: [
    c("Париж", "Paris"), c("Ницца", "Nice"), c("Лион", "Lyon"),
    c("Марсель", "Marseille"), c("Бордо", "Bordeaux"), c("Тулуза", "Toulouse"),
    c("Страсбург", "Strasbourg"), c("Канны", "Cannes"), c("Монако", "Monaco"),
    c("Шамони", "Chamonix"), c("Нанси", "Nancy"), c("Дижон", "Dijon"),
  ]},
  { code: "DE", name: { ru: "Германия", en: "Germany" }, cities: [
    c("Берлин", "Berlin"), c("Мюнхен", "Munich"), c("Гамбург", "Hamburg"),
    c("Франкфурт", "Frankfurt"), c("Кёльн", "Cologne"), c("Дрезден", "Dresden"),
    c("Штутгарт", "Stuttgart"), c("Ганновер", "Hannover"), c("Нюрнберг", "Nuremberg"),
  ]},
  { code: "GB", name: { ru: "Великобритания", en: "United Kingdom" }, cities: [
    c("Лондон", "London"), c("Эдинбург", "Edinburgh"), c("Манчестер", "Manchester"),
    c("Ливерпуль", "Liverpool"), c("Оксфорд", "Oxford"), c("Кембридж", "Cambridge"),
    c("Глазгоу", "Glasgow"), c("Кардифф", "Cardiff"),
  ]},
  { code: "GR", name: { ru: "Греция", en: "Greece" }, cities: [
    c("Афины", "Athens"), c("Санторини", "Santorini"), c("Крит", "Crete"),
    c("Родос", "Rhodes"), c("Миконос", "Mykonos"), c("Корфу", "Corfu"),
    c("Закинф", "Zakynthos"), c("Лесбос", "Lesbos"), c("Халкидики", "Halkidiki"),
    c("Кефалония", "Kefalonia"), c("Пелопоннес", "Peloponnese"),
  ]},
  { code: "PT", name: { ru: "Португалия", en: "Portugal" }, cities: [
    c("Лиссабон", "Lisbon"), c("Порту", "Porto"), c("Фару", "Faro"),
    c("Мадейра", "Madeira"), c("Азорские острова", "Azores"),
    c("Брага", "Braga"), c("Коимбра", "Coimbra"),
  ]},
  { code: "NL", name: { ru: "Нидерланды", en: "Netherlands" }, cities: [
    c("Амстердам", "Amsterdam"), c("Роттердам", "Rotterdam"), c("Гаага", "The Hague"),
    c("Утрехт", "Utrecht"), c("Маастрихт", "Maastricht"),
  ]},
  { code: "CH", name: { ru: "Швейцария", en: "Switzerland" }, cities: [
    c("Цюрих", "Zurich"), c("Женева", "Geneva"), c("Люцерн", "Lucerne"),
    c("Интерлакен", "Interlaken"), c("Берн", "Bern"), c("Базель", "Basel"),
  ]},
  { code: "AT", name: { ru: "Австрия", en: "Austria" }, cities: [
    c("Вена", "Vienna"), c("Зальцбург", "Salzburg"), c("Инсбрук", "Innsbruck"),
    c("Грац", "Graz"), c("Линц", "Linz"), c("Клагенфурт", "Klagenfurt"),
  ]},
  { code: "CZ", name: { ru: "Чехия", en: "Czech Republic" }, cities: [
    c("Прага", "Prague"), c("Карловы Вары", "Karlovy Vary"), c("Чески-Крумлов", "Cesky Krumlov"),
    c("Брно", "Brno"), c("Оломоуц", "Olomouc"),
  ]},
  { code: "PL", name: { ru: "Польша", en: "Poland" }, cities: [
    c("Варшава", "Warsaw"), c("Краков", "Krakow"), c("Гданьск", "Gdansk"),
    c("Вроцлав", "Wroclaw"), c("Познань", "Poznan"), c("Закопане", "Zakopane"),
  ]},
  { code: "HU", name: { ru: "Венгрия", en: "Hungary" }, cities: [
    c("Будапешт", "Budapest"), c("Дебрецен", "Debrecen"), c("Эгер", "Eger"),
    c("Хевиз", "Heviz"),
  ]},
  { code: "HR", name: { ru: "Хорватия", en: "Croatia" }, cities: [
    c("Дубровник", "Dubrovnik"), c("Сплит", "Split"), c("Загреб", "Zagreb"),
    c("Хвар", "Hvar"), c("Пула", "Pula"), c("Задар", "Zadar"),
    c("Ровинь", "Rovinj"), c("Опатия", "Opatija"),
  ]},
  { code: "BG", name: { ru: "Болгария", en: "Bulgaria" }, cities: [
    c("София", "Sofia"), c("Варна", "Varna"), c("Бургас", "Burgas"),
    c("Пловдив", "Plovdiv"), c("Золотые Пески", "Golden Sands"),
    c("Солнечный Берег", "Sunny Beach"),
  ]},
  { code: "ME", name: { ru: "Черногория", en: "Montenegro" }, cities: [
    c("Подгорица", "Podgorica"), c("Будва", "Budva"), c("Котор", "Kotor"),
    c("Херцег-Нови", "Herceg Novi"), c("Тиват", "Tivat"), c("Улцинь", "Ulcinj"),
  ]},
  { code: "CY", name: { ru: "Кипр", en: "Cyprus" }, cities: [
    c("Ларнака", "Larnaca"), c("Пафос", "Paphos"), c("Лимассол", "Limassol"),
    c("Айя-Напа", "Ayia Napa"), c("Протарас", "Protaras"), c("Никосия", "Nicosia"),
  ]},
  { code: "IS", name: { ru: "Исландия", en: "Iceland" }, cities: [
    c("Рейкьявик", "Reykjavik"), c("Акюрейри", "Akureyri"),
  ]},
  { code: "IE", name: { ru: "Ирландия", en: "Ireland" }, cities: [
    c("Дублин", "Dublin"), c("Голуэй", "Galway"), c("Корк", "Cork"),
  ]},
  { code: "SE", name: { ru: "Швеция", en: "Sweden" }, cities: [
    c("Стокгольм", "Stockholm"), c("Гётеборг", "Gothenburg"), c("Мальмё", "Malmo"),
  ]},
  { code: "NO", name: { ru: "Норвегия", en: "Norway" }, cities: [
    c("Осло", "Oslo"), c("Берген", "Bergen"), c("Тромсё", "Tromso"),
  ]},
  { code: "FI", name: { ru: "Финляндия", en: "Finland" }, cities: [
    c("Хельсинки", "Helsinki"), c("Рованиеми", "Rovaniemi"), c("Турку", "Turku"),
  ]},
  { code: "DK", name: { ru: "Дания", en: "Denmark" }, cities: [
    c("Копенгаген", "Copenhagen"), c("Орхус", "Aarhus"),
  ]},
  { code: "SI", name: { ru: "Словения", en: "Slovenia" }, cities: [
    c("Любляна", "Ljubljana"), c("Блед", "Bled"), c("Порторож", "Portoroz"),
  ]},
  { code: "SK", name: { ru: "Словакия", en: "Slovakia" }, cities: [
    c("Братислава", "Bratislava"), c("Кошице", "Kosice"),
  ]},
  { code: "RS", name: { ru: "Сербия", en: "Serbia" }, cities: [
    c("Белград", "Belgrade"), c("Нови-Сад", "Novi Sad"),
  ]},
  { code: "BA", name: { ru: "Босния и Герцеговина", en: "Bosnia and Herzegovina" }, cities: [
    c("Сараево", "Sarajevo"), c("Мостар", "Mostar"), c("Баня-Лука", "Banja Luka"),
  ]},
  { code: "AL", name: { ru: "Албания", en: "Albania" }, cities: [
    c("Тирана", "Tirana"), c("Саранда", "Saranda"), c("Дуррес", "Durres"),
    c("Влёра", "Vlore"), c("Корча", "Korce"),
  ]},
  { code: "MK", name: { ru: "Северная Македония", en: "North Macedonia" }, cities: [
    c("Скопье", "Skopje"), c("Охрид", "Ohrid"), c("Битола", "Bitola"),
  ]},
  { code: "MT", name: { ru: "Мальта", en: "Malta" }, cities: [
    c("Валлетта", "Valletta"), c("Слиема", "Sliema"), c("Сент-Джулианс", "St Julians"),
  ]},
  { code: "UA", name: { ru: "Украина", en: "Ukraine" }, cities: [
    c("Киев", "Kyiv"), c("Львов", "Lviv"), c("Одесса", "Odesa"),
    c("Харьков", "Kharkiv"), c("Днепр", "Dnipro"),
  ]},
  { code: "BY", name: { ru: "Беларусь", en: "Belarus" }, cities: [
    c("Минск", "Minsk"), c("Гродно", "Grodno"), c("Брест", "Brest"),
  ]},
  { code: "MD", name: { ru: "Молдова", en: "Moldova" }, cities: [
    c("Кишинёв", "Chisinau"), c("Тирасполь", "Tiraspol"),
  ]},
  { code: "AD", name: { ru: "Андорра", en: "Andorra" }, cities: [
    c("Андорра-ла-Велья", "Andorra la Vella"),
  ]},
  { code: "MC", name: { ru: "Монако", en: "Monaco" }, cities: [
    c("Монако", "Monaco"),
  ]},
  { code: "SM", name: { ru: "Сан-Марино", en: "San Marino" }, cities: [
    c("Сан-Марино", "San Marino"),
  ]},
  { code: "LI", name: { ru: "Лихтенштейн", en: "Liechtenstein" }, cities: [
    c("Вадуц", "Vaduz"),
  ]},
  { code: "XK", name: { ru: "Косово", en: "Kosovo" }, cities: [
    c("Приштина", "Pristina"), c("Призрен", "Prizren"),
  ]},
  // ==================== АЗЕРБАЙДЖАН ====================
  // Уже добавлен выше
  // ==================== РОССИЯ И СНГ ====================
  { code: "KZ", name: { ru: "Казахстан", en: "Kazakhstan" }, cities: [
    c("Алматы", "Almaty"), c("Астана", "Astana"), c("Шымкент", "Shymkent"),
    c("Актобе", "Aktobe"), c("Атырау", "Atyrau"), c("Караганда", "Karaganda"),
  ]},
  { code: "UZ", name: { ru: "Узбекистан", en: "Uzbekistan" }, cities: [
    c("Ташкент", "Tashkent"), c("Самарканд", "Samarkand"), c("Бухара", "Bukhara"),
    c("Хива", "Khiva"), c("Нукус", "Nukus"),
  ]},
  { code: "KG", name: { ru: "Кыргызстан", en: "Kyrgyzstan" }, cities: [
    c("Бишкек", "Bishkek"), c("Иссык-Куль", "Issyk-Kul"), c("Ош", "Osh"),
  ]},
  { code: "TJ", name: { ru: "Таджикистан", en: "Tajikistan" }, cities: [
    c("Душанбе", "Dushanbe"), c("Худжанд", "Khujand"),
  ]},
  { code: "TM", name: { ru: "Туркменистан", en: "Turkmenistan" }, cities: [
    c("Ашхабад", "Ashgabat"), c("Мары", "Mary"),
  ]},
  // ==================== БЛИЖНИЙ ВОСТОК ====================
  { code: "SA", name: { ru: "Саудовская Аравия", en: "Saudi Arabia" }, cities: [
    c("Эр-Рияд", "Riyadh"), c("Джидда", "Jeddah"), c("Мекка", "Mecca"),
    c("Медина", "Medina"), c("Даммам", "Dammam"),
  ]},
  { code: "IL", name: { ru: "Израиль", en: "Israel" }, cities: [
    c("Тель-Авив", "Tel Aviv"), c("Иерусалим", "Jerusalem"), c("Хайфа", "Haifa"),
    c("Эйлат", "Eilat"), c("Нетания", "Netanya"),
  ]},
  { code: "JO", name: { ru: "Иордания", en: "Jordan" }, cities: [
    c("Амман", "Amman"), c("Акаба", "Aqaba"), c("Петра", "Petra"),
  ]},
  { code: "OM", name: { ru: "Оман", en: "Oman" }, cities: [
    c("Маскат", "Muscat"), c("Салала", "Salalah"),
  ]},
  { code: "QA", name: { ru: "Катар", en: "Qatar" }, cities: [
    c("Доха", "Doha"),
  ]},
  { code: "BH", name: { ru: "Бахрейн", en: "Bahrain" }, cities: [
    c("Манама", "Manama"),
  ]},
  { code: "KW", name: { ru: "Кувейт", en: "Kuwait" }, cities: [
    c("Кувейт-Сити", "Kuwait City"),
  ]},
  { code: "LB", name: { ru: "Ливан", en: "Lebanon" }, cities: [
    c("Бейрут", "Beirut"), c("Библей", "Byblos"), c("Бхардон", "Bcharre"),
  ]},
  { code: "IQ", name: { ru: "Ирак", en: "Iraq" }, cities: [
    c("Багдад", "Baghdad"), c("Басра", "Basra"), c("Эрбиль", "Erbil"),
  ]},
  { code: "IR", name: { ru: "Иран", en: "Iran" }, cities: [
    c("Тегеран", "Tehran"), c("Исфахан", "Isfahan"), c("Шираз", "Shiraz"),
    c("Табриз", "Tabriz"), c("Мешхед", "Mashhad"),
  ]},
  { code: "SY", name: { ru: "Сирия", en: "Syria" }, cities: [
    c("Дамаск", "Damascus"), c("Алеппо", "Aleppo"),
  ]},
  { code: "YE", name: { ru: "Йемен", en: "Yemen" }, cities: [
    c("Сана", "Sana'a"), c("Аден", "Aden"),
  ]},
  { code: "PS", name: { ru: "Палестина", en: "Palestine" }, cities: [
    c("Рамалла", "Ramallah"), c("Вифлеем", "Bethlehem"),
  ]},
  // ==================== СЕВЕРНАЯ АФРИКА ====================
  { code: "MA", name: { ru: "Марокко", en: "Morocco" }, cities: [
    c("Марракеш", "Marrakech"), c("Касабланка", "Casablanca"), c("Фес", "Fez"),
    c("Мекнес", "Meknes"), c("Агадир", "Agadir"), c("Шефшауэн", "Chefchaouen"),
    c("Рабат", "Rabat"), c("Танжер", "Tangier"),
  ]},
  { code: "TN", name: { ru: "Тунис", en: "Tunisia" }, cities: [
    c("Тунис", "Tunis"), c("Сусс", "Sousse"), c("Хаммамет", "Hammamet"),
    c("Джерба", "Djerba"), c("Монастир", "Monastir"),
  ]},
  { code: "DZ", name: { ru: "Алжир", en: "Algeria" }, cities: [
    c("Алжир", "Algiers"), c("Оран", "Oran"), c("Константина", "Constantine"),
  ]},
  { code: "LY", name: { ru: "Ливия", en: "Libya" }, cities: [
    c("Триполи", "Tripoli"), c("Бенгази", "Benghazi"),
  ]},
  { code: "SD", name: { ru: "Судан", en: "Sudan" }, cities: [
    c("Хартум", "Khartoum"),
  ]},
  { code: "SS", name: { ru: "Южный Судан", en: "South Sudan" }, cities: [
    c("Джуба", "Juba"),
  ]},
  // ==================== АФРИКА ====================
  { code: "ZA", name: { ru: "ЮАР", en: "South Africa" }, cities: [
    c("Кейптаун", "Cape Town"), c("Йоханнесбург", "Johannesburg"),
    c("Дурбан", "Durban"), c("Претория", "Pretoria"),
  ]},
  { code: "KE", name: { ru: "Кения", en: "Kenya" }, cities: [
    c("Найроби", "Nairobi"), c("Момбаса", "Mombasa"),
  ]},
  { code: "TZ", name: { ru: "Танзания", en: "Tanzania" }, cities: [
    c("Дар-эс-Салам", "Dar es Salaam"), c("Аруш", "Arusha"),
    c("Занзибар", "Zanzibar"),
  ]},
  { code: "NG", name: { ru: "Нигерия", en: "Nigeria" }, cities: [
    c("Лагос", "Lagos"), c("Абуджа", "Abuja"),
  ]},
  { code: "GH", name: { ru: "Гана", en: "Ghana" }, cities: [
    c("Аккра", "Accra"),
  ]},
  { code: "ET", name: { ru: "Эфиопия", en: "Ethiopia" }, cities: [
    c("Аддис-Абеба", "Addis Ababa"),
  ]},
  { code: "UG", name: { ru: "Уганда", en: "Uganda" }, cities: [
    c("Кампала", "Kampala"),
  ]},
  { code: "RW", name: { ru: "Руанда", en: "Rwanda" }, cities: [
    c("Кигали", "Kigali"),
  ]},
  { code: "MZ", name: { ru: "Мозамбик", en: "Mozambique" }, cities: [
    c("Мапуту", "Maputo"),
  ]},
  { code: "MG", name: { ru: "Мадагаскар", en: "Madagascar" }, cities: [
    c("Антананариву", "Antananarivo"),
  ]},
  { code: "MU", name: { ru: "Маврикий", en: "Mauritius" }, cities: [
    c("Порт-Луи", "Port Louis"),
  ]},
  { code: "SC", name: { ru: "Сейшелы", en: "Seychelles" }, cities: [
    c("Виктория", "Victoria"),
  ]},
  { code: "NA", name: { ru: "Намибия", en: "Namibia" }, cities: [
    c("Виндхук", "Windhoek"),
  ]},
  { code: "BW", name: { ru: "Ботсвана", en: "Botswana" }, cities: [
    c("Габороне", "Gaborone"),
  ]},
  { code: "ZM", name: { ru: "Замбия", en: "Zambia" }, cities: [
    c("Лусака", "Lusaka"),
  ]},
  { code: "ZW", name: { ru: "Зимбабве", en: "Zimbabwe" }, cities: [
    c("Хараре", "Harare"),
  ]},
  { code: "SN", name: { ru: "Сенегал", en: "Senegal" }, cities: [
    c("Дакар", "Dakar"),
  ]},
  { code: "CI", name: { ru: "Кот-д'Ивуар", en: "Côte d'Ivoire" }, cities: [
    c("Абиджан", "Abidjan"),
  ]},
  { code: "CM", name: { ru: "Камерун", en: "Cameroon" }, cities: [
    c("Дуала", "Douala"), c("Яунде", "Yaounde"),
  ]},
  { code: "AO", name: { ru: "Ангола", en: "Angola" }, cities: [
    c("Луанда", "Luanda"),
  ]},
  { code: "CG", name: { ru: "Республика Конго", en: "Republic of the Congo" }, cities: [
    c("Браззавиль", "Brazzaville"),
  ]},
  { code: "CD", name: { ru: "ДР Конго", en: "DR Congo" }, cities: [
    c("Киншаса", "Kinshasa"),
  ]},
  { code: "BF", name: { ru: "Буркина-Фасо", en: "Burkina Faso" }, cities: [
    c("Уагадугу", "Ouagadougou"),
  ]},
  { code: "ML", name: { ru: "Мали", en: "Mali" }, cities: [
    c("Бамако", "Bamako"),
  ]},
  { code: "NE", name: { ru: "Нигер", en: "Niger" }, cities: [
    c("Ниамей", "Niamey"),
  ]},
  { code: "TD", name: { ru: "Чад", en: "Chad" }, cities: [
    c("Нджамена", "N'Djamena"),
  ]},
  { code: "ER", name: { ru: "Эритрея", en: "Eritrea" }, cities: [
    c("Асмара", "Asmara"),
  ]},
  { code: "DJ", name: { ru: "Джибути", en: "Djibouti" }, cities: [
    c("Джибути", "Djibouti"),
  ]},
  { code: "SO", name: { ru: "Сомали", en: "Somalia" }, cities: [
    c("Могадишо", "Mogadishu"),
  ]},
  { code: "LR", name: { ru: "Либерия", en: "Liberia" }, cities: [
    c("Монровия", "Monrovia"),
  ]},
  { code: "SL", name: { ru: "Сьерра-Леоне", en: "Sierra Leone" }, cities: [
    c("Фритаун", "Freetown"),
  ]},
  { code: "GN", name: { ru: "Гвинея", en: "Guinea" }, cities: [
    c("Конакри", "Conakry"),
  ]},
  { code: "TG", name: { ru: "Того", en: "Togo" }, cities: [
    c("Ломе", "Lome"),
  ]},
  { code: "BJ", name: { ru: "Бенин", en: "Benin" }, cities: [
    c("Порто-Ново", "Porto-Novo"),
  ]},
  { code: "GA", name: { ru: "Габон", en: "Gabon" }, cities: [
    c("Либревиль", "Libreville"),
  ]},
  { code: "GQ", name: { ru: "Экваториальная Гвинея", en: "Equatorial Guinea" }, cities: [
    c("Малабо", "Malabo"),
  ]},
  { code: "CV", name: { ru: "Кабо-Верде", en: "Cape Verde" }, cities: [
    c("Прая", "Praia"),
  ]},
  { code: "ST", name: { ru: "Сан-Томе и Принсипи", en: "São Tomé and Príncipe" }, cities: [
    c("Сан-Томе", "Sao Tome"),
  ]},
  { code: "KM", name: { ru: "Коморы", en: "Comoros" }, cities: [
    c("Морони", "Moroni"),
  ]},
  { code: "MW", name: { ru: "Малави", en: "Malawi" }, cities: [
    c("Лилонгве", "Lilongwe"),
  ]},
  { code: "SZ", name: { ru: "Эсватини", en: "Eswatini" }, cities: [
    c("Мбабане", "Mbabane"),
  ]},
  { code: "LS", name: { ru: "Лесото", en: "Lesotho" }, cities: [
    c("Масеру", "Maseru"),
  ]},
  { code: "CF", name: { ru: "ЦАР", en: "Central African Republic" }, cities: [
    c("Банги", "Bangui"),
  ]},
  { code: "GM", name: { ru: "Гамбия", en: "Gambia" }, cities: [
    c("Банжул", "Banjul"),
  ]},
  { code: "GW", name: { ru: "Гвинея-Бисау", en: "Guinea-Bissau" }, cities: [
    c("Бисау", "Bissau"),
  ]},
  { code: "MR", name: { ru: "Мавритания", en: "Mauritania" }, cities: [
    c("Нуакшот", "Nouakchott"),
  ]},
  { code: "BI", name: { ru: "Бурунди", en: "Burundi" }, cities: [
    c("Гитега", "Gitega"),
  ]},
  // ==================== АЗИЯ ====================
  { code: "VN", name: { ru: "Вьетнам", en: "Vietnam" }, cities: [
    c("Хо Ши Мин", "Ho Chi Minh City"), c("Ханой", "Hanoi"),
    c("Дананг", "Da Nang"), c("Халонг", "Ha Long"),
    c("Хой-Ан", "Hoi An"), c("Нячанг", "Nha Trang"),
    c("Фу-Куок", "Phu Quoc"), c("Хюэ", "Hue"),
  ]},
  { code: "ID", name: { ru: "Индонезия", en: "Indonesia" }, cities: [
    c("Бали", "Bali"), c("Джакарта", "Jakarta"), c("Ломбок", "Lombok"),
    c("Йогьякарта", "Yogyakarta"), c("Сурабая", "Surabaya"),
    c("Медан", "Medan"), c("Макасар", "Makassar"),
  ]},
  { code: "PH", name: { ru: "Филиппины", en: "Philippines" }, cities: [
    c("Манила", "Manila"), c("Боракай", "Boracay"), c("Себу", "Cebu"),
    c("Палаван", "Palawan"), c("Бохоль", "Bohol"),
  ]},
  { code: "MY", name: { ru: "Малайзия", en: "Malaysia" }, cities: [
    c("Куала-Лумпур", "Kuala Lumpur"), c("Лангкави", "Langkawi"),
    c("Пенанг", "Penang"), c("Кота-Кинабалу", "Kota Kinabalu"),
  ]},
  { code: "SG", name: { ru: "Сингапур", en: "Singapore" }, cities: [
    c("Сингапур", "Singapore"),
  ]},
  { code: "KH", name: { ru: "Камбоджа", en: "Cambodia" }, cities: [
    c("Пномпень", "Phnom Penh"), c("Сиемреап", "Siem Reap"),
  ]},
  { code: "MM", name: { ru: "Мьянма", en: "Myanmar" }, cities: [
    c("Янгон", "Yangon"), c("Мандалай", "Mandalay"),
  ]},
  { code: "LA", name: { ru: "Лаос", en: "Laos" }, cities: [
    c("Луангпхабанг", "Luang Prabang"), c("Вьентьян", "Vientiane"),
  ]},
  { code: "LK", name: { ru: "Шри-Ланка", en: "Sri Lanka" }, cities: [
    c("Коломбо", "Colombo"), c("Канди", "Kandy"), c("Галле", "Galle"),
  ]},
  { code: "MV", name: { ru: "Мальдивы", en: "Maldives" }, cities: [
    c("Мале", "Male"),
  ]},
  { code: "IN", name: { ru: "Индия", en: "India" }, cities: [
    c("Дели", "Delhi"), c("Мумбаи", "Mumbai"), c("Джайпур", "Jaipur"),
    c("Гоа", "Goa"), c("Агра", "Agra"), c("Бенарес", "Varanasi"),
    c("Керала", "Kerala"), c("Удайпур", "Udaipur"), c("Дарджилинг", "Darjeeling"),
  ]},
  { code: "NP", name: { ru: "Непал", en: "Nepal" }, cities: [
    c("Катманду", "Kathmandu"), c("Покхара", "Pokhara"),
  ]},
  { code: "BD", name: { ru: "Бангладеш", en: "Bangladesh" }, cities: [
    c("Дакка", "Dhaka"), c("Читтагонг", "Chittagong"),
  ]},
  { code: "JP", name: { ru: "Япония", en: "Japan" }, cities: [
    c("Токио", "Tokyo"), c("Осака", "Osaka"), c("Киото", "Kyoto"),
    c("Хиросима", "Hiroshima"), c("Нара", "Nara"), c("Фукуока", "Fukuoka"),
    c("Саппоро", "Sapporo"), c("Никко", "Nikko"),
  ]},
  { code: "CN", name: { ru: "Китай", en: "China" }, cities: [
    c("Пекин", "Beijing"), c("Шанхай", "Shanghai"), c("Гуанчжоу", "Guangzhou"),
    c("Шэньчжэнь", "Shenzhen"), c("Чэнду", "Chengdu"), c("Сиань", "Xian"),
    c("Ханчжоу", "Hangzhou"), c("Куньмин", "Kunming"),
  ]},
  { code: "KR", name: { ru: "Южная Корея", en: "South Korea" }, cities: [
    c("Сеул", "Seoul"), c("Пусан", "Busan"), c("Инчхон", "Incheon"),
    c("Чеджу", "Jeju"),
  ]},
  { code: "KP", name: { ru: "Северная Корея", en: "North Korea" }, cities: [
    c("Пхеньян", "Pyongyang"),
  ]},
  { code: "TW", name: { ru: "Тайвань", en: "Taiwan" }, cities: [
    c("Тайбэй", "Taipei"), c("Гаосюн", "Kaohsiung"),
  ]},
  { code: "MN", name: { ru: "Монголия", en: "Mongolia" }, cities: [
    c("Улан-Батор", "Ulaanbaatar"),
  ]},
  { code: "PK", name: { ru: "Пакистан", en: "Pakistan" }, cities: [
    c("Исламабад", "Islamabad"), c("Карачи", "Karachi"),
  ]},
  { code: "AF", name: { ru: "Афганистан", en: "Afghanistan" }, cities: [
    c("Кабул", "Kabul"),
  ]},
  { code: "BN", name: { ru: "Бруней", en: "Brunei" }, cities: [
    c("Бандар-Сери-Бегаван", "Bandar Seri Begawan"),
  ]},
  { code: "BT", name: { ru: "Бутан", en: "Bhutan" }, cities: [
    c("Тхимпху", "Thimphu"),
  ]},
  { code: "TL", name: { ru: "Восточный Тимор", en: "East Timor" }, cities: [
    c("Дили", "Dili"),
  ]},
  // ==================== АМЕРИКИ ====================
  { code: "US", name: { ru: "США", en: "USA" }, cities: [
    c("Нью-Йорк", "New York"), c("Лос-Анджелес", "Los Angeles"),
    c("Лас-Вегас", "Las Vegas"), c("Майами", "Miami"),
    c("Сан-Франциско", "San Francisco"), c("Чикаго", "Chicago"),
    c("Вашингтон", "Washington"), c("Бостон", "Boston"),
    c("Сиэтл", "Seattle"), c("Сан-Диего", "San Diego"),
  ]},
  { code: "CA", name: { ru: "Канада", en: "Canada" }, cities: [
    c("Торонто", "Toronto"), c("Ванкувер", "Vancouver"),
    c("Монтреаль", "Montreal"), c("Калгари", "Calgary"),
  ]},
  { code: "MX", name: { ru: "Мексика", en: "Mexico" }, cities: [
    c("Мехико", "Mexico City"), c("Канкун", "Cancun"),
    c("Пуэрто-Вальярта", "Puerto Vallarta"), c("Акапулько", "Acapulco"),
    c("Гвадалахара", "Guadalajara"), c("Оахака", "Oaxaca"),
  ]},
  { code: "CU", name: { ru: "Куба", en: "Cuba" }, cities: [
    c("Гавана", "Havana"), c("Варадеро", "Varadero"),
    c("Тринидад", "Trinidad"), c("Сантьяго-де-Куба", "Santiago de Cuba"),
  ]},
  { code: "DO", name: { ru: "Доминиканская Республика", en: "Dominican Republic" }, cities: [
    c("Пунта-Кана", "Punta Cana"), c("Санто-Доминго", "Santo Domingo"),
    c("Пуэрто-Плата", "Puerto Plata"), c("Самана", "Samaná"),
  ]},
  { code: "JM", name: { ru: "Ямайка", en: "Jamaica" }, cities: [
    c("Монтего-Бей", "Montego Bay"), c("Кингстон", "Kingston"),
    c("Очо-Риос", "Ocho Rios"),
  ]},
  { code: "PR", name: { ru: "Пуэрто-Рико", en: "Puerto Rico" }, cities: [
    c("Сан-Хуан", "San Juan"),
  ]},
  { code: "BB", name: { ru: "Барбадос", en: "Barbados" }, cities: [
    c("Бриджтаун", "Bridgetown"),
  ]},
  { code: "BS", name: { ru: "Багамы", en: "Bahamas" }, cities: [
    c("Нассау", "Nassau"),
  ]},
  { code: "AG", name: { ru: "Антигуа и Барбуда", en: "Antigua and Barbuda" }, cities: [
    c("Сент-Джонс", "St John's"),
  ]},
  { code: "KN", name: { ru: "Сент-Китс и Невис", en: "Saint Kitts and Nevis" }, cities: [
    c("Бастер", "Basseterre"),
  ]},
  { code: "LC", name: { ru: "Сент-Люсия", en: "Saint Lucia" }, cities: [
    c("Кастриз", "Castries"),
  ]},
  { code: "VC", name: { ru: "Сент-Винсент и Гренадины", en: "Saint Vincent and the Grenadines" }, cities: [
    c("Кингстаун", "Kingstown"),
  ]},
  { code: "GD", name: { ru: "Гренада", en: "Grenada" }, cities: [
    c("Сент-Джорджес", "St George's"),
  ]},
  { code: "TT", name: { ru: "Тринидад и Тобаго", en: "Trinidad and Tobago" }, cities: [
    c("Порт-оф-Спейн", "Port of Spain"),
  ]},
  { code: "CR", name: { ru: "Коста-Рика", en: "Costa Rica" }, cities: [
    c("Сан-Хосе", "San Jose"), c("Лимон", "Limon"),
  ]},
  { code: "PA", name: { ru: "Панама", en: "Panama" }, cities: [
    c("Панама", "Panama City"),
  ]},
  { code: "GT", name: { ru: "Гватемала", en: "Guatemala" }, cities: [
    c("Гватемала", "Guatemala City"), c("Антigua", "Antigua Guatemala"),
  ]},
  { code: "HN", name: { ru: "Гондурас", en: "Honduras" }, cities: [
    c("Тегусигальпа", "Tegucigalpa"), c("Роатан", "Roatan"),
  ]},
  { code: "SV", name: { ru: "Сальвадор", en: "El Salvador" }, cities: [
    c("Сан-Сальвадор", "San Salvador"),
  ]},
  { code: "NI", name: { ru: "Никарагуа", en: "Nicaragua" }, cities: [
    c("Манагуа", "Managua"),
  ]},
  { code: "BZ", name: { ru: "Белиз", en: "Belize" }, cities: [
    c("Бельмопан", "Belmopan"),
  ]},
  { code: "AR", name: { ru: "Аргентина", en: "Argentina" }, cities: [
    c("Буэнос-Айрес", "Buenos Aires"), c("Мендоса", "Mendoza"),
    c("Барилоче", "Bariloche"), c("Ушуайя", "Ushuaia"),
  ]},
  { code: "BR", name: { ru: "Бразилия", en: "Brazil" }, cities: [
    c("Рио-де-Жанейро", "Rio de Janeiro"), c("Сан-Паулу", "Sao Paulo"),
    c("Сальвадор", "Salvador"), c("Форталеза", "Fortaleza"),
    c("Бразилиа", "Brasilia"), c("Ресифи", "Recife"),
  ]},
  { code: "CL", name: { ru: "Чили", en: "Chile" }, cities: [
    c("Сантьяго", "Santiago"), c("Вальпараисо", "Valparaiso"),
    c("Пунта-Аренас", "Punta Arenas"),
  ]},
  { code: "CO", name: { ru: "Колумбия", en: "Colombia" }, cities: [
    c("Богота", "Bogota"), c("Медельин", "Medellin"), c("Кали", "Cali"),
    c("Картагена", "Cartagena"),
  ]},
  { code: "PE", name: { ru: "Перу", en: "Peru" }, cities: [
    c("Лима", "Lima"), c("Куско", "Cusco"), c("Арекипа", "Arequipa"),
  ]},
  { code: "EC", name: { ru: "Эквадор", en: "Ecuador" }, cities: [
    c("Кито", "Quito"), c("Гуаякиль", "Guayaquil"),
  ]},
  { code: "BO", name: { ru: "Боливия", en: "Bolivia" }, cities: [
    c("Ла-Пас", "La Paz"), c("Сукре", "Sucre"),
  ]},
  { code: "UY", name: { ru: "Уругвай", en: "Uruguay" }, cities: [
    c("Монтевидео", "Montevideo"),
  ]},
  { code: "PY", name: { ru: "Парагвай", en: "Paraguay" }, cities: [
    c("Асунсьон", "Asuncion"),
  ]},
  { code: "VE", name: { ru: "Венесуэла", en: "Venezuela" }, cities: [
    c("Каракас", "Caracas"),
  ]},
  { code: "GY", name: { ru: "Гайана", en: "Guyana" }, cities: [
    c("Джорджтаун", "Georgetown"),
  ]},
  { code: "SR", name: { ru: "Суринам", en: "Suriname" }, cities: [
    c("Парамарибо", "Paramaribo"),
  ]},
  // ==================== АВСТРАЛИЯ И ОКЕАНИЯ ====================
  { code: "AU", name: { ru: "Австралия", en: "Australia" }, cities: [
    c("Сидней", "Sydney"), c("Мельбурн", "Melbourne"),
    c("Брисбен", "Brisbane"), c("Перт", "Perth"),
    c("Аделаида", "Adelaide"), c("Голд-Кост", "Gold Coast"),
  ]},
  { code: "NZ", name: { ru: "Новая Зеландия", en: "New Zealand" }, cities: [
    c("Окленд", "Auckland"), c("Веллингтон", "Wellington"),
    c("Крайстчёрч", "Christchurch"), c("Квинстаун", "Queenstown"),
  ]},
  { code: "FJ", name: { ru: "Фиджи", en: "Fiji" }, cities: [
    c("Сува", "Suva"), c("Нади", "Nadi"),
  ]},
  { code: "PG", name: { ru: "Папуа — Новая Гвинея", en: "Papua New Guinea" }, cities: [
    c("Порт-Морсби", "Port Moresby"),
  ]},
  { code: "WS", name: { ru: "Самоа", en: "Samoa" }, cities: [
    c("Апиа", "Apia"),
  ]},
  { code: "TO", name: { ru: "Тонга", en: "Tonga" }, cities: [
    c("Нукуалофа", "Nuku'alofa"),
  ]},
  { code: "VU", name: { ru: "Вануату", en: "Vanuatu" }, cities: [
    c("Порт-Вила", "Port Vila"),
  ]},
  { code: "SB", name: { ru: "Соломоновы Острова", en: "Solomon Islands" }, cities: [
    c("Хониара", "Honiara"),
  ]},
  { code: "KI", name: { ru: "Кирибати", en: "Kiribati" }, cities: [
    c("Тарава", "Tarawa"),
  ]},
  { code: "PW", name: { ru: "Палау", en: "Palau" }, cities: [
    c("Корор", "Koror"),
  ]},
  { code: "MH", name: { ru: "Маршалловы Острова", en: "Marshall Islands" }, cities: [
    c("Маджуро", "Majuro"),
  ]},
  { code: "FM", name: { ru: "Микронезия", en: "Micronesia" }, cities: [
    c("Паликир", "Palikir"),
  ]},
  { code: "NR", name: { ru: "Науру", en: "Nauru" }, cities: [
    c("Ярен", "Yaren"),
  ]},
  { code: "TV", name: { ru: "Тувалу", en: "Tuvalu" }, cities: [
    c("Фунафути", "Funafuti"),
  ]},
  // ==================== ДОПОЛНИТЕЛЬНЫЕ СТРАНЫ ====================
  { code: "AM", name: { ru: "Армения", en: "Armenia" }, cities: [
    c("Ереван", "Yerevan"), c("Гюмри", "Gyumri"),
  ]},
  { code: "LV", name: { ru: "Латвия", en: "Latvia" }, cities: [
    c("Рига", "Riga"), c("Юрмала", "Jurmala"),
  ]},
  { code: "LT", name: { ru: "Литва", en: "Lithuania" }, cities: [
    c("Вильнюс", "Vilnius"), c("Каунас", "Kaunas"),
  ]},
  { code: "EE", name: { ru: "Эстония", en: "Estonia" }, cities: [
    c("Таллин", "Tallinn"), c("Тарту", "Tartu"),
  ]},
  { code: "KH", name: { ru: "Камбоджа", en: "Cambodia" }, cities: [
    c("Пномпень", "Phnom Penh"), c("Сиемреап", "Siem Reap"),
  ]},
  { code: "MM", name: { ru: "Мьянма", en: "Myanmar" }, cities: [
    c("Янгон", "Yangon"),
  ]},
  { code: "LA", name: { ru: "Лаос", en: "Laos" }, cities: [
    c("Луангпхабанг", "Luang Prabang"),
  ]},
  { code: "BN", name: { ru: "Бруней", en: "Brunei" }, cities: [
    c("Бандар-Сери-Бегаван", "Bandar Seri Begawan"),
  ]},
  { code: "TL", name: { ru: "Восточный Тимор", en: "East Timor" }, cities: [
    c("Дили", "Dili"),
  ]},
  { code: "BT", name: { ru: "Бутан", en: "Bhutan" }, cities: [
    c("Тхимпху", "Thimphu"),
  ]},
  { code: "MN", name: { ru: "Монголия", en: "Mongolia" }, cities: [
    c("Улан-Батор", "Ulaanbaatar"),
  ]},
  { code: "NP", name: { ru: "Непал", en: "Nepal" }, cities: [
    c("Катманду", "Kathmandu"), c("Покхара", "Pokhara"),
  ]},
  { code: "BD", name: { ru: "Бангладеш", en: "Bangladesh" }, cities: [
    c("Дакка", "Dhaka"),
  ]},
  { code: "PK", name: { ru: "Пакистан", en: "Pakistan" }, cities: [
    c("Исламабад", "Islamabad"), c("Карачи", "Karachi"),
  ]},
  { code: "AF", name: { ru: "Афганистан", en: "Afghanistan" }, cities: [
    c("Кабул", "Kabul"),
  ]},
  { code: "IQ", name: { ru: "Ирак", en: "Iraq" }, cities: [
    c("Багдад", "Baghdad"), c("Басра", "Basra"),
  ]},
  { code: "IR", name: { ru: "Иран", en: "Iran" }, cities: [
    c("Тегеран", "Tehran"), c("Исфахан", "Isfahan"), c("Шираз", "Shiraz"),
  ]},
  { code: "SY", name: { ru: "Сирия", en: "Syria" }, cities: [
    c("Дамаск", "Damascus"),
  ]},
  { code: "YE", name: { ru: "Йемен", en: "Yemen" }, cities: [
    c("Сана", "Sana'a"),
  ]},
  { code: "LB", name: { ru: "Ливан", en: "Lebanon" }, cities: [
    c("Бейрут", "Beirut"),
  ]},
  { code: "JO", name: { ru: "Иордания", en: "Jordan" }, cities: [
    c("Амман", "Amman"), c("Акаба", "Aqaba"),
  ]},
  { code: "IL", name: { ru: "Израиль", en: "Israel" }, cities: [
    c("Тель-Авив", "Tel Aviv"), c("Иерусалим", "Jerusalem"),
  ]},
  { code: "SA", name: { ru: "Саудовская Аравия", en: "Saudi Arabia" }, cities: [
    c("Эр-Рияд", "Riyadh"), c("Джидда", "Jeddah"), c("Мекка", "Mecca"),
  ]},
  { code: "AE", name: { ru: "ОАЭ", en: "UAE" }, cities: [
    c("Дубай", "Dubai"), c("Абу-Даби", "Abu Dhabi"),
  ]},
  { code: "QA", name: { ru: "Катар", en: "Qatar" }, cities: [
    c("Доха", "Doha"),
  ]},
  { code: "BH", name: { ru: "Бахрейн", en: "Bahrain" }, cities: [
    c("Манама", "Manama"),
  ]},
  { code: "KW", name: { ru: "Кувейт", en: "Kuwait" }, cities: [
    c("Кувейт-Сити", "Kuwait City"),
  ]},
  { code: "OM", name: { ru: "Оман", en: "Oman" }, cities: [
    c("Маскат", "Muscat"),
  ]},
  { code: "PS", name: { ru: "Палестина", en: "Palestine" }, cities: [
    c("Рамалла", "Ramallah"),
  ]},
  // Дополнительные европейские
  { code: "LU", name: { ru: "Люксембург", en: "Luxembourg" }, cities: [
    c("Люксембург", "Luxembourg"),
  ]},
  { code: "CY", name: { ru: "Кипр", en: "Cyprus" }, cities: [
    c("Ларнака", "Larnaca"), c("Пафос", "Paphos"),
  ]},
  { code: "MT", name: { ru: "Мальта", en: "Malta" }, cities: [
    c("Валлетта", "Valletta"),
  ]},
  { code: "IS", name: { ru: "Исландия", en: "Iceland" }, cities: [
    c("Рейкьявик", "Reykjavik"),
  ]},
  { code: "NO", name: { ru: "Норвегия", en: "Norway" }, cities: [
    c("Осло", "Oslo"), c("Берген", "Bergen"),
  ]},
  { code: "SE", name: { ru: "Швеция", en: "Sweden" }, cities: [
    c("Стокгольм", "Stockholm"),
  ]},
  { code: "DK", name: { ru: "Дания", en: "Denmark" }, cities: [
    c("Копенгаген", "Copenhagen"),
  ]},
  { code: "FI", name: { ru: "Финляндия", en: "Finland" }, cities: [
    c("Хельсинки", "Helsinki"), c("Рованиеми", "Rovaniemi"),
  ]},
  { code: "IE", name: { ru: "Ирландия", en: "Ireland" }, cities: [
    c("Дублин", "Dublin"),
  ]},
  { code: "NL", name: { ru: "Нидерланды", en: "Netherlands" }, cities: [
    c("Амстердам", "Amsterdam"),
  ]},
  { code: "BE", name: { ru: "Бельгия", en: "Belgium" }, cities: [
    c("Брюссель", "Brussels"), c("Брюгге", "Bruges"),
  ]},
  { code: "CH", name: { ru: "Швейцария", en: "Switzerland" }, cities: [
    c("Цюрих", "Zurich"), c("Женева", "Geneva"),
  ]},
  { code: "AT", name: { ru: "Австрия", en: "Austria" }, cities: [
    c("Вена", "Vienna"), c("Зальцбург", "Salzburg"),
  ]},
  { code: "CZ", name: { ru: "Чехия", en: "Czech Republic" }, cities: [
    c("Прага", "Prague"),
  ]},
  { code: "PL", name: { ru: "Польша", en: "Poland" }, cities: [
    c("Варшава", "Warsaw"), c("Краков", "Krakow"),
  ]},
  { code: "HU", name: { ru: "Венгрия", en: "Hungary" }, cities: [
    c("Будапешт", "Budapest"),
  ]},
  { code: "RO", name: { ru: "Румыния", en: "Romania" }, cities: [
    c("Бухарест", "Bucharest"), c("Брашов", "Brasov"),
  ]},
  { code: "BG", name: { ru: "Болгария", en: "Bulgaria" }, cities: [
    c("София", "Sofia"), c("Варна", "Varna"),
  ]},
  { code: "HR", name: { ru: "Хорватия", en: "Croatia" }, cities: [
    c("Дубровник", "Dubrovnik"), c("Сплит", "Split"),
  ]},
  { code: "SI", name: { ru: "Словения", en: "Slovenia" }, cities: [
    c("Любляна", "Ljubljana"), c("Блед", "Bled"),
  ]},
  { code: "SK", name: { ru: "Словакия", en: "Slovakia" }, cities: [
    c("Братислава", "Bratislava"),
  ]},
  { code: "RS", name: { ru: "Сербия", en: "Serbia" }, cities: [
    c("Белград", "Belgrade"),
  ]},
  { code: "BA", name: { ru: "Босния и Герцеговина", en: "Bosnia and Herzegovina" }, cities: [
    c("Сараево", "Sarajevo"),
  ]},
  { code: "AL", name: { ru: "Албания", en: "Albania" }, cities: [
    c("Тирана", "Tirana"),
  ]},
  { code: "MK", name: { ru: "Северная Македония", en: "North Macedonia" }, cities: [
    c("Скопье", "Skopje"),
  ]},
  { code: "ME", name: { ru: "Черногория", en: "Montenegro" }, cities: [
    c("Подгорица", "Podgorica"), c("Будва", "Budva"),
  ]},
  { code: "XK", name: { ru: "Косово", en: "Kosovo" }, cities: [
    c("Приштина", "Pristina"),
  ]},
  { code: "AD", name: { ru: "Андорра", en: "Andorra" }, cities: [
    c("Андорра-ла-Велья", "Andorra la Vella"),
  ]},
  { code: "MC", name: { ru: "Монако", en: "Monaco" }, cities: [
    c("Монако", "Monaco"),
  ]},
  { code: "SM", name: { ru: "Сан-Марино", en: "San Marino" }, cities: [
    c("Сан-Марино", "San Marino"),
  ]},
  { code: "LI", name: { ru: "Лихтенштейн", en: "Liechtenstein" }, cities: [
    c("Вадуц", "Vaduz"),
  ]},
];

/** Search countries by query string */
export function searchCountries(query: string): CountryData[] {
  const q = query.toLowerCase();
  return countriesDatabase.filter(
    (c) =>
      c.name.ru.toLowerCase().includes(q) ||
      c.name.en.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
  );
}

/** Get localized country name */
export function getCountryName(country: CountryData, locale: string = "ru"): string {
  return country.name[locale as keyof typeof country.name] || country.name.en;
}

/** Get localized city name */
export function getCityName(city: City, locale: string = "ru"): string {
  return city.name[locale as keyof typeof city.name] || city.name.en;
}

/** Get cities for a list of country codes */
export function getCitiesForCountries(countryCodes: string[]): { name: string; countryCode: string; country: string }[] {
  const cities: { name: string; countryCode: string; country: string }[] = [];
  for (const code of countryCodes) {
    const country = countriesDatabase.find((c) => c.code === code);
    if (country) {
      for (const city of country.cities) {
        cities.push({
          name: city.name.ru,
          countryCode: country.code,
          country: country.name.ru,
        });
      }
    }
  }
  return cities;
}

// Deduplicate by country code — keep first occurrence.
// Also dedupe cities per country by Russian name: the raw DB contains duplicate
// city names (e.g. Turkey has "Олюдениз" twice with different latin spellings),
// which otherwise breaks React keys and the City unique constraint.
export const countriesDatabase: CountryData[] = _countriesRaw
  .filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i)
  .map((c) => ({
    ...c,
    cities: c.cities.filter(
      (city, i, arr) => arr.findIndex((x) => x.name.ru === city.name.ru) === i
    ),
  }));
