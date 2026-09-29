export type Metric = 'trainingMinutes' | 'runs';
export interface DailyActivity {
  date: string;
  runs: number;
  trainingMinutes?: number;
  newPBs?: number;
  scenarioCount?: number;
  coverage?: 'partial';
}
export interface PlayerProfile { id: string; displayName: string; timezone: string; }
export interface ScenarioActivity {
  id: string;
  scenarioName: string;
  runs: number;
  trainingMinutes: number;
  scores: number[];
}
export interface OnlineDataset {
  schemaVersion: 1;
  source: 'online';
  profile: PlayerProfile & { steamId: string; username: string };
  today: string;
  trackingSince: string | null;
  updatedAt: string | null;
  totalPlays: number | null;
  daily: DailyActivity[];
  focus: { id: string; scenarioName: string; runs: number }[];
  pbEvents: { timestamp: string; scenarioId: string; scenarioName: string; score: number }[];
  sampledPlays: number;
  unassignedPlays: number;
  counterResets: number;
  history: { source: string; onlineAdded: number; fetchedAt: string; recordCount: number; scenarioCount: number; firstDate: string | null; lastDate: string | null } | null;
  pattern: { activeDays: number; runs: number; weekdayRuns: number[]; peakStart: number | null; peakEnd: number | null } | null;
  scoreProgress: { id: string; scenarioName: string; scores: { timestamp: string; score: number }[] }[];
  scoreTracking: { fetchedAt: string | null; possibleGaps: number; failedScenarios: number };
}
