import "./styles.css";
import * as db from "./lokohotDb";
import { initCheckIn, loadCheckInState, renderCheckedIn } from "./ui/checkIn";
import { initTeams, syncFromCheckIn } from "./ui/teams";
import { $ } from "./ui/dom";

async function boot(): Promise<void> {
  const banner = $("dbBanner");

  if (!db.isDbConfigured()) {
    banner.textContent =
      "Supabase לא מוגדר — הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY ל-.env (ראה README).";
    banner.classList.remove("hidden");
    initCheckIn(() => {});
    initTeams();
    return;
  }

  banner.classList.add("hidden");

  initCheckIn((state) => {
    syncFromCheckIn(state);
  });
  initTeams();

  try {
    const state = await loadCheckInState();
    renderCheckedIn(state);
    syncFromCheckIn(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "שגיאת טעינה";
    banner.textContent = msg;
    banner.classList.remove("hidden");
  }
}

void boot();
