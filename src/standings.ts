import type { Match, TeamColor } from "./types";
import { TEAM_ORDER } from "./teamLabels";

export interface StandingRow {
  team: TeamColor;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export function computeStandings(matches: Match[]): StandingRow[] {
  const stats = new Map<
    TeamColor,
    Omit<StandingRow, "team" | "goalDiff">
  >();

  for (const t of TEAM_ORDER) {
    stats.set(t, {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    const home = stats.get(m.homeTeam);
    const away = stats.get(m.awayTeam);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (m.homeScore < m.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return TEAM_ORDER.map((team) => {
    const s = stats.get(team)!;
    return {
      team,
      ...s,
      goalDiff: s.goalsFor - s.goalsAgainst,
    };
  }).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
}
