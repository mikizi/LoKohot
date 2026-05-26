import type { Match, TeamColor } from "./types";

/** Team that stays on the pitch after the last game (null if no games or last was a draw). */
export function getPitchLeader(matches: Match[]): TeamColor | null {
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  if (last.homeScore > last.awayScore) return last.homeTeam;
  if (last.awayScore > last.homeScore) return last.awayTeam;
  return null;
}

export function getMatchWinner(m: Match): TeamColor | null {
  if (m.homeScore > m.awayScore) return m.homeTeam;
  if (m.awayScore > m.homeScore) return m.awayTeam;
  return null;
}
