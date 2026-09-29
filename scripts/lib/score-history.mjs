import { localDate } from './tracking.mjs';

export function deriveScoreHistory(history, timezone, today) {
  const unique = new Map();
  for (const record of history?.records ?? []) {
    if (!record.scenarioId || !record.scenarioName || !Number.isFinite(record.score) || !Number.isFinite(Date.parse(record.timestamp))) throw new Error('Invalid score history record');
    const date = localDate(new Date(record.timestamp), timezone);
    if (date > today) continue;
    unique.set(`${record.scenarioId}:${Date.parse(record.timestamp)}:${record.score}`, { ...record, date });
  }
  const records = [...unique.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const days = new Map();
  for (const record of records) {
    if (!days.has(record.date)) days.set(record.date, { date: record.date, runs: 0, coverage: 'partial', scenarios: new Set() });
    const day = days.get(record.date); day.runs++; day.scenarios.add(record.scenarioId);
  }
  const cutoff = new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const groups = new Map();
  for (const record of records.filter(row => row.date >= cutoff.toISOString().slice(0, 10))) {
    if (!groups.has(record.scenarioId)) groups.set(record.scenarioId, { id: record.scenarioId, scenarioName: record.scenarioName, scores: [] });
    groups.get(record.scenarioId).scores.push({ timestamp: record.timestamp, score: record.score });
  }
  const recent = [...groups.values()].sort((a, b) => b.scores.length - a.scores.length || a.scenarioName.localeCompare(b.scenarioName));
  const recentRecords = records.filter(row => row.date >= cutoff.toISOString().slice(0, 10));
  const hourly = Array(24).fill(0);
  const weekday = Array(7).fill(0);
  const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' });
  for (const row of recentRecords) {
    const date = new Date(`${row.date}T00:00:00Z`);
    weekday[(date.getUTCDay() + 6) % 7]++;
    if (row.startedAt) hourly[Number(hourFormatter.format(new Date(row.startedAt)))]++;
  }
  const peakStart = hourly.some(Boolean) ? hourly.reduce((best, _, hour) => {
    const volume = h => hourly[h] + hourly[(h + 1) % 24] + hourly[(h + 2) % 24];
    return volume(hour) > volume(best) ? hour : best;
  }, 0) : null;
  return {
    daily: [...days.values()].map(({ scenarios, ...day }) => ({ ...day, scenarioCount: scenarios.size })),
    focus: recent.map(row => ({ id: row.id, scenarioName: row.scenarioName, runs: row.scores.length })),
    progress: recent.filter(row => row.scores.length >= 2).slice(0, 4),
    recordCount: records.length,
    scenarioCount: new Set(records.map(row => row.scenarioId)).size,
    firstDate: records[0]?.date ?? null,
    lastDate: records.at(-1)?.date ?? null,
    pattern: recentRecords.length ? { activeDays: new Set(recentRecords.map(row => row.date)).size, runs: recentRecords.length, weekdayRuns: weekday, peakStart, peakEnd: peakStart === null ? null : (peakStart + 3) % 24 } : null,
  };
}
export function mergeDailyLowerBounds(sampled, historical) {
  const days = new Map(sampled.map(day => [day.date, { ...day }]));
  for (const day of historical) days.set(day.date, { ...days.get(day.date), ...day, runs: Math.max(days.get(day.date)?.runs ?? 0, day.runs), coverage: 'partial' });
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
