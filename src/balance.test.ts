import { describe, expect, it } from "vitest";
import { balanceFromStrengths, balanceTeams } from "./balance";

/** Deterministic PRNG (mulberry32). */
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("balanceTeams", () => {
  it("throws when count is not divisible by 3", () => {
    expect(() =>
      balanceTeams([{ id: "a", strength: 3 }, { id: "b", strength: 4 }])
    ).toThrow();
  });

  it("splits 18 players into teams of 6 with tight averages", () => {
    const strengths = [
      6, 2, 2, 5, 5, 2, 2.5, 3, 4, 4, 1, 4, 2.5, 1, 5, 2, 2, 4, 6, 3, 2.5, 3, 6, 2, 4, 4, 2, 3.5, 6, 3,
      2.5, 2.5, 3, 4, 3, 4,
    ].slice(0, 18);
    const random = seededRandom(42);
    const result = balanceFromStrengths(strengths, random);

    expect(result.assignments.green).toHaveLength(6);
    expect(result.assignments.yellow).toHaveLength(6);
    expect(result.assignments.orange).toHaveLength(6);

    const avgs = [result.averages.green, result.averages.yellow, result.averages.orange];
    const spread = Math.max(...avgs) - Math.min(...avgs);
    expect(spread).toBeLessThan(0.15);
  });

  it("is reproducible with a fixed seed", () => {
    const strengths = [1, 2, 3, 4, 5, 6, 2, 3, 4];
    const r1 = balanceFromStrengths(strengths, seededRandom(99));
    const r2 = balanceFromStrengths(strengths, seededRandom(99));
    expect(r1.assignments).toEqual(r2.assignments);
  });
});
