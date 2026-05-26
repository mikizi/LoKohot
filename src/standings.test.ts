import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";

const base = {
  sessionId: "s",
  homeScore: 0,
  awayScore: 0,
  createdAt: "",
  goals: [],
};

describe("computeStandings", () => {
  it("awards 3 points for a win", () => {
    const rows = computeStandings([
      { ...base, id: "1", homeTeam: "green", awayTeam: "yellow", homeScore: 2, awayScore: 1 },
    ]);
    const green = rows.find((r) => r.team === "green");
    expect(green?.points).toBe(3);
    expect(green?.won).toBe(1);
  });
});
