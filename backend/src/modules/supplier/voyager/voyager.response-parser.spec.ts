import {
  extractHtmlFromJs,
  isCaptchaResponse,
  isNoDataResponse,
  parseChecklistbox,
  parsePriceRows,
  parseSelectOptions,
  parseTotalPages,
} from "./voyager.response-parser";

/**
 * Voyager parser tests — the row fixture is a REAL price_info row captured
 * from online.voyagergroup.az/search_tour PRICES (verified live 2026-10-21).
 * The form fixtures mirror the real checklistbox/select markup of the same
 * engine.
 */

const PRICE_ROW_HTML = `
<tr class="even price_info white_row stats freight-external   stateFromKey-14 townFromKey-34 stateKey-33 checkIn-20261022 nights-5 hnights-4 tourKey-2993 spoKey-630141 programTypeKey-1 hotelKey-23597 htPlaceKey-49775 roomKey-24593 mealKey-4 adult-3 child-1"
            data-townfrom="34" data-state="33"
            data-checkin="20261022" data-nights="5"
            data-hnights="4" data-cat-claim="0x430A0000000E00000000220000002100000BB1000000002986449BB4EB000000099D7D0500005C2D000060110000C26F0000000400000000000000000000000100000000B4F00000040000000002A7EE80000000020502030001050BB4EC0000B4F0000005000000000700000000000000000000000000000000000000000000000000000F9C" data-packet-type="0"
            data-hotel="23597" data-statefrom="14"
            data-hotel-lat="" data-hotel-lng=""
            data-tour="2993" data-ptype="1" data-meal="4"
            data-room="24593" data-htplace="49775">
            <td>
                            </td>
                        <td data-head="с" class="arrival sortie">
                <div class="samo_format_date" data-date="22.10.2026" data-lang="ru">22.10.2026</div>
                            </td>
                        <td class="tour">
                Baku-Kuala Lumpur (Malaysia/Air Arabia)
                <br>
                <span class="tr tr_2993">
                    <img src="/data/search_tour/tr_2993_973735520.png?rev=4091891869"  alt="">
                </span>
            </td>
            <td data-head="на" data-head-suffix="Ночей" class="c tour-nights">
                                    4<span
                        class="helpalt price-additional-nights"
                        data-popup="ночей в дороге">+1</span>
            </td>
                <td class="link-hotel">
                                            <span class="helpalt additional" data-popup="показать состав пакета"></span>
                                                                Metro Hotel @ KL Sentral 2*
                                        (Kuala Lumpur)
                                    </td>
                <td class="nw hotel-seats">
                    <span title="по запросу" class="hotel_availability helpalt hotel_availability_R"></span><span title="по запросу" class="hotel_availability helpalt hotel_availability_R"></span>
                </td>
                                <td class="hotel-meals">
                                            BB
                                    </td>
                <td class="hotel-room">
                    <span class="">Family Triple / 3ADL+CHD(5-11,99)E-BED
                                            </span>
                </td>
                <td class="r nw attributes">
                                                            <span class="marker">&nbsp;</span>
                </td>
            <td class="c nw statistic"><span class="stats helpalt" data-helpalt-arrow="hide" data-popup="Динамика цены, наличие мест">&nbsp;</span></td>
                        <td class="td_price">
                    <span data-cat-price="4456" data-cat-price_old=""
                          data-converted_price_old="" data-cat-currency="2"
                          data-converted-price-number="4456"
                          data-currency="2"
                          data-currency_title="USD"
                          data-head="от"
                          class="price   bron price_button">
                    4&#8239;456&nbsp;USD
                    </span>
            </td>
                            <td class="commission"><span class="percent helpalt icon-info" data-popup="посмотреть скидки"></span></td>
                        <td class="external-info">
                            </td>
            <td data-head="Инфо" class="type_price">
                <span class="toggle-text">Kuala Lumpur-100-STD+ GDS</span>
            </td>
                            <td class="nw transport">
                    <div class="transport"><span class="name">Эконом</span><span class="fr_place_r Y helpalt" data-helpalt-arrow="hide" title="есть места"></span><span class="fr_place_l Y helpalt"  data-helpalt-arrow="hide" title="есть места"></span></div>
                </td>
                    </tr>`;

