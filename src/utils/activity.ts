import type { DailyActivity, Metric } from '../types/activity';
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const parseDate = (date: string) => new Date(`${date}T00:00:00Z`);
export const formatDate = (date: string, locale = 'en-US') => parseDate(date).toLocaleDateString(locale, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
export const thresholds: Record<Metric, number[]> = { trainingMinutes: [0, 15, 30, 60, 90], runs: [0, 10, 25, 50, 100] };
export function calendarDates(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(Date.UTC(year, 11, 31));
  const dates: { date: string; inYear: boolean }[] = [];
  for (const date = new Date(start); date <= end || dates.length % 7; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push({ date: dateKey(date), inYear: date.getUTCFullYear() === year });
  }
  return dates;
}
export function level(value: number, metric: Metric) { return thresholds[metric].filter(boundary => value > boundary).length; }
export function summarize(data: DailyActivity[]) {
  const active = data.filter(day => day.runs > 0).length;
  let streak = 0;
  for (let i = data.length - 1; i >= 0 && data[i].runs > 0; i--) streak++;
  return { active, streak, minutes: data.reduce((sum, d) => sum + (d.trainingMinutes ?? 0), 0), runs: data.reduce((sum, d) => sum + d.runs, 0) };
}
export function weeklyData(data: DailyActivity[], metric: Metric) {
  const weeks = new Map<string, number>();
  data.forEach(day => {
    const date = parseDate(day.date);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const key = dateKey(date);
    weeks.set(key, (weeks.get(key) ?? 0) + (day[metric] ?? 0));
  });
  return Array.from(weeks, ([date, value]) => ({ date, value: metric === 'trainingMinutes' ? value / 60 : value }));
}
