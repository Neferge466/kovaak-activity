export function localDate(instant, timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
}
export function normalizeProfile(raw, player) {
  if (String(raw.steamId) !== player.steamId) throw new Error('Profile Steam ID does not match configured player');
  const totalPlays = Number(raw.scenariosPlayed);
  if (raw.scenariosPlayed == null || !Number.isSafeInteger(totalPlays) || totalPlays < 0) throw new Error('Missing or invalid profile scenario plays counter');
  return { id: player.id, steamId: player.steamId, username: raw.webapp?.username ?? player.username, displayName: raw.webapp?.username ?? raw.steamAccountName ?? player.steamId, timezone: player.timezone, totalPlays };
}
export function normalizeScenarios(rows) {
  const ids = new Set();
  return rows.map(row => {
    const id = String(row.leaderboardId);
    const plays = row.counts?.plays;
    if (!/^\d+$/.test(id) || ids.has(id) || !Number.isSafeInteger(plays) || plays < 0 || typeof row.scenarioName !== 'string') throw new Error('Invalid or duplicate scenario counter');
    ids.add(id);
    return { id, scenarioName: row.scenarioName, plays, ...(typeof row.score === 'number' && Number.isFinite(row.score) ? { score: row.score } : {}) };
  });
}
export function normalizeEvents(rows, steamId) {
  if (!Array.isArray(rows)) throw new Error('Invalid recent activity response');
  return rows.filter(row => row.type === 'HIGH_SCORE' && String(row.steamId) === steamId && Number.isFinite(Date.parse(row.timestamp)) && typeof row.scenarioName === 'string' && typeof row.score === 'number' && Number.isFinite(row.score)).map(row => ({ timestamp: row.timestamp, scenarioName: row.scenarioName, scenarioId: String(row.leaderboardId), score: row.score }));
}
export function makeInterval(previous, current, timezone) {
  if (!previous) return null;
  if (Date.parse(current.capturedAt) <= Date.parse(previous.capturedAt)) throw new Error('Snapshot time must advance');
  if (previous.steamId !== current.steamId || previous.timezone !== timezone) throw new Error('Tracking identity or timezone changed; use a new player id');
  const delta = current.totalPlays - previous.totalPlays;
  const startDate = localDate(previous.capturedAt, timezone);
  const endDate = localDate(current.capturedAt, timezone);
  const status = delta < 0 ? 'counter-reset' : startDate !== endDate ? 'cross-day' : 'assigned';
  const old = new Map(previous.scenarios.map(s => [s.id, s]));
  const scenarioDeltas = current.scenarios.map(s => ({ id: s.id, scenarioName: s.scenarioName, runs: s.plays - (old.get(s.id)?.plays ?? 0) }));
  const trustworthy = scenarioDeltas.every(s => s.runs >= 0) && scenarioDeltas.reduce((sum, s) => sum + s.runs, 0) === delta;
  return { start: previous.capturedAt, end: current.capturedAt, startDate, endDate, status, runs: Math.max(0, delta), ...(status === 'assigned' ? { date: endDate } : {}), scenarios: trustworthy && status === 'assigned' ? scenarioDeltas.filter(s => s.runs > 0) : [] };
}
export function deriveDaily(intervals) {
  const days = new Map();
  for (const interval of intervals) {
    if (interval.status !== 'assigned') continue;
    const day = days.get(interval.date) ?? { date: interval.date, runs: 0, coverage: 'partial' };
    day.runs += interval.runs;
    days.set(interval.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function scenarioFocus(intervals, cutoff) {
  const rows = new Map();
  for (const interval of intervals.filter(i => i.endDate >= cutoff && i.startDate >= cutoff && i.status === 'assigned')) {
    for (const scenario of interval.scenarios) {
      const row = rows.get(scenario.id) ?? { id: scenario.id, scenarioName: scenario.scenarioName, runs: 0 };
      row.runs += scenario.runs;
      rows.set(row.id, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.runs - a.runs).slice(0, 4);
}
