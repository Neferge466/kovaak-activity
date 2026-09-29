import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { normalizeProfile, normalizeScenarios, normalizeEvents, makeInterval, deriveDaily } from './lib/tracking.mjs';
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
}
const config = await readJson('config/players.json');
validateConfig(config);
let failed = false;
for (const player of config.players) {
  try {
    const profile = normalizeProfile(await api('user/profile/by-username', { username: player.username }), player);
    const rows = [];
    let total;
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
    // Counts from different endpoints can be sampled at different instants. Never
    // silently turn a partial or inconsistent response into a smaller counter.
    if (scenarios.reduce((sum, s) => sum + s.plays, 0) !== profile.totalPlays) throw new Error('Profile and per-scenario counters disagree; retry later');
    const events = normalizeEvents(await api('user/activity/recent', { username: profile.username }), player.steamId);
    const dir = `data/players/${player.id}`;
    const old = await readJson(`${dir}/state.json`, null);
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
  } catch (error) { failed = true; console.error(`${player.id}: ${error.message}. Previous data preserved.`); }
}
if (failed) process.exitCode = 1;
