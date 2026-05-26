export type TeamColor = "blue" | "yellow" | "orange";

export interface Player {
  id: string;
  name: string;
  strength: number | null;
  active: boolean;
}

export interface Session {
  id: string;
  status: "draft" | "final";
  createdAt: string;
}

export interface CheckedInPlayer extends Player {
  team?: TeamColor;
}

export interface TeamAssignments {
  blue: string[];
  yellow: string[];
  orange: string[];
}
