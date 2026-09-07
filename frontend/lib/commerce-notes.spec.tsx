// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { t } from "./i18n";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function count(src: string, s: string): number {
  return src.split(s).length - 1;
}

const REQ = read("app/app/requests/[id]/page.tsx");
const ORD = read("app/app/orders/[id]/page.tsx");
const BKG = read("app/app/bookings/[id]/page.tsx");
const COMPONENT = read("components/OperationalNotes.tsx");
const I18N = read("lib/i18n.tsx");

describe("UI-C5 Notes Unification — Request integration", () => {
  it("Request detail renders the shared <OperationalNotes> exactly once with entityType=Request", () => {
    expect(count(REQ, "<OperationalNotes")).toBe(1);
    expect(REQ).toContain('entityType="Request"');
    expect(REQ).toContain("entityId={id}");
  });

  it("Request detail supplies auth context to the notes component (permissions/owner/role)", () => {
    expect(REQ).toContain("permissions={user.permissions}");
    expect(REQ).toContain("currentUserId={user.id}");
    expect(REQ).toContain("currentRole={user.role}");
    expect(REQ).toContain("const user = useCurrentUser()");
  });

  it("Notes live in the canonical WIDE slot: below main content, above audit (relations → notes → audit)", () => {
    const relIdx = REQ.indexOf("<CommerceRelationChain");
    const notesIdx = REQ.indexOf("<OperationalNotes");
    const auditIdx = REQ.indexOf("<EntityAuditHistory");
    expect(relIdx).toBeGreaterThan(-1);
    expect(notesIdx).toBeGreaterThan(relIdx);
    expect(auditIdx).toBeGreaterThan(notesIdx);
  });

  it("Order and Booking keep their existing Notes integrations unchanged (entityType Order/Booking)", () => {
    expect(count(ORD, "<OperationalNotes")).toBe(1);
    expect(ORD).toContain('entityType="Order"');
    expect(count(BKG, "<OperationalNotes")).toBe(1);
    expect(BKG).toContain('entityType="Booking"');
  });
});

describe("UI-C5 Notes Unification — shared component + i18n", () => {
  it("uses the existing canonical <OperationalNotes> component (design contract: no new component)", () => {
    expect(COMPONENT).toContain("operationalNotesApi");
    expect(COMPONENT).toContain("entityType: string");
    expect(COMPONENT).toContain("entityId: string");
    expect(COMPONENT).toContain("operational-notes.read");
    // States required by the design contract are present.
    expect(COMPONENT).toContain("notes.forbidden");
    expect(COMPONENT).toContain("state.loading");
    expect(COMPONENT).toContain("notes.empty");
    expect(COMPONENT).toContain("notes.load_error");
  });

  it("Notes ≠ Audit: component is separate from EntityAuditHistory (no history/audit merge)", () => {
    expect(COMPONENT).not.toContain("EntityAuditHistory");
    expect(COMPONENT).not.toContain("EntityTimeline");
  });

  it("all notes.* i18n keys resolve in RU/AZ/EN (no hardcoded RU)", () => {
    const keys = [
      "notes.title", "notes.add", "notes.add_placeholder", "notes.edit", "notes.delete",
      "notes.save", "notes.cancel", "notes.empty", "notes.forbidden", "notes.load_error",
      "notes.create_error", "notes.edit_error", "notes.creating", "notes.saving",
      "notes.created", "notes.edited", "notes.delete_confirm", "notes.delete_yes",
      "notes.retry", "notes.unknown_author", "notes.validation_empty", "notes.validation_max",
    ];
    for (const key of keys) {
      expect(I18N).toContain(`"${key}"`);
      for (const loc of ["ru", "az", "en"] as const) {
        expect(t(key, loc)).not.toBe(key);
      }
    }
  });

  it("Notes ≠ Timeline: Request page keeps EntityTimeline in the aside column", () => {
    const asideIdx = REQ.indexOf("<EntityDetailAside");
    expect(REQ.indexOf("<EntityTimeline")).toBeGreaterThan(asideIdx);
  });
});