// Stop-sale variant: same row, no seats + stop-sale class.
const STOP_SALE_ROW_HTML = PRICE_ROW_HTML.replace(
  /fr_place_[rl] Y/g,
  "fr_place_[rl] N",
)
  .replace(/title="есть места"/g, 'title="нет мест"')
  .replace("white_row", "red_row")
  .replace("spoKey-630141", "spoKey-630142");

const PAGER_HTML = `
<div class="pager">
  <span class="page current" data-page="1">1</span>
  <span class="page" data-page="2">2</span>
  <span class="page" data-page="11">11</span>
</div>`;

const EHTML_ENVELOPE =
  'samo.jQuery(samo.controls.resultset).ehtml("' +
  PRICE_ROW_HTML.replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n") +
  '");';

const FORM_HTML = `
<select name="STATEINC" class="STATEINC" autocomplete="off">
    <option value="13" selected>ОАЭ</option>
    <option value="23">Тайланд</option>
    <option value="0">----</option>
</select>
<select name="TOURINC" class="TOURINC" autocomplete="off">
    <option value="0">----</option>
    <option value="2865">Baku - Dubai (UAE/FLYDUBAI)</option>
    <option value="2993">Baku-Kuala Lumpur (Malaysia/Air Arabia)</option>
</select>
<div class="checklistbox TOWNS" name="TOWNS">
    <div class="groupboxChildren">
        <label><input type="checkbox" value="2483"/>Dubai (Al Jaddaf)</label>
    </div>
    <div class="groupboxChildren">
        <label><input type="checkbox" value="13"/>Дубай</label>
    </div>
</div>
<div class="checklistbox STARS" name="STARS">
    <div class="groupboxChildren"><label><input type="checkbox" value="10011"/>4*</label></div>
    <div class="groupboxChildren"><label><input type="checkbox" value="10012"/>5*</label></div>
    <div class="groupboxChildren"><label><input type="checkbox" value="10013"/>Apartments</label></div>
</div>
<div class="checklistbox MEALS " name="MEALS">
    <div class="groupboxChildren"><label><input type="checkbox" value="10001"/>AI</label></div>
    <div class="groupboxChildren"><label><input type="checkbox" value="10002"/>BB</label></div>
</div>
`;

