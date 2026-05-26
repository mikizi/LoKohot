import { describe, expect, it } from "vitest";
import { sortPlayersByStrength } from "./sortPlayers";

describe("sortPlayersByStrength", () => {
  it("orders 1 (best) before 6 (weakest)", () => {
    const sorted = sortPlayersByStrength([
      { name: "חלש", strength: 6 },
      { name: "חזק", strength: 1 },
      { name: "בינוני", strength: 3 },
    ]);
    expect(sorted.map((p) => p.strength)).toEqual([1, 3, 6]);
  });

  it("puts null strength last", () => {
    const sorted = sortPlayersByStrength([
      { name: "ב", strength: null },
      { name: "א", strength: 2 },
    ]);
    expect(sorted[0].name).toBe("א");
    expect(sorted[1].name).toBe("ב");
  });
});
