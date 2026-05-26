import * as db from "../lokohotDb";
import { getAppState } from "../appState";
import { clearError, showError } from "./dom";

export function initPublish(): void {
  document.getElementById("btnPublish")?.addEventListener("click", () => void onPublish());
  document.getElementById("btnCloseDay")?.addEventListener("click", () => void onCloseDay());
}

async function onPublish(): Promise<void> {
  clearError();
  const app = getAppState();
  if (!app) {
    showError("אין סשן פעיל");
    return;
  }

  const n = app.checkedIn.length;
  if (n < 3 || n % 3 !== 0) {
    showError("לפרסום צריך קבוצות מאוזנות (מספר שחקנים מתחלק ב-3)");
    return;
  }

  const hasTeams =
    app.assignments.green.length + app.assignments.yellow.length + app.assignments.orange.length >=
    n;
  if (!hasTeams) {
    showError("שמור קבוצות לפני פרסום");
    return;
  }

  const titleInput = document.getElementById("publishTitle") as HTMLInputElement | null;
  const title = titleInput?.value.trim();

  if (!confirm("לפרסם את הערב לעמוד הציבורי? הערב הקודם יוסר מהתצוגה.")) {
    return;
  }

  try {
    await db.publishSession(app.session.id, title || undefined);
    const status = document.getElementById("publishStatus");
    if (status) {
      status.classList.remove("hidden");
      status.textContent = "פורסם! כולם יכולים להוסיף משחקים בעמוד הציבורי.";
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא פורסם");
  }
}

async function onCloseDay(): Promise<void> {
  clearError();
  if (
    !confirm(
      "לסגור את הערב? לא יהיה אפשר להוסיף או לערוך משחקים ושערים — רק לצפות."
    )
  ) {
    return;
  }

  try {
    const closed = await db.closeActiveDay();
    if (!closed) {
      showError("אין ערב פתוח לסגירה (פרסם קודם)");
      return;
    }
    const status = document.getElementById("publishStatus");
    if (status) {
      status.classList.remove("hidden");
      status.textContent = "הערב נסגר.";
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "לא נסגר");
  }
}
