import { getAppState, loadAppState } from "../appState";
import { normalizeName, parsePlayerList } from "../parsePlayerList";
import type { Player } from "../types";
import * as db from "../lokohotDb";
import { clearError, showError } from "./dom";
import { renderCheckedIn, type CheckInChangeHandler } from "./checkIn";
import { showUnmatchedPanel, type UnmatchedLine } from "./unmatchedPlayers";

export interface PasteResult {
  checkedIn: number;
  skippedAlready: number;
  created: number;
  updatedStrength: number;
  needsRating: string[];
  notFound: UnmatchedLine[];
}

let onChange: CheckInChangeHandler = () => {};

export function initPasteList(onChanged: CheckInChangeHandler): void {
  onChange = onChanged;
  const form = document.getElementById("pasteListForm") as HTMLFormElement | null;
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    void onPasteSubmit();
  });
}

async function onPasteSubmit(): Promise<void> {
  clearError();
  const textarea = document.getElementById("pasteListInput") as HTMLTextAreaElement | null;
  const status = document.getElementById("pasteStatus");
  const submitBtn = formSubmitButton();
  if (!textarea || !db.isDbConfigured()) return;

  const lines = parsePlayerList(textarea.value);
  if (lines.length === 0) {
    showError("לא זוהו שמות ברשימה");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "שומר...";
  }

  try {
    const result = await bulkCheckIn(lines);
    const state = await loadAppState();
    renderCheckedIn({ session: state.session, checkedIn: state.checkedIn });
    onChange({ session: state.session, checkedIn: state.checkedIn });

    if (status) {
      status.classList.remove("hidden");
      status.textContent = formatPasteResult(result);
    }
    if (result.notFound.length > 0) {
      showUnmatchedPanel(result.notFound);
    }
    textarea.value = "";
  } catch (err) {
    showError(err instanceof Error ? err.message : "שגיאה בהדבקה");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "הוסף את כולם להערב";
    }
  }
}

function formSubmitButton(): HTMLButtonElement | null {
  const form = document.getElementById("pasteListForm");
  return form?.querySelector('button[type="submit"]') ?? null;
}

export async function bulkCheckIn(
  lines: ReturnType<typeof parsePlayerList>
): Promise<PasteResult> {
  const app = getAppState();
  if (!app) {
    throw new Error("האפליקציה עדיין טוענת — נסה שוב בעוד רגע");
  }
  const byName = new Map<string, Player>();
  for (const p of app.roster) {
    byName.set(normalizeName(p.name), p);
  }

  const checkedInIds = new Set(app.checkedIn.map((p) => p.id));

  const result: PasteResult = {
    checkedIn: 0,
    skippedAlready: 0,
    created: 0,
    updatedStrength: 0,
    needsRating: [],
    notFound: [],
  };

  const toCreate: { name: string; strength: number | null }[] = [];
  const toCheckIn: string[] = [];
  const updateTasks: Promise<Player>[] = [];

  for (const line of lines) {
    const key = normalizeName(line.name);
    let player = byName.get(key);

    if (!player && line.strength !== undefined) {
      toCreate.push({ name: line.name, strength: line.strength });
      continue;
    }

    if (!player) {
      result.notFound.push({ name: line.name, strength: line.strength });
      continue;
    }

    if (line.strength !== undefined && player.strength !== line.strength) {
      updateTasks.push(db.updatePlayer(player.id, { strength: line.strength }));
      player = { ...player, strength: line.strength };
      byName.set(key, player);
      result.updatedStrength += 1;
    }

    if (player.strength === null) {
      result.needsRating.push(player.name);
      continue;
    }

    if (checkedInIds.has(player.id)) {
      result.skippedAlready += 1;
      continue;
    }

    toCheckIn.push(player.id);
    checkedInIds.add(player.id);
    result.checkedIn += 1;
  }

  if (toCreate.length > 0) {
    const created = await db.createPlayers(toCreate);
    result.created = created.length;
    for (const p of created) {
      byName.set(normalizeName(p.name), p);
      if (p.strength !== null && !checkedInIds.has(p.id)) {
        toCheckIn.push(p.id);
        checkedInIds.add(p.id);
        result.checkedIn += 1;
      } else if (p.strength === null) {
        result.needsRating.push(p.name);
      }
    }
  }

  await Promise.all(updateTasks);
  await db.checkInMany(app.session.id, toCheckIn);

  return result;
}

function formatPasteResult(r: PasteResult): string {
  const parts: string[] = [];
  if (r.checkedIn > 0) parts.push(`${r.checkedIn} נוספו להערב`);
  if (r.skippedAlready > 0) parts.push(`${r.skippedAlready} כבר היו ברשימה`);
  if (r.created > 0) parts.push(`${r.created} שחקנים חדשים נוצרו`);
  if (r.updatedStrength > 0) parts.push(`${r.updatedStrength} דירוגים עודכנו`);
  if (r.needsRating.length > 0) {
    parts.push(`ללא דירוג (לא נוספו): ${r.needsRating.join(", ")}`);
  }
  if (r.notFound.length > 0) {
    parts.push(`${r.notFound.length} לא נמצאו — טפל ברשימה למטה`);
  }
  return parts.length > 0 ? parts.join(" · ") : "לא בוצעו שינויים";
}
