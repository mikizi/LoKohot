import { getAppState, loadAppState } from "../appState";
import { suggestPlayers } from "../matchPlayers";
import { normalizeName } from "../parsePlayerList";
import * as db from "../lokohotDb";
import { clearError, showError } from "./dom";
import { refreshCheckInUi, type CheckInChangeHandler } from "./checkIn";

export interface UnmatchedLine {
  name: string;
  strength?: number;
}

let onChange: CheckInChangeHandler = () => {};
let pending: UnmatchedLine[] = [];

export function initUnmatchedPlayers(onChanged: CheckInChangeHandler): void {
  onChange = onChanged;
  const panel = document.getElementById("unmatchedPanel");
  panel?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const row = t.closest("[data-unmatched-idx]");
    if (!row || !(row instanceof HTMLElement)) return;
    const idx = Number(row.getAttribute("data-unmatched-idx"));
    if (Number.isNaN(idx)) return;

    if (t.closest("[data-action=refresh-suggestions]")) {
      refreshRowSuggestions(idx);
      return;
    }
    if (t.closest("[data-action=link-player]")) {
      void linkToExisting(idx);
      return;
    }
    if (t.closest("[data-action=create-player]")) {
      void createAndCheckIn(idx);
      return;
    }
    if (t.closest("[data-action=dismiss]")) {
      pending.splice(idx, 1);
      renderUnmatchedPanel();
      return;
    }
  });

  panel?.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLSelectElement)) return;
    if (!t.matches("[data-suggestion-select]")) return;
    const row = t.closest("[data-unmatched-idx]");
    if (!row || !(row instanceof HTMLElement)) return;
    const idx = Number(row.getAttribute("data-unmatched-idx"));
    if (Number.isNaN(idx)) return;
    const opt = t.selectedOptions[0];
    const strength = opt?.getAttribute("data-strength");
    const strengthInput = row.querySelector("[data-strength-input]") as HTMLInputElement | null;
    if (strengthInput && strength) {
      strengthInput.value = strength;
    }
  });
}

export function showUnmatchedPanel(lines: UnmatchedLine[]): void {
  pending = lines.map((l) => ({ ...l }));
  renderUnmatchedPanel();
}

function renderUnmatchedPanel(): void {
  const panel = document.getElementById("unmatchedPanel");
  const list = document.getElementById("unmatchedList");
  if (!panel || !list) return;

  if (pending.length === 0) {
    panel.classList.add("hidden");
    list.replaceChildren();
    return;
  }

  panel.classList.remove("hidden");
  const app = getAppState();
  const roster = app?.roster ?? [];

  list.replaceChildren();

  pending.forEach((line, idx) => {
    const editName = line.name;
    const suggestions = suggestPlayers(editName, roster, 6);

    const row = document.createElement("div");
    row.className = "unmatched-row";
    row.setAttribute("data-unmatched-idx", String(idx));

    const optionsHtml =
      suggestions.length === 0
        ? '<option value="">אין הצעות — ערוך שם או שמור חדש</option>'
        : [
            '<option value="">בחר מהמאגר...</option>',
            ...suggestions.map(
              (s) =>
                `<option value="${escapeAttr(s.player.id)}" data-strength="${s.player.strength ?? ""}">${escapeHtml(s.player.name)} (${s.player.strength ?? "?"}) — ${escapeHtml(s.label)}</option>`
            ),
          ].join("");

    row.innerHTML = `
      <div class="unmatched-row__head">
        <span class="unmatched-row__label">הודבק: ${escapeHtml(line.name)}</span>
        <button type="button" class="chip-remove" data-action="dismiss" aria-label="הסר">×</button>
      </div>
      <div class="unmatched-row__fields">
        <label class="unmatched-field">
          <span>שם לחיפוש</span>
          <input type="text" class="input" id="unmatched-name-${idx}" value="${escapeAttr(editName)}" data-name-input maxlength="80" />
        </label>
        <button type="button" class="btn btn--ghost btn--compact" data-action="refresh-suggestions">חפש התאמות</button>
      </div>
      <label class="unmatched-field">
        <span>התאמה מהמאגר</span>
        <select class="input" data-suggestion-select>${optionsHtml}</select>
      </label>
      <div class="unmatched-row__actions">
        <label class="unmatched-field unmatched-field--strength">
          <span>כוח (שחקן חדש)</span>
          <input type="number" class="input input--narrow" data-strength-input min="1" max="6" step="0.5" value="${line.strength ?? ""}" placeholder="3" />
        </label>
        <button type="button" class="btn btn--secondary btn--compact" data-action="link-player">הוסף מהמאגר</button>
        <button type="button" class="btn btn--primary btn--compact" data-action="create-player">שמור חדש במאגר</button>
      </div>
    `;

    list.appendChild(row);
  });
}

