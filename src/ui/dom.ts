export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export function showError(message: string): void {
  const banner = document.getElementById("errorBanner");
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
}

export function clearError(): void {
  const banner = document.getElementById("errorBanner");
  if (!banner) return;
  banner.textContent = "";
  banner.classList.add("hidden");
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
