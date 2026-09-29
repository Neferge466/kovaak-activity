import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deriveDaily, localDate, scenarioFocus } from './lib/tracking.mjs';
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
  const daily = state ? deriveDaily(state.intervals) : [];
  const dataset = {
    schemaVersion: 1, source: 'online', profile: state?.profile ?? { ...player, displayName: player.username ?? player.steamId },
    today, trackingSince: state?.trackingSince ?? null, updatedAt: state?.latest.capturedAt ?? null,
    totalPlays: state?.latest.totalPlays ?? null, daily,
    focus: state ? scenarioFocus(state.intervals, cutoff.toISOString().slice(0, 10)) : [],
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
