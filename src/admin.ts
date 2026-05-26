import "./styles.css";
import { isAdminUnlocked, lockAdmin, tryUnlockAdmin } from "./adminAuth";
import { loadAppState } from "./appState";
import * as db from "./lokohotDb";
import { initCheckIn, renderCheckedIn } from "./ui/checkIn";
import { initPasteList } from "./ui/pasteList";
import { initPublish } from "./ui/publish";
import { initUnmatchedPlayers } from "./ui/unmatchedPlayers";
import { initTeams, syncFromCheckIn } from "./ui/teams";
import { $ } from "./ui/dom";

function showAdminApp(): void {
  document.getElementById("adminGate")?.classList.add("hidden");
  document.getElementById("adminApp")?.classList.remove("hidden");
}

function showAdminGate(message?: string): void {
  document.getElementById("adminGate")?.classList.remove("hidden");
  document.getElementById("adminApp")?.classList.add("hidden");
  const err = document.getElementById("adminLoginError");
  if (err && message) err.textContent = message;
}

function initAdminLogin(): void {
  const form = document.getElementById("adminLoginForm") as HTMLFormElement | null;

  if (!db.isDbConfigured()) {
    showAdminGate("חבר Supabase ב-.env לפני כניסה");
    return;
  }

  if (isAdminUnlocked()) {
    showAdminApp();
    return;
  }

  showAdminGate();

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    void (async () => {
      const pin = (document.getElementById("adminPin") as HTMLInputElement).value;
      const err = document.getElementById("adminLoginError");
      if (err) err.textContent = "";

      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "בודק...";
      }

      const ok = await tryUnlockAdmin(pin);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "כניסה";
      }

      if (ok) {
        showAdminApp();
        await bootApp();
      } else if (err) {
        err.textContent = "קוד שגוי";
      }
    })();
  });
}

document.getElementById("adminLogout")?.addEventListener("click", () => {
  lockAdmin();
  location.reload();
});

async function bootApp(): Promise<void> {
  const banner = $("dbBanner");

  if (!db.isDbConfigured()) {
    banner.textContent =
      "Supabase לא מוגדר — הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY ל-.env";
    banner.classList.remove("hidden");
    initCheckIn(() => {});
    initPasteList(() => {});
    initUnmatchedPlayers(() => {});
    initTeams();
    initPublish();
    return;
  }

  banner.classList.add("hidden");

  const onCheckInChange = (state: {
    session: import("./types").Session;
    checkedIn: import("./types").CheckedInPlayer[];
  }) => {
    syncFromCheckIn(state);
  };

  initCheckIn(onCheckInChange);
  initPasteList(onCheckInChange);
  initUnmatchedPlayers(onCheckInChange);
  initTeams();
  initPublish();

  try {
    const app = await loadAppState();
    const slice = { session: app.session, checkedIn: app.checkedIn };
    renderCheckedIn(slice);
    syncFromCheckIn(slice);
  } catch (err) {
    banner.textContent = err instanceof Error ? err.message : "שגיאת טעינה";
    banner.classList.remove("hidden");
  }
}

function boot(): void {
  initAdminLogin();
  if (isAdminUnlocked() && db.isDbConfigured()) {
    showAdminApp();
    void bootApp();
  }
}

boot();
