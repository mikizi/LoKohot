/** One line from a pasted roster. */
export interface ParsedPlayerLine {
  name: string;
  /** Omitted when line is name-only. */
  strength?: number;
}

const STRENGTH_RE = /^([1-6](?:\.5)?)$/;

/**
 * Parse pasted text: one player per line.
 * Supports ChatGPT-style "שם → 3", "name -> 3", "name: 3", "name, 3", or name only.
 */
export function parsePlayerList(text: string): ParsedPlayerLine[] {
  const lines = text.split(/\r?\n/);
  const out: ParsedPlayerLine[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const key = normalizeName(parsed.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }

  return out;
}

function parseLine(raw: string): ParsedPlayerLine | null {
  let line = raw.trim();
  if (!line) return null;
  if (line.startsWith("#") || line.startsWith("—") || line.startsWith("--")) return null;
  if (/^רשימת|^כל השחקנים|^שחקנים/i.test(line)) return null;

  // Strip leading bullets / numbers
  line = line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "");

  const arrowParts = line.split(/\s*(?:→|->|—)\s*/);
  if (arrowParts.length >= 2) {
    const name = arrowParts[0].trim();
    const strength = parseStrength(arrowParts[arrowParts.length - 1]);
    if (name && strength !== undefined) return { name, strength };
    if (name) return { name };
  }

  const colonIdx = line.indexOf(":");
  if (colonIdx > 0) {
    const name = line.slice(0, colonIdx).trim();
    const strength = parseStrength(line.slice(colonIdx + 1).trim());
    if (name && strength !== undefined) return { name, strength };
  }

  const commaMatch = line.match(/^(.+?),\s*([1-6](?:\.5)?)\s*$/);
  if (commaMatch) {
    return { name: commaMatch[1].trim(), strength: Number(commaMatch[2]) };
  }

  const tailMatch = line.match(/^(.+?)\s+([1-6](?:\.5)?)\s*$/);
  if (tailMatch && tailMatch[1].length > 1) {
    return { name: tailMatch[1].trim(), strength: Number(tailMatch[2]) };
  }

  if (line.length >= 1) return { name: line };
  return null;
}

function parseStrength(s: string): number | undefined {
  const t = s.trim();
  if (!STRENGTH_RE.test(t)) return undefined;
  const n = Number(t);
  if (n < 1 || n > 6) return undefined;
  return n;
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}
