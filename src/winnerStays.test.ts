import { describe, expect, it } from "vitest";
import { getMatchWinner, getPitchLeader } from "./winnerStays";
import type { Match } from "./types";

function m(
  homeTeam: Match["homeTeam"],
  awayTeam: Match["awayTeam"],
  homeScore: number,
  awayScore: number
): Match {
  return {
    id: "1",
    sessionId: "s",
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    createdAt: "",
    goals: [],
  };
}

describe("winnerStays", () => {
  it("returns null with no games", () => {
    expect(getPitchLeader([])).toBeNull();
  });

  it("returns winner of last game", () => {
    const games = [m("green", "yellow", 2, 1), m("green", "orange", 0, 3)];
    expect(getPitchLeader(games)).toBe("orange");
  });

  it("returns null when last game is a draw", () => {
    expect(getPitchLeader([m("green", "yellow", 1, 1)])).toBeNull();
  });

  it("getMatchWinner", () => {
    expect(getMatchWinner(m("green", "yellow", 3, 2))).toBe("green");
    expect(getMatchWinner(m("green", "yellow", 2, 2))).toBeNull();
  });
});
