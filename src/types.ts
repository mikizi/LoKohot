export type TeamColor = "green" | "yellow" | "orange";

export interface Player {
  id: string;
  name: string;
  strength: number | null;
  active: boolean;
}

export type SessionStatus = "draft" | "published" | "closed";

export interface Session {
  id: string;
  status: SessionStatus;
  createdAt: string;
  title: string | null;
}

export interface MatchGoal {
  id: string;
  matchId: string;
  scorerId: string;
  scorerName: string;
  assistId: string | null;
  assistName: string | null;
  createdAt: string;
}

export interface Match {
  id: string;
  sessionId: string;
  homeTeam: TeamColor;
  awayTeam: TeamColor;
  homeScore: number;
  awayScore: number;
  createdAt: string;
  goals: MatchGoal[];
}

export interface PublishedGameDay {
  session: Session;
  teams: TeamAssignments;
  playersByTeam: Record<TeamColor, CheckedInPlayer[]>;
  matches: Match[];
  /** True while the night is live — anyone can add or edit games. */
  isOpen: boolean;
}

export interface CheckedInPlayer extends Player {
  team?: TeamColor;
}

export interface TeamAssignments {
  green: string[];
  yellow: string[];
  orange: string[];
}
