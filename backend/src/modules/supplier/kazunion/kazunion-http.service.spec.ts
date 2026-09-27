import { KazunionHttpService } from "./kazunion-http.service";

/**
 * KazUnion HTTP parsing tests — fixtures are real response fragments from
 * online.kazunion.com/search_tour (verified 2026-09-27).
 */

const PRICE_ROW_HTML = `
<tr class="even price_info white_row stats freight-external   stateFromKey-48 townFromKey-849 stateKey-6 checkIn-20261005 nights-7 hnights-7 tourKey-2791 spoKey-37949 programTypeKey-793 hotelKey-36268 htPlaceKey-5406 roomKey-135 mealKey-4 adult-2 child-0"
            data-townfrom="849" data-state="6"
            data-checkin="20261005" data-nights="7"
            data-hnights="7" data-cat-claim="0x430A0000003000000003510000000600"
            data-hotel="36268" data-statefrom="48">
            <td><div class="btn-group"></div></td>
            <td class="sortie">
                05.10.2026, Пн
            </td>
            <td class="tour">
                Стамбул из Баку (GDS, прилет IST)
            </td>
            <td class="c">7</td>
            <td class="link-hotel">
                <span class="helpalt additional" data-popup="показать состав пакета"></span>
                Sera Hotel 3*
                (Фатих)
            </td>
            <td class="nw">
                <span title="по запросу" class="hotel_availability helpalt hotel_availability_R"></span>
            </td>
            <td>
                <span class="helpalt link">BB
                    <script type="text/html">Завтраки</script>
                </span>
            </td>
            <td>
                <span class="">Standard Room / 2 ADL</span>
            </td>
            <td class="r nw attributes"><span class="marker">&nbsp;</span></td>
            <td class="c nw statistic"><span class="stats helpalt">&nbsp;</span></td>
            <td class="td_price">
                <span data-cat-price="874" data-cat-price_old=""
                          data-converted_price_old="" data-cat-currency="3"
                          data-converted-price-number="993"
                          data-currency="2"
                          data-currency_title="USD"
                          class="price   expand price_button">993 USD</span>
            </td>
            <td class="nw transport">
                <div class="transport"><span class="name">Эконом</span><span class="fr_place_r Y helpalt" title="есть места"></span></div>
            </td>
</tr>`;

const NO_SEATS_ROW_HTML = PRICE_ROW_HTML.replace("fr_place_r Y", "fr_place_r N")
  .replace('title="есть места"', 'title="нет мест"')
  .replace("spoKey-37949", "spoKey-37950")
  .replace("hotelKey-36268", "hotelKey-99999");

// Real KazUnion row shape: meal is a bare <td>AO.</td> after the availability
// cell, and the tour cell carries a PROMO popup span with a script.
const BARE_MEAL_ROW_HTML = PRICE_ROW_HTML.replace(
  /<span class="helpalt link">BB[\s\S]*?<\/span>/,
  "AO.",
).replace(
  '<td class="tour">',
  '<td class="tour">Antalya <span class="helpalt link" data-popup="PROMO"><script type="text/html">PROMO</script></span>',
);

const FORM_HTML = `
<select name="STATEINC" class="STATEINC" autocomplete="off">
    <option value="19" data-search-string="China China" selected>China</option>
    <option value="6"  data-search-string="Turkey Turkey">Turkey</option>
    <option value="0">----</option>
</select>
<select name="TOURINC" class="TOURINC" autocomplete="off">
    <option value="0">----</option>
    <option value="2791" class="gds transport">Стамбул из Баку (GDS, прилет IST)</option>
    <option value="3584" class="gds transport">Анталья из Баку</option>
</select>
<div class="checklistbox TOWNS" name="TOWNS">
    <div class="groupboxChildren">
        <label><input type="checkbox" value="687"/>Beijing-CBD &amp; World Trade Center</label>
    </div>
    <div class="groupboxChildren">
        <label><input type="checkbox" value="197"/>Пекин</label>
    </div>
</div>
<div class="checklistbox MEALS " name="MEALS">
    <div class="groupboxChildren"><label><input type="checkbox" value="10002"/>BB</label></div>
    <div class="groupboxChildren"><label><input type="checkbox" value="10004"/>HB</label></div>
</div>
`;

