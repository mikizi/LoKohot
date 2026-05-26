import * as db from "./lokohotDb";

const STORAGE_KEY = "lokohot-admin-ok";

export function isAdminUnlocked(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function lockAdmin(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Validate PIN against Supabase app_settings (fallback: VITE_ADMIN_PIN in .env). */
export async function tryUnlockAdmin(pin: string): Promise<boolean> {
  let expected: string | null = null;

  if (db.isDbConfigured()) {
    try {
      expected = await db.fetchAdminPin();
    } catch {
      return false;
    }
  }

  if (!expected) {
    const fromEnv = String(import.meta.env.VITE_ADMIN_PIN ?? "").trim();
    expected = fromEnv || null;
  }

  if (!expected) {
    return false;
  }

  if (pin.trim() !== expected) {
    return false;
  }

  sessionStorage.setItem(STORAGE_KEY, "1");
  return true;
}
