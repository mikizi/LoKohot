/**
 * Supabase PostgREST client (no @supabase/js) — same pattern as eurovision-hit-or-script.
 */
import { sortPlayersByStrength } from "./sortPlayers";
import type {
  CheckedInPlayer,
  Match,
  MatchGoal,
  Player,
  PublishedGameDay,
  Session,
  TeamAssignments,
  TeamColor,
} from "./types";

const PLAYERS_TABLE = "players";
const SESSIONS_TABLE = "sessions";
const SESSION_PLAYERS_TABLE = "session_players";
const TEAM_ASSIGNMENTS_TABLE = "team_assignments";
const MATCHES_TABLE = "matches";
const MATCH_GOALS_TABLE = "match_goals";
const APP_SETTINGS_TABLE = "app_settings";
const ADMIN_PIN_KEY = "admin_pin";

function supabaseUrl(): string {
  return String(import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
}

function supabaseAnonKey(): string {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
}

export function isDbConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

function authHeaders(): Record<string, string> {
  const key = supabaseAnonKey();
  return {
    apikey: key,
    Authorization: "Bearer " + key,
  };
}

async function rest<T>(
  path: string,
  init?: RequestInit & { prefer?: string }
): Promise<T> {
  const base = supabaseUrl();
  const headers: Record<string, string> = {
    ...authHeaders(),
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.prefer) {
    headers.Prefer = init.prefer;
  }
  const res = await fetch(base + path, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 240)}`);
  }
  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Supabase ${res.status}: invalid JSON response`);
  }
}

function mapPlayer(row: Record<string, unknown>): Player | null {
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  const strength = row.strength;
  return {
    id: row.id,
    name: row.name,
    strength:
      strength === null || strength === undefined
        ? null
        : typeof strength === "number"
          ? strength
          : Number(strength),
    active: row.active !== false,
  };
}

function mapSession(row: Record<string, unknown>): Session | null {
  if (typeof row.id !== "string" || typeof row.created_at !== "string") return null;
  const raw = row.status;
  let status: Session["status"] | null = null;
  if (raw === "draft" || raw === "published" || raw === "closed") {
    status = raw;
  } else if (raw === "final") {
    status = "closed";
  }
  if (!status) return null;
  const title = row.title;
  return {
    id: row.id,
    status,
    createdAt: row.created_at,
    title: typeof title === "string" ? title : null,
  };
}

function mapMatch(row: Record<string, unknown>): Match | null {
  if (typeof row.id !== "string" || typeof row.session_id !== "string") return null;
  const homeTeam = row.home_team;
  const awayTeam = row.away_team;
  if (homeTeam !== "green" && homeTeam !== "yellow" && homeTeam !== "orange") return null;
  if (awayTeam !== "green" && awayTeam !== "yellow" && awayTeam !== "orange") return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    homeTeam,
    awayTeam,
    homeScore: Number(row.home_score ?? 0),
    awayScore: Number(row.away_score ?? 0),
    createdAt: String(row.created_at ?? ""),
    goals: [],
  };
}

