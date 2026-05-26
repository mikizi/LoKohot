import { balanceTeams } from "../balance";
import type { CheckedInPlayer, Session, TeamAssignments, TeamColor } from "../types";
import * as db from "../lokohotDb";
import { $, debounce, showError, clearError } from "./dom";
import type { CheckInState } from "./checkIn";

const TEAMS: TeamColor[] = ["blue", "yellow", "orange"];

let currentSession: Session | null = null;
let assignments: TeamAssignments = { blue: [], yellow: [], orange: [] };
let playerById = new Map<string, CheckedInPlayer>();

let draggedId: string | null = null;

const saveDebounced = debounce(() => {
  if (!currentSession) return;
  void db.saveTeamAssignments(currentSession.id, assignments).catch((err) => {
    showError(err instanceof Error ? err.message : "לא נשמר");
  });
}, 400);

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
}

export function syncFromCheckIn(state: CheckInState): void {
  currentSession = state.session;
  playerById = new Map(state.checkedIn.map((p) => [p.id, p]));

  const checkedIds = new Set(state.checkedIn.map((p) => p.id));
  const prune = (ids: string[]) => ids.filter((id) => checkedIds.has(id));

  assignments = {
    blue: prune(assignments.blue),
    yellow: prune(assignments.yellow),
    orange: prune(assignments.orange),
  };

  void db.loadTeamAssignments(state.session.id).then((fromDb) => {
    const hasAny =
      fromDb.blue.length + fromDb.yellow.length + fromDb.orange.length > 0;
    if (hasAny) {
      assignments = {
        blue: prune(fromDb.blue),
        yellow: prune(fromDb.yellow),
        orange: prune(fromDb.orange),
      };
    }
    renderTeams();
  });
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
    renderTeams();
    if (currentSession) {
      await db.saveTeamAssignments(currentSession.id, assignments);
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
  renderTeams();
  saveDebounced();
}

function renderTeams(): void {
  for (const team of TEAMS) {
    const list = document.querySelector(`[data-team-list="${team}"]`);
    const col = document.querySelector(`.team-col[data-team="${team}"]`);
    if (!list || !col) continue;

    list.replaceChildren();
    const ids = assignments[team];
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
