import * as db from "./lokohotDb";
import { sortPlayersByStrength } from "./sortPlayers";
import type { CheckedInPlayer, Player, Session, TeamAssignments } from "./types";

export interface AppState {
  session: Session;
  roster: Player[];
  checkedIn: CheckedInPlayer[];
  assignments: TeamAssignments;
}

let state: AppState | null = null;

export function getAppState(): AppState | null {
  return state;
}

/** One network round-trip batch on initial load / after submit. */
export async function loadAppState(): Promise<AppState> {
  const session = await db.getOrCreateDraftSession();
  const [roster, playerIds, assignments] = await Promise.all([
    db.listActivePlayers(),
    db.listSessionPlayerIds(session.id),
    db.loadTeamAssignments(session.id),
  ]);

  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const teamByPlayer = new Map<string, CheckedInPlayer["team"]>();
  for (const t of ["green", "yellow", "orange"] as const) {
    for (const id of assignments[t]) {
      teamByPlayer.set(id, t);
    }
  }

  const checkedIn: CheckedInPlayer[] = [];
  for (const id of playerIds) {
    const p = rosterById.get(id);
    if (p) {
      checkedIn.push({ ...p, team: teamByPlayer.get(id) });
    }
  }
  const sortedCheckedIn = sortPlayersByStrength(checkedIn);

  state = { session, roster, checkedIn: sortedCheckedIn, assignments };
  return state;
}

export function filterRosterLocal(query: string): Player[] {
  if (!state) return [];
  const q = query.trim().toLowerCase();
  if (!q) return state.roster.slice(0, 30);
  return state.roster
    .filter((p) => p.name.toLowerCase().includes(q))
    .slice(0, 30);
}

export function setAssignments(assignments: TeamAssignments): void {
  if (state) state.assignments = assignments;
}

export function setCheckedIn(checkedIn: CheckedInPlayer[]): void {
  if (state) state.checkedIn = checkedIn;
}

export function upsertRosterPlayer(player: Player): void {
  if (!state) return;
  const i = state.roster.findIndex((p) => p.id === player.id);
  if (i >= 0) state.roster[i] = player;
  else state.roster.push(player);
  state.roster.sort((a, b) => a.name.localeCompare(b.name, "he"));
}