describe("Voyager response parser", () => {
  describe("parsePriceRows (real row fixture)", () => {
    const rows = parsePriceRows(PRICE_ROW_HTML);

    it("parses exactly one row", () => {
      expect(rows).toHaveLength(1);
    });

    it("extracts the SAMO class keys", () => {
      const r = rows[0];
      expect(r.hotelKey).toBe("23597");
      expect(r.spoKey).toBe("630141");
      expect(r.tourKey).toBe("2993");
      expect(r.mealKey).toBe("4");
      expect(r.roomKey).toBe("24593");
      expect(r.nights).toBe(5);
      expect(r.checkIn).toBe("20261022");
      expect(r.adults).toBe(3);
      expect(r.children).toBe(1);
      expect(r.claim).toMatch(/^0x430A/);
    });

    it("strips the city suffix from the hotel name (keeps the star)", () => {
      expect(rows[0].hotel).toBe("Metro Hotel @ KL Sentral 2*");
    });

    it("reads the converted price + currency (CURRENCY=2 → USD)", () => {
      expect(rows[0].price).toBe(4456);
      expect(rows[0].currency).toBe("USD");
    });

    it("reads the departure date from samo_format_date data-date", () => {
      expect(rows[0].departureDateText).toBe("22.10.2026");
    });

    it("reads the bare hotel-meals cell", () => {
      expect(rows[0].mealText).toBe("BB");
    });

    it("reads the room text", () => {
      expect(rows[0].roomText).toBe("Family Triple / 3ADL+CHD(5-11,99)E-BED");
    });

    it("reads the program name from the tour cell (not tour-nights)", () => {
      expect(rows[0].tourText).toBe("Baku-Kuala Lumpur (Malaysia/Air Arabia)");
    });

    it("reads the transport class", () => {
      expect(rows[0].transport).toBe("Эконом");
    });

    it("marks seats available via fr_place markers", () => {
      expect(rows[0].seatsAvailable).toBe(true);
      expect(rows[0].stopSale).toBe(false);
    });
  });

  it("marks stop-sale rows (red_row + no seats)", () => {
    const rows = parsePriceRows(STOP_SALE_ROW_HTML);
    expect(rows).toHaveLength(1);
    expect(rows[0].stopSale).toBe(true);
    expect(rows[0].seatsAvailable).toBe(false);
    expect(rows[0].spoKey).toBe("630142");
  });

  it("skips rows without identity or price", () => {
    const junk = PRICE_ROW_HTML.replace(/data-cat-claim="[^"]*"/, 'data-cat-claim=""')
      .replace("hotelKey-23597", "hotelKeyX")
      .replace("spoKey-630141", "spoKeyX")
      .replace('data-hotel="23597"', 'data-hotel=""')
      .replace('data-converted-price-number="4456"', 'data-converted-price-number=""')
      .replace('data-cat-price="4456"', 'data-cat-price=""');
    expect(parsePriceRows(junk)).toHaveLength(0);
  });

  describe("extractHtmlFromJs", () => {
    it("extracts and unescapes the ehtml payload", () => {
      const html = extractHtmlFromJs(EHTML_ENVELOPE);
      expect(html).toContain('class="link-hotel"');
      expect(html).not.toContain("\\n");
      expect(parsePriceRows(html!)).toHaveLength(1);
    });

    it("returns null when the envelope is missing", () => {
      expect(extractHtmlFromJs("<html>no envelope</html>")).toBeNull();
    });
  });

  describe("isNoDataResponse / isCaptchaResponse", () => {
    it("detects the explicit «Нет данных» answer (escaped form)", () => {
      expect(isNoDataResponse('samo.jQuery(x).ehtml("\\u041d\\u0435\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445")')).toBe(true);
      expect(isNoDataResponse("<div>Нет данных</div>")).toBe(true);
    });

    it("does NOT treat an envelope without rows as «no data»", () => {
      expect(isNoDataResponse(EHTML_ENVELOPE)).toBe(false);
    });

    it("detects captcha/antibot challenges", () => {
      expect(isCaptchaResponse('<div id="captchaForm">'),).toBe(true);
      expect(isCaptchaResponse("samo_action=antibot")).toBe(true);
      expect(isCaptchaResponse(EHTML_ENVELOPE)).toBe(false);
    });
  });

  describe("parseTotalPages", () => {
    it("takes the max data-page of the pager", () => {
      expect(parseTotalPages("", PAGER_HTML)).toBe(11);
      expect(parseTotalPages("", "")).toBe(1);
    });
  });

  describe("form dictionary helpers", () => {
    it("parses STATEINC options skipping the zero entry", () => {
      const states = parseSelectOptions(FORM_HTML, "STATEINC", true);
      expect(states).toEqual([
        { value: "13", name: "ОАЭ" },
        { value: "23", name: "Тайланд" },
      ]);
    });

    it("parses TOURINC programs", () => {
      const programs = parseSelectOptions(FORM_HTML, "TOURINC", true);
      expect(programs).toEqual([
        { value: "2865", name: "Baku - Dubai (UAE/FLYDUBAI)" },
        { value: "2993", name: "Baku-Kuala Lumpur (Malaysia/Air Arabia)" },
      ]);
    });

    it("parses checklistbox STARS/MEALS/TOWNS", () => {
      expect(parseChecklistbox(FORM_HTML, "STARS")).toEqual([
        { value: "10011", name: "4*" },
        { value: "10012", name: "5*" },
        { value: "10013", name: "Apartments" },
      ]);
      expect(parseChecklistbox(FORM_HTML, "MEALS")).toEqual([
        { value: "10001", name: "AI" },
        { value: "10002", name: "BB" },
      ]);
      expect(parseChecklistbox(FORM_HTML, "TOWNS")).toEqual([
        { value: "2483", name: "Dubai (Al Jaddaf)" },
        { value: "13", name: "Дубай" },
      ]);
    });
  });
});
