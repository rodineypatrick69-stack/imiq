export type Team = "TM" | "TT" | "TN";
export type Page = "painel" | "diario" | "equipe" | "folgas" | "ausencias";
export interface Absence {
  name: string;
  start: string;
  end: string;
  reason?: string;
  note?: string;
}
export interface JournalRow {
  team: Team;
  name: string;
  status: string;
  note: string;
}
export interface Journal {
  date?: string;
  rows: JournalRow[];
  supervisor?: string;
  condition?: string;
  summary?: string;
  handoff?: string;
  updated?: string;
}
export interface Workspace {
  teams: Record<Team, string[]>;
  schedule: Record<string, Partial<Record<Team, string[]>>>;
  absences: Absence[];
  journals: Record<string, Journal>;
  employeeIds: Record<string, [string, string]>;
  employeeRestNumbers?: Record<string, number>;
  teamLeaders?: Partial<Record<Team, string[]>>;
  leaderRotation?: Partial<Record<Team, string[]>>;
  sourceLastDate?: string;
  minimum?: number;
  [key: string]: unknown;
}
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user?: { email?: string; user_metadata?: { full_name?: string } };
}
export interface WorkspaceRecord {
  state: Workspace;
  revision: number;
  updated_at?: string;
}
export type UpdateWorkspace = (mutate: (draft: Workspace) => void) => void;
export type SyncState = "loading" | "saved" | "saving" | "error" | "conflict";
