import { getAppState, setAssignments } from "../appState";
import { sortPlayerIdsByStrength } from "../sortPlayers";
import { balanceTeams } from "../balance";
import type { CheckedInPlayer, Session, TeamAssignments, TeamColor } from "../types";
import * as db from "../lokohotDb";
import { $, showError, clearError } from "./dom";
import type { CheckInState } from "./checkIn";

const TEAMS: TeamColor[] = ["green", "yellow", "orange"];

let currentSession: Session | null = null;
let assignments: TeamAssignments = { green: [], yellow: [], orange: [] };
let playerById = new Map<string, CheckedInPlayer>();
let teamsDirty = false;

let draggedId: string | null = null;

export function initTeams(): void {
  for (const team of TEAMS) {
    const list = document.querySelector(`[data-team-list="${team}"]`);
    if (!list) continue;

    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const ev = e as DragEvent;
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      list.classList.add("team-list--drag-over");
    });

    list.addEventListener("dragleave", () => {
      list.classList.remove("team-list--drag-over");
    });

    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.classList.remove("team-list--drag-over");
      if (!draggedId) return;
      movePlayerToTeam(draggedId, team);
      draggedId = null;
    });
  }

  $("btnBalance").addEventListener("click", () => void runBalance());
  $("btnRebalance").addEventListener("click", () => void runBalance());

  const saveBtn = document.getElementById("btnSaveTeams");
  saveBtn?.addEventListener("click", () => void saveTeamsNow());
}

export function syncFromCheckIn(state: CheckInState): void {
  currentSession = state.session;
  playerById = new Map(state.checkedIn.map((p) => [p.id, p]));

  const checkedIds = new Set(state.checkedIn.map((p) => p.id));
  const prune = (ids: string[]) => ids.filter((id) => checkedIds.has(id));

  const fromApp = getAppState()?.assignments;
  if (fromApp) {
    assignments = {
      green: prune(fromApp.green),
      yellow: prune(fromApp.yellow),
      orange: prune(fromApp.orange),
    };
  } else {
    assignments = {
      green: prune(assignments.green),
      yellow: prune(assignments.yellow),
      orange: prune(assignments.orange),
    };
  }

  teamsDirty = false;
  renderTeams();
  updateSaveTeamsHint();
}

async function saveTeamsNow(): Promise<void> {
  if (!currentSession || !teamsDirty) return;
  clearError();
  try {
    await db.saveTeamAssignments(currentSession.id, assignments);
    setAssignments(assignments);
    teamsDirty = false;
    updateSaveTeamsHint();
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נשמר");
  }
}

function updateSaveTeamsHint(): void {
  const el = document.getElementById("teamsSaveHint");
  if (!el) return;
  if (teamsDirty) {
    el.classList.remove("hidden");
    el.textContent = "יש שינויים שלא נשמרו — לחץ שמור קבוצות";
  } else {
    el.classList.add("hidden");
  }
}

export async function runBalance(): Promise<void> {
  clearError();
  const players = [...playerById.values()].filter((p) => p.strength !== null);
  if (players.length < 3) {
    showError("צריך לפחות 3 שחקנים עם דירוג");
    return;
  }
  if (players.length % 3 !== 0) {
    showError(`יש ${players.length} שחקנים — המספר חייב להתחלק ב-3`);
    return;
  }

  try {
    const result = balanceTeams(
      players.map((p) => ({ id: p.id, strength: p.strength as number }))
    );
    assignments = result.assignments;
    teamsDirty = true;
    renderTeams();
    if (currentSession) {
      await db.saveTeamAssignments(currentSession.id, assignments);
      setAssignments(assignments);
      teamsDirty = false;
      updateSaveTeamsHint();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "שגיאת איזון");
  }
}

function movePlayerToTeam(playerId: string, team: TeamColor): void {
  for (const t of TEAMS) {
    assignments[t] = assignments[t].filter((id) => id !== playerId);
  }
  assignments[team].push(playerId);
  teamsDirty = true;
  renderTeams();
  updateSaveTeamsHint();
}

function renderTeams(): void {
  for (const team of TEAMS) {
    const list = document.querySelector(`[data-team-list="${team}"]`);
    const col = document.querySelector(`.team-col[data-team="${team}"]`);
    if (!list || !col) continue;

    list.replaceChildren();
    const ids = sortPlayerIdsByStrength(assignments[team], playerById);
    const strengths = ids
      .map((id) => playerById.get(id)?.strength)
      .filter((s): s is number => s !== null && s !== undefined);

    const avgEl = col.querySelector("[data-avg]");
    if (avgEl) {
      avgEl.textContent =
        strengths.length > 0
          ? `ממוצע ≈ ${(strengths.reduce((a, b) => a + b, 0) / strengths.length).toFixed(2)}`
          : "—";
    }

    for (const id of ids) {
      const p = playerById.get(id);
      if (!p) continue;
      const li = document.createElement("li");
      li.className = "player-card";
      li.draggable = true;
      li.setAttribute("data-player-id", id);

      li.innerHTML = `
        <span class="player-card__name">${escapeHtml(p.name)}</span>
        <span class="player-card__strength">${p.strength ?? "?"}</span>
      `;

      li.addEventListener("dragstart", (e) => {
        draggedId = id;
        li.classList.add("player-card--dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
        }
      });

      li.addEventListener("dragend", () => {
        li.classList.remove("player-card--dragging");
        draggedId = null;
      });

      list.appendChild(li);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
