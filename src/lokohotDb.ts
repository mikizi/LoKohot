/**
 * Supabase PostgREST client (no @supabase/js) — same pattern as eurovision-hit-or-script.
 */
import type { CheckedInPlayer, Player, Session, TeamAssignments, TeamColor } from "./types";

const PLAYERS_TABLE = "players";
const SESSIONS_TABLE = "sessions";
const SESSION_PLAYERS_TABLE = "session_players";
const TEAM_ASSIGNMENTS_TABLE = "team_assignments";

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
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
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
  const status = row.status;
  if (status !== "draft" && status !== "final") return null;
  return { id: row.id, status, createdAt: row.created_at };
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

export async function createPlayer(name: string, strength: number): Promise<Player> {
  const body = {
    name: name.trim(),
    strength,
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
  for (const t of ["blue", "yellow", "orange"] as TeamColor[]) {
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

export async function checkIn(sessionId: string, playerId: string): Promise<void> {
  await rest(`/rest/v1/${SESSION_PLAYERS_TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ session_id: sessionId, player_id: playerId }),
  });
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
  const empty: TeamAssignments = { blue: [], yellow: [], orange: [] };
  const data = await rest<unknown[]>(
    `/rest/v1/${TEAM_ASSIGNMENTS_TABLE}?session_id=eq.${sessionId}`
  );
  if (!Array.isArray(data)) return empty;

  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as { player_id?: string; team?: string };
    if (typeof r.player_id !== "string") continue;
    if (r.team === "blue" || r.team === "yellow" || r.team === "orange") {
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
  for (const team of ["blue", "yellow", "orange"] as TeamColor[]) {
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
