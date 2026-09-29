import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { normalizeProfile, normalizeScenarios, normalizeEvents, makeInterval, deriveDaily } from './lib/tracking.mjs';
import { pollScoreHistory } from './lib/score-polling.mjs';
const root = new URL('../', import.meta.url);
export async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(new URL(path, root), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function writeJson(path, value) {
  const url = new URL(path, root);
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(new URL(`${path}.tmp`, root), `${JSON.stringify(value, null, 2)}\n`);
  await rename(new URL(`${path}.tmp`, root), url);
}
async function api(path, params) {
  const url = new URL(`https://kovaaks.com/webapp-backend/${path}`);
  url.search = new URLSearchParams(params).toString();
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const error = new Error(`${path}: HTTP ${response.status}`);
        if (response.status < 500 && response.status !== 429) { error.permanent = true; }
        throw error;
      }
      return await response.json();
    } catch (error) { lastError = error; if (error.permanent) break; if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); }
  }
  throw lastError;
}
export function validateConfig(config) {
  if (!Array.isArray(config.players) || !config.players.length) throw new Error('Configure at least one player');
  const ids = new Set();
  for (const player of config.players) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(player.id) || ids.has(player.id) || !/^\d{17}$/.test(player.steamId) || !player.username?.trim()) throw new Error('Each player needs a unique safe id, 17-digit Steam ID, and KovaaK username');
    new Intl.DateTimeFormat('en', { timeZone: player.timezone });
    ids.add(player.id);
  }
  if (config.tracking?.concurrency !== undefined && (!Number.isInteger(config.tracking.concurrency) || config.tracking.concurrency < 1 || config.tracking.concurrency > 8)) throw new Error('Tracking concurrency must be 1–8');
  if (config.tracking?.scoreHistory !== undefined && typeof config.tracking.scoreHistory !== 'boolean') throw new Error('scoreHistory must be boolean');
  for (const player of config.players) if (player.scoreScenarios !== undefined && (!Array.isArray(player.scoreScenarios) || player.scoreScenarios.some(name => typeof name !== 'string' || !name.trim()))) throw new Error('scoreScenarios must be an array of scenario names');
}
const config = await readJson('config/players.json');
validateConfig(config);
let failed = false;
for (const player of config.players) {
  try {
    const profile = normalizeProfile(await api('user/profile/by-username', { username: player.username }), player);
    const dir = `data/players/${player.id}`;
    const old = await readJson(`${dir}/state.json`, null);
    const previous = await readJson(`${dir}/score-history.json`, null);
    const local = await readJson(`${dir}/local-history.json`, null);
    for (const stored of [old?.profile, previous, local].filter(Boolean)) if (stored.steamId !== player.steamId) throw new Error('Stored history identity mismatch');
    if ((old && old.profile.timezone !== player.timezone) || (local && local.recordedTimezone !== player.timezone) || (previous?.timezone && previous.timezone !== player.timezone)) throw new Error('Stored history timezone mismatch; use a new player id');
    const candidates = new Map();
    for (const row of [...(local?.records ?? []), ...(previous?.records ?? [])]) candidates.set(row.scenarioName, { id: row.scenarioId, scenarioName: row.scenarioName });
    for (const row of old?.latest.scenarios ?? []) candidates.set(row.scenarioName, { id: row.id, scenarioName: row.scenarioName });
    let events;
    try { events = normalizeEvents(await api('user/activity/recent', { username: profile.username }), player.steamId); }
    catch (error) { console.error(`${player.id}: recent PB fetch failed: ${error.message}`); events = []; }
    for (const row of [...(old?.pbEvents ?? []), ...events]) candidates.set(row.scenarioName, { id: row.scenarioId, scenarioName: row.scenarioName });
    let counterSaved = false;
    try {
    const rows = []; let total;
    for (let page = 0; page < 100; page++) {
      const result = await api('user/scenario/total-play', { username: profile.username, page: String(page), max: '100', sort_param: 'count' });
      if (!Array.isArray(result.data) || !Number.isSafeInteger(result.total) || result.total < 0) throw new Error('Invalid paginated scenario response');
      if (total !== undefined && total !== result.total) throw new Error('Scenario list changed during pagination; retry later');
      total = result.total;
      rows.push(...result.data);
      if (rows.length === total) break;
      if (!result.data.length || rows.length > total || page === 99) throw new Error('Incomplete scenario pagination');
    }
    const scenarios = normalizeScenarios(rows);
    for (const row of scenarios) candidates.set(row.scenarioName, { id: row.id, scenarioName: row.scenarioName });
    if (scenarios.reduce((sum, s) => sum + s.plays, 0) !== profile.totalPlays) throw new Error('Profile and per-scenario counters disagree; retry later');
    const latest = { capturedAt: new Date().toISOString(), steamId: player.steamId, timezone: player.timezone, totalPlays: profile.totalPlays, scenarios };
    const interval = makeInterval(old?.latest, latest, player.timezone);
    const intervals = [...(old?.intervals ?? []), ...(interval ? [interval] : [])];
    const pbEvents = [...new Map([...(old?.pbEvents ?? []), ...events].map(e => [`${e.timestamp}:${e.scenarioId}:${e.score}`, e])).values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const state = { schemaVersion: 1, profile, trackingSince: old?.trackingSince ?? latest.capturedAt, latest, intervals, pbEvents };
    await writeJson(`${dir}/state.json`, state);
    await writeJson(`${dir}/profile.json`, profile);
    await writeJson(`${dir}/latest.json`, latest);
    const daily = deriveDaily(intervals);
    for (const year of new Set(daily.map(day => day.date.slice(0, 4)))) await writeJson(`${dir}/activity-${year}.json`, daily.filter(day => day.date.startsWith(year)));
    console.log(`${player.id}: ${profile.displayName}, ${profile.totalPlays} online plays; ${interval ? `${interval.status}, +${interval.runs}` : 'baseline recorded'}`);
    counterSaved = true;
    } catch (error) { console.error(`${player.id}: counters unchanged: ${error.message}. Score polling continues independently.`); }
    if (config.tracking?.scoreHistory !== false) {
      const scenarios = [...candidates.values()].filter(row => !player.scoreScenarios || player.scoreScenarios.includes(row.scenarioName));
      if (player.scoreScenarios?.some(name => !candidates.has(name))) throw new Error('Configured scoreScenarios contains an undiscovered scenario');
      if (!scenarios.length) throw new Error('No scenarios discovered for score polling');
      const capturedAt = new Date().toISOString();
      const result = await pollScoreHistory({ scenarios, previous, timezone: player.timezone, concurrency: config.tracking?.concurrency ?? 3, capturedAt,
        fetchScores: scenario => api('user/scenario/last-scores/by-name', { username: profile.username, scenarioName: scenario.scenarioName }),
      });
      if (result.errors.length === scenarios.length) throw new Error('All score requests failed; previous score history retained');
      await writeJson(`${dir}/score-history.json`, { schemaVersion: 1, steamId: player.steamId, timezone: player.timezone, source: 'kovaak-last-scores-by-name', coverage: 'partial', fetchedAt: capturedAt, ...result });
      console.log(`${player.id}: ${result.records.length - (previous?.records.length ?? 0)} new unique scores, ${result.records.length} retained; ${result.errors.length} failed scenarios, ${result.possibleGaps.length} possible window gaps`);
    } else if (!counterSaved) throw new Error('Counter update failed and score polling is disabled');
  } catch (error) { failed = true; console.error(`${player.id}: ${error.message}. Previous data preserved.`); }
}
if (failed) process.exitCode = 1;