function refreshRowSuggestions(idx: number): void {
  const row = document.querySelector(`[data-unmatched-idx="${idx}"]`);
  const input = row?.querySelector("[data-name-input]") as HTMLInputElement | null;
  if (input && pending[idx]) {
    pending[idx].name = input.value.trim();
  }
  renderUnmatchedPanel();
}

function readRow(idx: number): {
  editName: string;
  strength: number | undefined;
  playerId: string | null;
} | null {
  const row = document.querySelector(`[data-unmatched-idx="${idx}"]`);
  if (!row || !pending[idx]) return null;

  const nameInput = row.querySelector("[data-name-input]") as HTMLInputElement;
  const strengthInput = row.querySelector("[data-strength-input]") as HTMLInputElement;
  const select = row.querySelector("[data-suggestion-select]") as HTMLSelectElement;

  const editName = nameInput.value.trim();
  const raw = strengthInput.value.trim();
  const strength = raw ? Number(raw) : undefined;
  const playerId = select.value || null;

  return { editName, strength, playerId };
}

async function linkToExisting(idx: number): Promise<void> {
  clearError();
  const row = readRow(idx);
  const app = getAppState();
  if (!row || !app) return;

  if (!row.playerId) {
    showError("בחר שחקן מהרשימה או שמור כחדש");
    return;
  }

  const already = app.checkedIn.some((p) => p.id === row.playerId);
  if (already) {
    showError("השחקן כבר ברשימה להערב");
    pending.splice(idx, 1);
    renderUnmatchedPanel();
    return;
  }

  try {
    const player = app.roster.find((p) => p.id === row.playerId);
    if (player?.strength === null) {
      showError("לשחקן אין דירוג — הזן כוח ושמור חדש, או ערוך במאגר");
      return;
    }
    await db.checkIn(app.session.id, row.playerId);
    pending.splice(idx, 1);
    const state = await loadAppState();
    renderUnmatchedPanel();
    await refreshCheckInUi();
    onChange({ session: state.session, checkedIn: state.checkedIn });
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נוסף");
  }
}

async function createAndCheckIn(idx: number): Promise<void> {
  clearError();
  const row = readRow(idx);
  const app = getAppState();
  if (!row || !app) return;

  const name = row.editName || pending[idx].name;
  if (!name) {
    showError("נא להזין שם");
    return;
  }

  if (row.strength === undefined || row.strength < 1 || row.strength > 6) {
    showError("נא להזין כוח בין 1 ל־6");
    return;
  }

  const existing = app.roster.find((p) => normalizeName(p.name) === normalizeName(name));
  if (existing) {
    showError(`"${existing.name}" כבר במאגר — השתמש ב「הוסף מהמאגר」`);
    return;
  }

  try {
    const player = await db.createPlayer(name, row.strength);
    await db.checkIn(app.session.id, player.id);
    pending.splice(idx, 1);
    await loadAppState();
    renderUnmatchedPanel();
    const slice = await refreshCheckInUi();
    onChange(slice);
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

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
