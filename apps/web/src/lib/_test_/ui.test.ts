import { describe, it, expect } from "vitest";
import { avatarColor, initials, relTime, dueState, toLocalInput, fromLocalInput } from "../ui";

describe("ui helpers", () => {
  it("initials handles single and multi word names", () => {
    expect(initials("Ana")).toBe("AN");
    expect(initials("Ana Silva")).toBe("AS");
    expect(initials("  Ada  Lovelace  ")).toBe("AL");
  });

  it("avatarColor is stable per name and within palette", () => {
    expect(avatarColor("Ana")).toBe(avatarColor("Ana"));
    expect(avatarColor("Ana")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("relTime formats recent and old timestamps", () => {
    expect(relTime(new Date().toISOString())).toBe("just now");
    expect(relTime(new Date(Date.now() - 5 * 60000).toISOString())).toBe("5m ago");
    expect(relTime(new Date(Date.now() - 3 * 3600000).toISOString())).toBe("3h ago");
    // >7 days falls back to a locale date string
    expect(relTime(new Date(Date.now() - 30 * 86400000).toISOString())).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
  });

  it("dueState classifies overdue, soon and future dates", () => {
    const overdue = dueState(new Date(Date.now() - 86400000).toISOString());
    expect(overdue?.cls).toBe("overdue");
    const soon = dueState(new Date(Date.now() + 3600000).toISOString());
    expect(soon?.cls).toBe("soon");
    const later = dueState(new Date(Date.now() + 5 * 86400000).toISOString());
    expect(later?.cls).toBe("");
    expect(dueState(null)).toBeNull();
  });

  it("local input round-trips through ISO", () => {
    const iso = new Date(2026, 0, 15, 9, 30).toISOString();
    const local = toLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(fromLocalInput(local)!).getTime()).toBe(new Date(local).getTime());
    expect(fromLocalInput("")).toBeNull();
  });
});