describe("KazunionHttpService", () => {
  let service: KazunionHttpService;

  beforeEach(() => {
    service = new KazunionHttpService();
  });

  describe("extractHtmlFromJs", () => {
    it("extracts and unescapes the ehtml payload", () => {
      const js =
        `(function(){samo.jQuery(samo.controls.resultset).ehtml("<tr class=\\"price_info\\">` +
        `05.10.2026 \\u041f\\u043d</tr>");samo.initResultset();})();`;
      const html = service.extractHtmlFromJs(js);
      expect(html).toContain('<tr class="price_info">');
      expect(html).toContain("05.10.2026 Пн");
    });

    it("returns null when no ehtml payload is present", () => {
      expect(service.extractHtmlFromJs("some random body")).toBeNull();
    });
  });

  describe("parsePriceRows", () => {
    it("parses a real KazUnion price row", () => {
      const rows = service.parsePriceRows(PRICE_ROW_HTML);
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.hotel).toBe("Sera Hotel 3*"); // district "(Фатих)" stripped
      expect(row.hotelKey).toBe("36268");
      expect(row.spoKey).toBe("37949");
      expect(row.tourKey).toBe("2791");
      expect(row.mealKey).toBe("4");
      expect(row.roomKey).toBe("135");
      expect(row.nights).toBe(7);
      expect(row.checkIn).toBe("20261005");
      expect(row.adults).toBe(2);
      expect(row.children).toBe(0);
      expect(row.claim).toContain("0x430A");
      // Converted (requested-currency) price wins over data-cat-price.
      expect(row.price).toBe(993);
      expect(row.currency).toBe("USD");
      expect(row.departureDateText).toContain("05.10.2026");
      expect(row.mealText).toBe("BB");
      expect(row.roomText).toBe("Standard Room / 2 ADL");
      expect(row.transport).toBe("Эконом");
      expect(row.seatsAvailable).toBe(true);
      expect(row.stopSale).toBe(false);
    });

    it("marks rows without seat markers as not seat-available", () => {
      const rows = service.parsePriceRows(NO_SEATS_ROW_HTML);
      expect(rows).toHaveLength(1);
      expect(rows[0].seatsAvailable).toBe(false);
    });

    it("parses a bare KazUnion meal cell and ignores the PROMO popup script", () => {
      const rows = service.parsePriceRows(BARE_MEAL_ROW_HTML);
      expect(rows).toHaveLength(1);
      expect(rows[0].mealText).toBe("AO.");
    });

    it("returns empty for HTML without price rows", () => {
      expect(service.parsePriceRows("<table><tr><td>no data</td></tr></table>")).toEqual([]);
    });
  });

  describe("parseSelectOptions", () => {
    it("parses STATEINC options and skips placeholder", () => {
      const states = service.parseSelectOptions(FORM_HTML, "STATEINC", true);
      expect(states).toEqual([
        { value: "19", name: "China" },
        { value: "6", name: "Turkey" },
      ]);
    });

    it("parses TOURINC programs", () => {
      const programs = service.parseSelectOptions(FORM_HTML, "TOURINC", true);
      expect(programs).toHaveLength(2);
      expect(programs[0]).toEqual({ value: "2791", name: "Стамбул из Баку (GDS, прилет IST)" });
      expect(programs[1].value).toBe("3584");
    });
  });

  describe("parseChecklistbox", () => {
    it("parses TOWNS checkbox values with labels", () => {
      const towns = service.parseChecklistbox(FORM_HTML, "TOWNS");
      expect(towns).toEqual([
        { value: "687", name: "Beijing-CBD & World Trade Center" },
        { value: "197", name: "Пекин" },
      ]);
    });

    it("parses MEALS checkboxes", () => {
      const meals = service.parseChecklistbox(FORM_HTML, "MEALS");
      expect(meals).toEqual([
        { value: "10002", name: "BB" },
        { value: "10004", name: "HB" },
      ]);
    });
  });

  describe("parseTotalPages", () => {
    it("reads max page from pager spans", () => {
      const html = `<div class="pager"><span class="page" data-page="1">1</span><span class="current_page">2</span><span class="page" data-page="3">3</span></div>`;
      expect(service.parseTotalPages("", html)).toBe(3);
    });

    it("defaults to 1 page when no pager present", () => {
      expect(service.parseTotalPages("", "<table></table>")).toBe(1);
    });
  });

  describe("isCaptchaResponse", () => {
    it("detects captcha form markers", () => {
      expect(service.isCaptchaResponse('<form id="captchaForm"></form>')).toBe(true);
      expect(service.isCaptchaResponse("samo_action=antibot&x=1")).toBe(true);
      expect(service.isCaptchaResponse("<table>prices</table>")).toBe(false);
    });
  });
});
