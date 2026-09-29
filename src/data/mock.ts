import type { DailyActivity, PlayerProfile, ScenarioActivity } from '../types/activity';
import { dateKey } from '../utils/activity';
export const profile: PlayerProfile = { id: 'main', displayName: 'Aimer7', timezone: 'Asia/Hong_Kong' };
// Fixed demo clock keeps the example reproducible and avoids invented future activity.
export const demoToday = '2026-09-29';
export function mockActivity(year: number): DailyActivity[] {
  const end = year === 2026 ? new Date(`${demoToday}T00:00:00Z`) : new Date(Date.UTC(year, 11, 31));
  const result: DailyActivity[] = [];
  for (let date = new Date(Date.UTC(year, 0, 1)), index = 0; date <= end; date.setUTCDate(date.getUTCDate() + 1), index++) {
    const seed = ((index * 9301 + year * 49297) % 233280) / 233280;
    const active = !(year === 2026 && dateKey(date) === '2026-09-17') && (seed > .22 || (year === 2026 && dateKey(date) >= '2026-09-18'));
    const minutes = active ? Math.round(22 + seed * 70 + Math.sin(index / 29) * 18 + index / 12) : 0;
    result.push({ date: dateKey(date), runs: Math.round(minutes * (.85 + seed * .3)), trainingMinutes: minutes, newPBs: active && seed > .85 ? 1 + index % 3 : 0, scenarioCount: active ? 2 + index % 4 : 0 });
  }
  return result;
}
export const scenarios: ScenarioActivity[] = [
  { id: 'smoothbot', scenarioName: 'VT Smoothbot', runs: 428, trainingMinutes: 408, scores: [3422, 3460, 3438, 3512, 3550, 3542, 3610, 3584, 3662, 3730, 3695, 3812] },
  { id: 'pasu', scenarioName: 'Pasu Track Invincible', runs: 312, trainingMinutes: 306, scores: [2210, 2222, 2212, 2250, 2241, 2284, 2270, 2334, 2308, 2360, 2330, 2405] },
  { id: 'angleshot', scenarioName: 'VT Angleshot', runs: 241, trainingMinutes: 222, scores: [1870, 1878, 1872, 1880, 1876, 1882, 1880, 1884, 1881, 1888, 1884, 1892] },
  { id: 'air', scenarioName: 'Air Voltaic Easy', runs: 183, trainingMinutes: 144, scores: [1146, 1153, 1151, 1170, 1162, 1181, 1176, 1190, 1184, 1200, 1198, 1221] },
];
