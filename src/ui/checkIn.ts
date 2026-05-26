import type { CheckedInPlayer, Player, Session } from "../types";
import * as db from "../lokohotDb";
import { $, clearError, showError } from "./dom";

export interface CheckInState {
  session: Session;
  checkedIn: CheckedInPlayer[];
}

export type CheckInChangeHandler = (state: CheckInState) => void;

let strengthTargetId: string | null = null;
let onChange: CheckInChangeHandler = () => {};

export function initCheckIn(onChanged: CheckInChangeHandler): void {
  onChange = onChanged;

  const searchInput = $("playerSearch") as HTMLInputElement;
  const results = $("searchResults");
  const newForm = $("newPlayerForm") as HTMLFormElement;
  const strengthDialog = $("strengthDialog") as HTMLDialogElement;
  const strengthForm = $("strengthForm") as HTMLFormElement;

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  searchInput.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void runSearch(searchInput.value, results), 200);
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => results.classList.add("hidden"), 150);
  });

  results.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  newForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void onNewPlayer(newForm);
  });

  strengthForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void onStrengthSave(strengthDialog);
  });

  $("strengthCancel").addEventListener("click", () => {
    strengthDialog.close();
    strengthTargetId = null;
  });

  $("checkedInList").addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const chip = t.closest("[data-player-id]");
    if (!chip || !(chip instanceof HTMLElement)) return;
    const id = chip.getAttribute("data-player-id");
    if (!id) return;

    if (t.closest("[data-action=remove]")) {
      void removeCheckedIn(id);
      return;
    }
    if (t.closest("[data-action=edit-strength]")) {
      openStrengthDialog(id, chip.getAttribute("data-player-name") ?? "", chip.getAttribute("data-strength"));
    }
  });
}

export async function loadCheckInState(): Promise<CheckInState> {
  const session = await db.getOrCreateDraftSession();
  const checkedIn = await db.listCheckedIn(session.id);
  return { session, checkedIn };
}

export function renderCheckedIn(state: CheckInState): void {
  const list = $("checkedInList");
  const count = $("checkinCount");

  list.replaceChildren();
  for (const p of state.checkedIn) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.setAttribute("data-player-id", p.id);
    chip.setAttribute("data-player-name", p.name);
    chip.setAttribute("data-strength", p.strength === null ? "" : String(p.strength));

    const strengthLabel =
      p.strength === null
        ? '<span class="chip-strength chip-strength--missing">ללא דירוג</span>'
        : `<button type="button" class="chip-strength" data-action="edit-strength">${p.strength}</button>`;

    chip.innerHTML = `
      <span class="chip-name">${escapeHtml(p.name)}</span>
      ${strengthLabel}
      <button type="button" class="chip-remove" data-action="remove" aria-label="הסר">×</button>
    `;
    list.appendChild(chip);
  }

  const n = state.checkedIn.length;
  const mod = n % 3;
  count.textContent =
    n === 0
      ? "אין שחקנים עדיין"
      : mod === 0
        ? `${n} שחקנים — מוכן לאיזון`
        : `${n} שחקנים — צריך עוד ${3 - mod} כדי לאזן`;
}

async function runSearch(query: string, resultsEl: HTMLElement): Promise<void> {
  if (!db.isDbConfigured()) return;
  try {
    const players = await db.searchPlayers(query);
    resultsEl.replaceChildren();
    if (players.length === 0) {
      resultsEl.classList.add("hidden");
      return;
    }
    for (const p of players) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-result-btn";
      btn.textContent = p.strength !== null ? `${p.name} (${p.strength})` : `${p.name} — ללא דירוג`;
      btn.addEventListener("click", () => {
        void addCheckedIn(p);
        (document.getElementById("playerSearch") as HTMLInputElement).value = "";
        resultsEl.classList.add("hidden");
      });
      li.appendChild(btn);
      resultsEl.appendChild(li);
    }
    resultsEl.classList.remove("hidden");
  } catch (err) {
    showError(err instanceof Error ? err.message : "שגיאת חיפוש");
  }
}

async function onNewPlayer(form: HTMLFormElement): Promise<void> {
  clearError();
  const nameInput = form.querySelector("#newPlayerName") as HTMLInputElement;
  const strengthInput = form.querySelector("#newPlayerStrength") as HTMLInputElement;
  const name = nameInput.value.trim();
  const strength = Number(strengthInput.value);
  if (!name) return;

  try {
    const player = await db.createPlayer(name, strength);
    nameInput.value = "";
    await addCheckedIn(player);
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נוסף שחקן");
  }
}

async function addCheckedIn(player: Player): Promise<void> {
  clearError();
  if (player.strength === null) {
    openStrengthDialog(player.id, player.name, "");
    strengthTargetId = player.id;
    return;
  }

  const state = await loadCheckInState();
  if (state.checkedIn.some((p) => p.id === player.id)) {
    showError("השחקן כבר ברשימה");
    return;
  }

  try {
    await db.checkIn(state.session.id, player.id);
    const next = await loadCheckInState();
    renderCheckedIn(next);
    onChange(next);
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נוסף לרשימה");
  }
}

async function removeCheckedIn(playerId: string): Promise<void> {
  clearError();
  try {
    const state = await loadCheckInState();
    await db.checkOut(state.session.id, playerId);
    const next = await loadCheckInState();
    renderCheckedIn(next);
    onChange(next);
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא הוסר");
  }
}

function openStrengthDialog(id: string, name: string, strength: string | null): void {
  strengthTargetId = id;
  $("strengthDialogName").textContent = name;
  const input = $("strengthInput") as HTMLInputElement;
  input.value = strength && strength !== "" ? strength : "3";
  ($("strengthDialog") as HTMLDialogElement).showModal();
}

async function onStrengthSave(dialog: HTMLDialogElement): Promise<void> {
  if (!strengthTargetId) {
    dialog.close();
    return;
  }
  const strength = Number(($("strengthInput") as HTMLInputElement).value);
  clearError();
  try {
    await db.updatePlayer(strengthTargetId, { strength });
    const state = await loadCheckInState();
    const alreadyIn = state.checkedIn.some((p) => p.id === strengthTargetId);
    if (!alreadyIn) {
      await db.checkIn(state.session.id, strengthTargetId);
    }
    const next = await loadCheckInState();
    renderCheckedIn(next);
    onChange(next);
    dialog.close();
    strengthTargetId = null;
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נשמר");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