function mapMatchGoal(
  row: Record<string, unknown>,
  nameById: Map<string, string>
): MatchGoal | null {
  if (typeof row.id !== "string" || typeof row.match_id !== "string") return null;
  if (typeof row.scorer_id !== "string") return null;
  const assistId = typeof row.assist_id === "string" ? row.assist_id : null;
  return {
    id: row.id,
    matchId: row.match_id,
    scorerId: row.scorer_id,
    scorerName: nameById.get(row.scorer_id) ?? "?",
    assistId,
    assistName: assistId ? (nameById.get(assistId) ?? "?") : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function attachGoalsToMatches(matches: Match[], goals: MatchGoal[]): Match[] {
  const byMatch = new Map<string, MatchGoal[]>();
  for (const g of goals) {
    const list = byMatch.get(g.matchId) ?? [];
    list.push(g);
    byMatch.set(g.matchId, list);
  }
  return matches.map((m) => ({ ...m, goals: byMatch.get(m.id) ?? [] }));
}

export async function listActivePlayers(): Promise<Player[]> {
  const data = await rest<unknown[]>(
    `/rest/v1/${PLAYERS_TABLE}?active=eq.true&order=name.asc&limit=500`
  );
  if (!Array.isArray(data)) return [];
  const out: Player[] = [];
  for (const row of data) {
    if (row && typeof row === "object") {
      const p = mapPlayer(row as Record<string, unknown>);
      if (p) out.push(p);
    }
  }
  return out;
}

export async function searchPlayers(query: string): Promise<Player[]> {
  const q = query.trim();
  let path = `/rest/v1/${PLAYERS_TABLE}?active=eq.true&order=name.asc&limit=30`;
  if (q) {
    path += `&name=ilike.%25${encodeURIComponent(q)}%25`;
  }
  const data = await rest<unknown[]>(path);
  if (!Array.isArray(data)) return [];
  const out: Player[] = [];
  for (const row of data) {
    if (row && typeof row === "object") {
      const p = mapPlayer(row as Record<string, unknown>);
      if (p) out.push(p);
    }
  }
  return out;
}

export async function createPlayer(name: string, strength: number | null): Promise<Player> {
  const body = {
    name: name.trim(),
    strength: strength ?? null,
    active: true,
    updated_at: new Date().toISOString(),
  };
  const data = await rest<unknown[]>(`/rest/v1/${PLAYERS_TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const row = Array.isArray(data) ? data[0] : null;
  const p = row && typeof row === "object" ? mapPlayer(row as Record<string, unknown>) : null;
  if (!p) throw new Error("לא נוצר שחקן");
  return p;
}

export async function updatePlayer(
  id: string,
  patch: { name?: string; strength?: number | null }
): Promise<Player> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.strength !== undefined) body.strength = patch.strength;

  const data = await rest<unknown[]>(`/rest/v1/${PLAYERS_TABLE}?id=eq.${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const row = Array.isArray(data) ? data[0] : null;
  const p = row && typeof row === "object" ? mapPlayer(row as Record<string, unknown>) : null;
  if (!p) throw new Error("לא עודכן שחקן");
  return p;
}

export async function getOrCreateDraftSession(): Promise<Session> {
  const existing = await rest<unknown[]>(
    `/rest/v1/${SESSIONS_TABLE}?status=eq.draft&order=created_at.desc&limit=1`
  );
  if (Array.isArray(existing) && existing[0] && typeof existing[0] === "object") {
    const s = mapSession(existing[0] as Record<string, unknown>);
    if (s) return s;
  }

  const created = await rest<unknown[]>(`/rest/v1/${SESSIONS_TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "draft" }),
  });
  const row = Array.isArray(created) ? created[0] : null;
  const s = row && typeof row === "object" ? mapSession(row as Record<string, unknown>) : null;
  if (!s) throw new Error("לא נוצרה סשן");
  return s;
}

export async function listCheckedIn(sessionId: string): Promise<CheckedInPlayer[]> {
  const links = await rest<unknown[]>(
    `/rest/v1/${SESSION_PLAYERS_TABLE}?session_id=eq.${sessionId}&select=player_id`
  );
  if (!Array.isArray(links) || links.length === 0) return [];

  const ids = links
    .map((r) => (r && typeof r === "object" ? (r as { player_id?: string }).player_id : null))
    .filter((id): id is string => typeof id === "string");

  if (ids.length === 0) return [];

  const inFilter = `in.(${ids.join(",")})`;
  const players = await rest<unknown[]>(
    `/rest/v1/${PLAYERS_TABLE}?id=${inFilter}&order=name.asc`
  );

  const assignments = await loadTeamAssignments(sessionId);
  const teamByPlayer = new Map<string, TeamColor>();
  for (const t of ["green", "yellow", "orange"] as TeamColor[]) {
    for (const pid of assignments[t]) {
      teamByPlayer.set(pid, t);
    }
  }

  const out: CheckedInPlayer[] = [];
  if (!Array.isArray(players)) return out;
  for (const row of players) {
    if (row && typeof row === "object") {
      const p = mapPlayer(row as Record<string, unknown>);
      if (p) {
        out.push({ ...p, team: teamByPlayer.get(p.id) });
      }
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "he"));
  return out;
}

export async function listSessionPlayerIds(sessionId: string): Promise<string[]> {
  const links = await rest<unknown[]>(
    `/rest/v1/${SESSION_PLAYERS_TABLE}?session_id=eq.${sessionId}&select=player_id`
  );
  if (!Array.isArray(links)) return [];
  return links
    .map((r) => (r && typeof r === "object" ? (r as { player_id?: string }).player_id : null))
    .filter((id): id is string => typeof id === "string");
}

export async function checkIn(sessionId: string, playerId: string): Promise<void> {
  await checkInMany(sessionId, [playerId]);
}

/** Bulk check-in in a single POST. */
export async function checkInMany(sessionId: string, playerIds: string[]): Promise<void> {
  if (playerIds.length === 0) return;
  const rows = playerIds.map((player_id) => ({ session_id: sessionId, player_id }));
  await rest(`/rest/v1/${SESSION_PLAYERS_TABLE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify(rows),
  });
}

export async function createPlayers(
  entries: { name: string; strength: number | null }[]
): Promise<Player[]> {
  if (entries.length === 0) return [];
  const now = new Date().toISOString();
  const bodies = entries.map((e) => ({
    name: e.name.trim(),
    strength: e.strength ?? null,
    active: true,
    updated_at: now,
  }));
  const data = await rest<unknown[]>(`/rest/v1/${PLAYERS_TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(bodies),
  });
  if (!Array.isArray(data)) return [];
  const out: Player[] = [];
  for (const row of data) {
    if (row && typeof row === "object") {
      const p = mapPlayer(row as Record<string, unknown>);
      if (p) out.push(p);
    }
  }
  return out;
}

export async function checkOut(sessionId: string, playerId: string): Promise<void> {
  await rest(
    `/rest/v1/${SESSION_PLAYERS_TABLE}?session_id=eq.${sessionId}&player_id=eq.${playerId}`,
    { method: "DELETE" }
  );
  await rest(
    `/rest/v1/${TEAM_ASSIGNMENTS_TABLE}?session_id=eq.${sessionId}&player_id=eq.${playerId}`,
    { method: "DELETE" }
  );
}

export async function loadTeamAssignments(sessionId: string): Promise<TeamAssignments> {
  const empty: TeamAssignments = { green: [], yellow: [], orange: [] };
  const data = await rest<unknown[]>(
    `/rest/v1/${TEAM_ASSIGNMENTS_TABLE}?session_id=eq.${sessionId}`
  );
  if (!Array.isArray(data)) return empty;

  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as { player_id?: string; team?: string };
    if (typeof r.player_id !== "string") continue;
    if (r.team === "green" || r.team === "yellow" || r.team === "orange") {
      empty[r.team].push(r.player_id);
    }
  }
  return empty;
}

export async function saveTeamAssignments(
  sessionId: string,
  assignments: TeamAssignments
): Promise<void> {
  const rows: { session_id: string; player_id: string; team: TeamColor }[] = [];
  for (const team of ["green", "yellow", "orange"] as TeamColor[]) {
    for (const player_id of assignments[team]) {
      rows.push({ session_id: sessionId, player_id, team });
    }
  }

  // Clear existing then insert (simpler than upsert with composite key from browser)
  await rest(`/rest/v1/${TEAM_ASSIGNMENTS_TABLE}?session_id=eq.${sessionId}`, {
    method: "DELETE",
  });

  if (rows.length === 0) return;

  await rest(`/rest/v1/${TEAM_ASSIGNMENTS_TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
}

export async function publishSession(sessionId: string, title?: string): Promise<Session> {
  await rest(`/rest/v1/${SESSIONS_TABLE}?status=in.(published,closed,final)`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "draft" }),
  });

  const body: Record<string, unknown> = {
    status: "published",
    title: title?.trim() || new Date().toLocaleDateString("he-IL"),
  };
  const data = await rest<unknown[]>(`/rest/v1/${SESSIONS_TABLE}?id=eq.${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const row = Array.isArray(data) ? data[0] : null;
  const s = row && typeof row === "object" ? mapSession(row as Record<string, unknown>) : null;
  if (!s) throw new Error("לא פורסם");
  return s;
}

export async function closeActiveDay(): Promise<Session | null> {
  const sessions = await rest<unknown[]>(
    `/rest/v1/${SESSIONS_TABLE}?status=eq.published&order=created_at.desc&limit=1`
  );
  const row = Array.isArray(sessions) ? sessions[0] : null;
  const current =
    row && typeof row === "object" ? mapSession(row as Record<string, unknown>) : null;
  if (!current) return null;

  const data = await rest<unknown[]>(`/rest/v1/${SESSIONS_TABLE}?id=eq.${current.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "closed" }),
  });
  const updated = Array.isArray(data) ? data[0] : null;
  return updated && typeof updated === "object"
    ? mapSession(updated as Record<string, unknown>)
    : null;
}

export async function listMatches(sessionId: string): Promise<Match[]> {
  const data = await rest<unknown[]>(
    `/rest/v1/${MATCHES_TABLE}?session_id=eq.${sessionId}&order=created_at.asc`
  );
  if (!Array.isArray(data)) return [];
  const out: Match[] = [];
  for (const row of data) {
    if (row && typeof row === "object") {
      const m = mapMatch(row as Record<string, unknown>);
      if (m) out.push(m);
    }
  }
  return out;
}

export async function createMatch(
  sessionId: string,
  homeTeam: TeamColor,
  awayTeam: TeamColor,
  homeScore: number,
  awayScore: number
): Promise<Match> {
  if (homeTeam === awayTeam) throw new Error("אותה קבוצה משני הצדדים");
  const data = await rest<unknown[]>(`/rest/v1/${MATCHES_TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      home_team: homeTeam,
      away_team: awayTeam,
      home_score: homeScore,
      away_score: awayScore,
    }),
  });
  const row = Array.isArray(data) ? data[0] : null;
  const m = row && typeof row === "object" ? mapMatch(row as Record<string, unknown>) : null;
  if (!m) throw new Error("לא נוסף משחק");
  return m;
}

export async function updateMatchScore(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  await rest(`/rest/v1/${MATCHES_TABLE}?id=eq.${matchId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      home_score: homeScore,
      away_score: awayScore,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function deleteMatch(matchId: string): Promise<void> {
  await rest(`/rest/v1/${MATCHES_TABLE}?id=eq.${matchId}`, { method: "DELETE" });
}

export async function listMatchGoalsForSession(
  sessionId: string,
  checkedIn: CheckedInPlayer[] = []
): Promise<MatchGoal[]> {
  const matches = await listMatches(sessionId);
  if (matches.length === 0) return [];

  const nameById = new Map(checkedIn.map((p) => [p.id, p.name]));
  const matchIds = matches.map((m) => m.id).join(",");
  const data = await rest<unknown[]>(
    `/rest/v1/${MATCH_GOALS_TABLE}?match_id=in.(${matchIds})&order=created_at.asc`
  );
  if (!Array.isArray(data)) return [];

  const out: MatchGoal[] = [];
  for (const row of data) {
    if (row && typeof row === "object") {
      const g = mapMatchGoal(row as Record<string, unknown>, nameById);
      if (g) out.push(g);
    }
  }
  return out;
}

export async function addMatchGoal(
  matchId: string,
  scorerId: string,
  assistId: string | null
): Promise<MatchGoal> {
  if (assistId && assistId === scorerId) {
    throw new Error("כובש ובישל לא יכולים להיות אותו שחקן");
  }
  const body: Record<string, string> = {
    match_id: matchId,
    scorer_id: scorerId,
  };
  if (assistId) body.assist_id = assistId;

  const data = await rest<unknown[]>(`/rest/v1/${MATCH_GOALS_TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") throw new Error("לא נוסף שער");
  const g = mapMatchGoal(row as Record<string, unknown>, new Map());
  if (!g) throw new Error("לא נוסף שער");
  return g;
}

export async function deleteMatchGoal(goalId: string): Promise<void> {
  await rest(`/rest/v1/${MATCH_GOALS_TABLE}?id=eq.${goalId}`, { method: "DELETE" });
}

export async function loadPublishedGameDay(): Promise<PublishedGameDay | null> {
  const sessions = await rest<unknown[]>(
    `/rest/v1/${SESSIONS_TABLE}?status=in.(published,closed,final)&order=created_at.desc&limit=1`
  );
  const row = Array.isArray(sessions) ? sessions[0] : null;
  const session = row && typeof row === "object" ? mapSession(row as Record<string, unknown>) : null;
  if (!session) return null;

  const assignments = await loadTeamAssignments(session.id);
  const checkedIn = await listCheckedIn(session.id);
  const rawMatches = await listMatches(session.id);
  const goals = await listMatchGoalsForSession(session.id, checkedIn);
  const matches = attachGoalsToMatches(rawMatches, goals);
  const isOpen = session.status === "published";

  const playersByTeam: PublishedGameDay["playersByTeam"] = {
    green: [],
    yellow: [],
    orange: [],
  };
  for (const p of checkedIn) {
    if (p.team) playersByTeam[p.team].push(p);
  }
  for (const t of ["green", "yellow", "orange"] as TeamColor[]) {
    playersByTeam[t] = sortPlayersByStrength(playersByTeam[t]);
  }

  return { session, teams: assignments, playersByTeam, matches, isOpen };
}

/** Admin PIN stored in app_settings (plain text — internal friends app). */
export async function fetchAdminPin(): Promise<string | null> {
  const data = await rest<unknown[]>(
    `/rest/v1/${APP_SETTINGS_TABLE}?key=eq.${ADMIN_PIN_KEY}&select=value&limit=1`
  );
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") return null;
  const value = (data[0] as { value?: string }).value;
  return typeof value === "string" && value.length > 0 ? value : null;
}
