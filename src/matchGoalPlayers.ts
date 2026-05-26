import { sortPlayersByStrength } from "./sortPlayers";
import type { CheckedInPlayer, Match, PublishedGameDay } from "./types";

/** Players from the two teams playing in this match. */
export function playersInMatch(day: PublishedGameDay, match: Match): CheckedInPlayer[] {
  const home = day.playersByTeam[match.homeTeam];
  const away = day.playersByTeam[match.awayTeam];
  return sortPlayersByStrength([...home, ...away]);
}
