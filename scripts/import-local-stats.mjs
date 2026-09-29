import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseLocalStats } from './lib/local-stats.mjs';
import { mergeScoreRecords } from './lib/score-polling.mjs';
const [folder, playerId = 'main'] = process.argv.slice(2);
if (!folder || !/^[a-z0-9][a-z0-9_-]*$/.test(playerId)) throw new Error('Usage: node scripts/import-local-stats.mjs <Stats folder> [player id]');
const config = JSON.parse(await readFile('config/players.json', 'utf8'));
const player = config.players.find(row => row.id === playerId);
if (!player) throw new Error('Unknown configured player');
if (player.timezone !== 'Asia/Shanghai') throw new Error('This importer currently supports Stats recorded in Asia/Shanghai (UTC+8) only');
const destination = `data/players/${playerId}/local-history.json`;
let previous;
try { previous = JSON.parse(await readFile(destination, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (previous && (previous.steamId !== player.steamId || previous.recordedTimezone !== player.timezone)) throw new Error('Stored local history identity or timezone differs');
let online; try { online = JSON.parse(await readFile(`data/players/${playerId}/score-history.json`, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const ids = new Map((online?.records ?? []).map(row => [row.scenarioName, row.scenarioId]));
const names = (await readdir(resolve(folder))).filter(name => name.endsWith(' Stats.csv')).sort();
const records = new Map(); const errors = [];
for (const name of names) {
  try {
    const row = parseLocalStats(name, await readFile(join(resolve(folder), name), 'utf8'), ids);
    records.set(`${row.scenarioName}:${row.timestamp}:${row.score}`, row);
  } catch (error) { errors.push({ filename: name, error: error.message }); }
}
if (errors.length) { console.error(JSON.stringify({ errors }, null, 2)); throw new Error('Import aborted; existing history was not changed'); }
const rows = mergeScoreRecords(previous?.records ?? [], [...records.values()]);
if (!rows.length) throw new Error('No valid Stats records found');
const history = { schemaVersion: 1, steamId: player.steamId, source: 'local-stats', coverage: 'partial', fetchedAt: new Date().toISOString(), recordedTimezone: 'Asia/Shanghai', inputFiles: names.length, duplicates: names.length - rows.length, records: rows };
if (!previous || JSON.stringify(previous.records) !== JSON.stringify(rows)) await writeFile(destination, `${JSON.stringify(history, null, 2)}\n`);
console.log(JSON.stringify({ imported: rows.length, files: names.length, duplicates: history.duplicates, first: rows[0].timestamp, last: rows.at(-1).timestamp, scenarios: new Set(rows.map(row => row.scenarioId)).size }, null, 2));
