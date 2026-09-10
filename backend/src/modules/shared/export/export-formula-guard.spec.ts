/**
 * D9-F1 — CSV Formula Injection Remediation (targeted remediation spec).
 *
 * Canonical strategy (D9 requalification report §11 / remediation prompt §6):
 * a TEXT cell is escaped to text by prefixing an apostrophe (') when its first
 * character is a spreadsheet formula trigger (= + - @) or when it begins with
 * a tab/CR/LF control character. Numeric machine data is NEVER transformed:
 *   - runtime scalars (number | boolean | Date) pass verbatim;
 *   - strict machine-number strings (Prisma Decimal String() contract, e.g.
 *     "-12.50", "+1", "0.95") pass verbatim — they cannot execute as
 *     spreadsheet formulas (no function reference) and prefixing them would
 *     corrupt numeric semantics (remediation prompt §5). Consequently "-1"/"+1"
 *     from the prompt §7 payload list are asserted UNCHANGED here as machine
 *     numbers; formula-shaped variants ("==1+1", "++1", "--1", "-@cmd") are
 *     still protected (§12).
 *
 * Matrix coverage:
 *   §7  injection payloads / safe text / CSV syntax;
 *   §8  RFC-4180 readback parse (hand-rolled parser, no new dependency);
 *   §12 adversarial cases (leading whitespace, quote-before-=, doubled
 *       triggers, trigger combinations);
 *   §11 shared-serializer coverage (single choke point) — the representative
 *       live-endpoint proof (Catalog products export with attacker-controlled
 *       titles) runs against the real backend in the D9-F1 e2e spec
 *       test/d9-f1-csv-formula-guard.e2e-spec.ts.
 */
import { ExportService, ExportColumn } from "./export.service";

/** Typed access to the private csvEscape (single serialization choke point). */
function escapeCsvCell(svc: ExportService, v: unknown): string {
  return (svc as unknown as { csvEscape: (val: unknown) => string }).csvEscape(v);
}

