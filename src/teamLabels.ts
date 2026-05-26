import type { TeamColor } from "./types";

export const TEAM_LABELS: Record<TeamColor, string> = {
  green: "ירוק",
  yellow: "צהוב",
  orange: "כתום",
};

export const TEAM_ORDER: TeamColor[] = ["green", "yellow", "orange"];

/** Round-robin pairings for 3 teams. */