import type { TeamAssignments, TeamColor } from "./types";

const TEAMS: TeamColor[] = ["green", "yellow", "orange"];

export interface BalanceInput {
  id: string;
  strength: number;
}

export interface BalanceResult {
  assignments: TeamAssignments;
  averages: Record<TeamColor, number>;
}

function teamSum(ids: string[], strengthById: Map<string, number>): number {
  return ids.reduce((s, id) => s + (strengthById.get(id) ?? 0), 0);
}

function teamAverage(ids: string[], strengthById: Map<string, number>): number {
  if (ids.length === 0) return 0;
  return teamSum(ids, strengthById) / ids.length;
}

function scoreSplit(
  split: TeamAssignments,
  strengthById: Map<string, number>
): number {
  const avgs = TEAMS.map((t) => teamAverage(split[t], strengthById));
  return Math.max(...avgs) - Math.min(...avgs);
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Greedy assign: each player goes to the team with the lowest current sum. */
function greedySplit(ordered: BalanceInput[], teamSize: number): TeamAssignments {
  const split: TeamAssignments = { green: [], yellow: [], orange: [] };
  const strengthById = new Map(ordered.map((p) => [p.id, p.strength]));

  for (const p of ordered) {
    let bestTeam: TeamColor = "green";
    let bestSum = Infinity;
    for (const t of TEAMS) {
      if (split[t].length >= teamSize) continue;
      const sum = teamSum(split[t], strengthById);
      if (sum < bestSum) {
        bestSum = sum;
        bestTeam = t;
      }
    }
    split[bestTeam].push(p.id);
  }

  return split;
}

/**
 * Partition players into 3 equal teams with near-equal average strength.
 * 1 = strongest, 6 = weakest.
 */
export function balanceTeams(
  players: BalanceInput[],
  options?: { attempts?: number; random?: () => number }
): BalanceResult {
  const n = players.length;
  if (n < 3 || n % 3 !== 0) {
    throw new Error("מספר השחקנים חייב להתחלק ב-3");
  }
  const teamSize = n / 3;
  const attempts = options?.attempts ?? 400;
  const random = options?.random ?? Math.random;
  const strengthById = new Map(players.map((p) => [p.id, p.strength]));

  let best: TeamAssignments | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < attempts; i++) {
    const ordered = shuffle(
      [...players].sort((a, b) => a.strength - b.strength),
      random
    );
    const split = greedySplit(ordered, teamSize);
    const sizes = TEAMS.map((t) => split[t].length);
    if (!sizes.every((s) => s === teamSize)) continue;

    const sc = scoreSplit(split, strengthById);
    if (sc < bestScore) {
      bestScore = sc;
      best = split;
    }
  }

  if (!best) {
    throw new Error("לא הצלחנו לאזן קבוצות");
  }

  return {
    assignments: best,
    averages: {
      green: teamAverage(best.green, strengthById),
      yellow: teamAverage(best.yellow, strengthById),
      orange: teamAverage(best.orange, strengthById),
    },
  };
}

export function balanceFromStrengths(strengths: number[], random?: () => number): BalanceResult {
  const players: BalanceInput[] = strengths.map((strength, i) => ({
    id: String(i),
    strength,
  }));
  return balanceTeams(players, { random });
}