/** Minimal RFC-4180 parser (BOM-tolerant) — readback proof, no new deps. */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    // \r: line-break only when followed by \n (CRLF); otherwise cell content.
    if (ch === "\r") {
      if (src[i + 1] === "\n") {
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

const COLUMNS: ExportColumn[] = [
  { header: "Title", key: "title", width: 30 },
  { header: "Amount", key: "amount", width: 14 },
  { header: "Count", key: "count", width: 8 },
  { header: "Active", key: "active", width: 8 },
];

describe("D9-F1 csvEscape — formula injection matrix", () => {
  let svc: ExportService;

  beforeEach(() => {
    svc = new ExportService();
  });

  it("protects formula-leading TEXT payloads with a leading apostrophe (prompt §7)", () => {
    const payloads = ["=1+1", "@SUM(A1)", "=cmd|' /C calc'!A0", '=HYPERLINK("http://evil")'];
    for (const p of payloads) {
      // Assert through an RFC-4180 parse: payloads containing quotes/commas
      // are additionally wrapped in CSV quoting AFTER the guard, so the raw
      // bytes may start with '"' — the parsed cell value is the consumer
      // truth and must start with the apostrophe guard.
      const cell = parseCsv(svc.toCsv([{ header: "C", key: "v" }], [{ v: p }]))[1][0];
      expect(cell.startsWith("'")).toBe(true);
      expect(cell.slice(1)).toBe(p); // content preserved verbatim after the guard
    }
  });

  it("protects leading-control TEXT payloads (tab / CR / LF)", () => {
    for (const p of ["\t=1+1", "\r=1+1", "\n=1+1"]) {
      const cell = parseCsv(svc.toCsv([{ header: "C", key: "v" }], [{ v: p }]))[1][0];
      expect(cell.startsWith("'")).toBe(true);
      expect(cell.slice(1)).toBe(p);
    }
  });

  it("adversarial cases (prompt §12): whitespace, quote-prefix, doubled/combined triggers", () => {
    // " =1+1" — space is NOT a trigger (documented canonical choice): Excel
    // does not evaluate a formula after a leading space, and trimming user
    // text would alter cell content.
    expect(escapeCsvCell(svc, " =1+1")).toBe(" =1+1");
    // "'=1+1" — already a text literal, no additional guard required.
    expect(escapeCsvCell(svc, "'=1+1")).toBe("'=1+1");
    // "==1+1", "++1", "--1", "@cmd", "-@cmd" — first char is a trigger.
    for (const p of ["==1+1", "++1", "--1", "@cmd", "-@cmd"]) {
      const out = escapeCsvCell(svc, p);
      expect(out.startsWith("'")).toBe(true);
      expect(out.slice(1)).toBe(p);
    }
  });

  it("does NOT transform machine-number strings (Decimal String() contract, prompt §5)", () => {
    for (const p of ["-12.50", "12.50", "-1", "+1", "0.95", "-0.5", "+0.25", "1e3", "-1.5E-2"]) {
      expect(escapeCsvCell(svc, p)).toBe(p);
    }
  });

  it("does NOT transform runtime machine scalars (number/boolean) even when negative", () => {
    const csv = svc.toCsv(COLUMNS, [
      { title: "Hotel Antalya", amount: -12.5, count: 3, active: true },
      { title: "Room 2+1", amount: -0.05, count: 0, active: false },
    ]);
    expect(csv).toContain("-12.5");
    expect(csv).toContain("-0.05");
    expect(csv).toContain("true");
    expect(csv).toContain("false");
    expect(csv).not.toContain("'-12.5");
  });

  it("safe text is unchanged (prompt §7)", () => {
    for (const p of ["Hotel Antalya", "Normal text", "Room 2+1", "A-123", "email@example.com", "100 USD"]) {
      expect(escapeCsvCell(svc, p)).toBe(p);
    }
  });

  it("CSV syntax escaping (comma / quote / newline) is preserved and parses (prompt §7/§8)", () => {
    const csv = svc.toCsv(
      [{ header: "Note", key: "note" }],
      [{ note: "Hello, world" }, { note: 'He said "hello"' }, { note: "Line 1\nLine 2" }],
    );
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(4); // header + 3 data rows
    expect(parsed[0]).toEqual(["Note"]);
    expect(parsed[1]).toEqual(["Hello, world"]);
    expect(parsed[2]).toEqual(['He said "hello"']);
    expect(parsed[3]).toEqual(["Line 1\nLine 2"]);
  });

  it("null/undefined/empty semantics unchanged (empty cells, no artifacts)", () => {
    const csv = svc.toCsv([{ header: "V", key: "v" }], [{ v: null }, { v: undefined }, { v: "" }]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("\uFEFFV");
    expect(lines.slice(1, 4)).toEqual(["", "", ""]); // three empty data cells
  });

  it("column order/count unchanged and protected cells stay inside their column", () => {
    const csv = svc.toCsv(COLUMNS, [{ title: "=1+1", amount: "-12.50", count: 2, active: true }]);
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(["Title", "Amount", "Count", "Active"]);
    expect(parsed[1]).toEqual(["'=1+1", "-12.50", "2", "true"]);
  });
});

describe("D9-F1 toCsv — shared-serializer end-to-end readback", () => {
  it("mixed real-world row: protected titles + verbatim machine data, BOM preserved", () => {
    const svc = new ExportService();
    const rows = [
      { title: '=HYPERLINK("http://evil")', amount: "-12.50", count: 1, active: true },
      { title: "Tour =A+B (safe inside)", amount: "0.00", count: 0, active: false },
      { title: "\t=cmd|' /C calc'!A0", amount: "+1", count: 9, active: true },
    ];
    const csv = svc.toCsv(COLUMNS, rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM behavior preserved

    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual(["Title", "Amount", "Count", "Active"]);
    expect(parsed[1]).toEqual(["'=HYPERLINK(\"http://evil\")", "-12.50", "1", "true"]);
    expect(parsed[2]).toEqual(["Tour =A+B (safe inside)", "0.00", "0", "false"]);
    expect(parsed[3]).toEqual(["'\t=cmd|' /C calc'!A0", "+1", "9", "true"]);
    // No raw formula-leading cell anywhere in the text column:
    for (const dataRow of parsed.slice(1)) {
      const title = dataRow[0];
      expect(title.startsWith("=") || title.startsWith("+") || title.startsWith("@")).toBe(false);
    }
  });
});
