import { describe, expect, it } from "vitest";
import { parsePlayerList } from "./parsePlayerList";

describe("parsePlayerList", () => {
  it("parses arrow format", () => {
    const r = parsePlayerList("גדי לי → 6\nאופיר → 1");
    expect(r).toEqual([
      { name: "גדי לי", strength: 6 },
      { name: "אופיר", strength: 1 },
    ]);
  });

  it("parses name-only lines", () => {
    const r = parsePlayerList("מיקי\nגיא");
    expect(r).toEqual([{ name: "מיקי" }, { name: "גיא" }]);
  });

  it("dedupes by name", () => {
    const r = parsePlayerList("מיקי\nמיקי");
    expect(r).toHaveLength(1);
  });

  it("skips empty and headers", () => {
    const r = parsePlayerList("\n# comment\n— רשימה\n");
    expect(r).toHaveLength(0);
  });
});
