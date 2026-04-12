export type Position = 'GKP' | 'DEF' | 'MID' | 'FWD';

export type FplPlayer = {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number; // 1=GKP, 2=DEF, 3=MID, 4=FWD
  now_cost: number; // in 0.1M units (e.g. 145 = £14.5M)
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  minutes: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  form: string;
  selected_by_percent: string;
  status: string; // 'a' = available, 'i' = injured, 'd' = doubtful, 'u' = unavailable
  news: string;
};

export type FplTeam = {
  id: number;
  name: string;
  short_name: string;
};

export type FplData = {
  elements: FplPlayer[];
  teams: FplTeam[];
};

export type SquadSlot = {
  player: FplPlayer | null;
  isStarter: boolean;
};

export const POSITION_MAP: Record<number, Position> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

export const POSITION_LABELS: Record<Position, string> = {
  GKP: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

export const POSITION_COLORS: Record<Position, string> = {
  GKP: 'bg-amber-100 text-amber-800 ring-amber-300',
  DEF: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  MID: 'bg-blue-100 text-blue-800 ring-blue-300',
  FWD: 'bg-red-100 text-red-800 ring-red-300',
};

// Squad limits
export const BUDGET = 1000; // £100.0M in 0.1M units
export const MAX_PER_TEAM = 3;
export const SQUAD_STRUCTURE: Record<Position, { total: number; minStart: number; maxStart: number }> = {
  GKP: { total: 2, minStart: 1, maxStart: 1 },
  DEF: { total: 5, minStart: 3, maxStart: 5 },
  MID: { total: 5, minStart: 2, maxStart: 5 },
  FWD: { total: 3, minStart: 1, maxStart: 3 },
};
