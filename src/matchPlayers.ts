import { normalizeName } from "./parsePlayerList";
import type { Player } from "./types";

export interface MatchSuggestion {
  player: Player;
  score: number;
  label: string;
}

/**
 * Suggest roster players for a pasted name (substring, token, light edit distance).
 */
export function suggestPlayers(query: string, roster: Player[], limit = 5): MatchSuggestion[] {
  const q = normalizeName(query);
  if (!q) return [];

  const qLower = q.toLowerCase();
  const scored: MatchSuggestion[] = [];

  for (const p of roster) {
    const name = normalizeName(p.name);
    const nameLower = name.toLowerCase();
    const tokens = name.split(/\s+/).filter(Boolean);

    let score = 0;
    let label = "";

    if (nameLower === qLower) {
      score = 100;
      label = "התאמה מדויקת";
    } else if (nameLower.includes(qLower)) {
      score = 85;
      label = "שם מלא מכיל";
    } else if (qLower.length >= 3 && nameLower.startsWith(qLower)) {
      score = 82;
      label = "מתחיל באותו שם";
    } else {
      for (const token of tokens) {
        const tLower = token.toLowerCase();
        if (tLower === qLower) {
          score = Math.max(score, 78);
          label = `שם משפחה/פרטי: ${token}`;
        } else if (tLower.startsWith(qLower) || qLower.startsWith(tLower)) {
          score = Math.max(score, 72);
          label = `דומה ל־${token}`;
        } else if (q.length >= 3 && tLower.includes(qLower)) {
          score = Math.max(score, 68);
          label = `מופיע ב־${name}`;
        } else if (editDistance(qLower, tLower) <= 2 && Math.min(q.length, token.length) >= 3) {
          score = Math.max(score, 55);
          label = `קרוב ל־${token}`;
        }
      }
      if (score === 0 && editDistance(qLower, nameLower) <= 2 && q.length >= 4) {
        score = 50;
        label = "שם דומה";
      }
    }

    if (score > 0) {
      scored.push({ player: p, score, label });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name, "he"));
  return scored.slice(0, limit);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
