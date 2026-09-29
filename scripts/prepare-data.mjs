import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deriveDaily, localDate, scenarioFocus } from './lib/tracking.mjs';
import { deriveScoreHistory, mergeDailyLowerBounds } from './lib/score-history.mjs';
import { combineLocalAndOnline } from './lib/score-polling.mjs';
const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('config/players.json', root), 'utf8'));
const manifest = [];
for (const player of config.players) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(player.id)) throw new Error('Unsafe player id');
  let state;
  try { state = JSON.parse(await readFile(new URL(`data/players/${player.id}/state.json`, root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (state && (state.profile.steamId !== player.steamId || state.profile.timezone !== player.timezone)) throw new Error('Config identity differs from stored history; use a new player id');
  const now = new Date();
  const today = localDate(now, player.timezone);
  const cutoff = new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  let history;
  try { history = JSON.parse(await readFile(new URL(`data/players/${player.id}/score-history.json`, root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (history && history.steamId !== player.steamId) throw new Error('Score history belongs to another player');
  let localHistory;
  try { localHistory = JSON.parse(await readFile(new URL(`data/players/${player.id}/local-history.json`, root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (localHistory && localHistory.steamId !== player.steamId) throw new Error('Local history belongs to another player');
  const onlineHistory = history;
  history = combineLocalAndOnline(localHistory, onlineHistory);
  const historical = deriveScoreHistory(history, player.timezone, today);
  const daily = mergeDailyLowerBounds(state ? deriveDaily(state.intervals) : [], historical.daily);
  const focus = new Map((state ? scenarioFocus(state.intervals, cutoff.toISOString().slice(0, 10)) : []).map(row => [row.id, row]));
  for (const row of historical.focus) focus.set(row.id, { ...row, runs: Math.max(row.runs, focus.get(row.id)?.runs ?? 0) });
  const dataset = {
    schemaVersion: 1, source: 'online', profile: state?.profile ?? { ...player, displayName: player.username ?? player.steamId },
    today, trackingSince: state?.trackingSince ?? null, updatedAt: state?.latest.capturedAt ?? null,
    totalPlays: state?.latest.totalPlays ?? null, daily,
    focus: [...focus.values()].sort((a, b) => b.runs - a.runs).slice(0, 4),
    scoreProgress: historical.progress,
    history: history ? { source: history.source, onlineAdded: history.onlineAdded ?? 0, fetchedAt: history.fetchedAt, recordCount: historical.recordCount, scenarioCount: historical.scenarioCount, firstDate: historical.firstDate, lastDate: historical.lastDate } : null,
    scoreTracking: { fetchedAt: onlineHistory?.fetchedAt ?? null, possibleGaps: onlineHistory?.possibleGaps?.length ?? 0, failedScenarios: onlineHistory?.errors?.length ?? 0 },
    pattern: historical.pattern,
    pbEvents: state?.pbEvents.slice(0, 4) ?? [],
    sampledPlays: state?.intervals.filter(i => i.status !== 'counter-reset').reduce((sum, i) => sum + i.runs, 0) ?? 0,
    unassignedPlays: state?.intervals.filter(i => i.status === 'cross-day').reduce((sum, i) => sum + i.runs, 0) ?? 0,
    counterResets: state?.intervals.filter(i => i.status === 'counter-reset').length ?? 0,
  };
  await mkdir(new URL('public/data/players/', root), { recursive: true });
  await writeFile(new URL(`public/data/players/${player.id}.json`, root), `${JSON.stringify(dataset, null, 2)}\n`);
  manifest.push({ id: player.id, displayName: dataset.profile.displayName });
}
await writeFile(new URL('public/data/manifest.json', root), `${JSON.stringify({ players: manifest }, null, 2)}\n`);
console.log(`Prepared static data for ${manifest.length} player(s)`);
