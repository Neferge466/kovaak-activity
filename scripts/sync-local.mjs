import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { uploadLocalHistory, publicLocalHistory } from './lib/github-history.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const configArg = args.indexOf('--config');
const config = JSON.parse(await readFile(resolve(root, configArg >= 0 ? args[configArg + 1] : 'config/local-sync.json'), 'utf8'));
if (!/^[a-z0-9][a-z0-9_-]*$/.test(config.playerId) || typeof config.statsFolder !== 'string' || !config.statsFolder) throw new Error('Configure playerId and statsFolder');
if (!Number.isInteger(config.intervalSeconds) || config.intervalSeconds < 60) throw new Error('intervalSeconds must be an integer of at least 60');
if (typeof config.github?.enabled !== 'boolean') throw new Error('Configure github.enabled as true or false');
const upload = args.includes('--upload') || config.github.enabled;
if (upload && (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(config.github.repository ?? '') || typeof config.github.branch !== 'string' || !config.github.branch)) throw new Error('Configure github.repository as owner/repo and github.branch before uploading');

function credential(repository) {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const result = spawnSync('git', ['-c', 'credential.interactive=false', 'credential', 'fill'], {
    input: `protocol=https\nhost=github.com\npath=${repository}.git\n\n`, encoding: 'utf8', cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, windowsHide: true,
  });
  if (result.status !== 0) throw new Error('GitHub authentication unavailable. Sign into Git Credential Manager, or set GITHUB_TOKEN locally. Do not put tokens in config.');
  const token = result.stdout.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
  if (!token) throw new Error('No GitHub credential available');
  return token;
}
function nodeScript(script, parameters = []) {
  const result = spawnSync(process.execPath, [resolve(root, script), ...parameters], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error(`${script} failed`);
}
async function sync() {
  nodeScript('scripts/import-local-stats.mjs', [config.statsFolder, config.playerId]);
  if (args.includes('--dry-run')) {
    const history = publicLocalHistory(JSON.parse(await readFile(resolve(root, `data/players/${config.playerId}/local-history.json`), 'utf8')));
    console.log(JSON.stringify({ mode: 'dry-run; no authentication or upload', destination: `${config.github.repository}/${config.github.branch}/data/players/${config.playerId}/local-history.json`, fields: Object.keys(history), runFields: Object.keys(history.records[0] ?? {}), records: history.records.length, bytes: Buffer.byteLength(JSON.stringify(history)), publicData: 'Steam ID, scenarios, scores, completion/start timestamps, timezone. No paths, raw CSVs or credentials.' }, null, 2));
    nodeScript('scripts/prepare-data.mjs');
    return;
  }
  if (upload) {
    const path = resolve(root, `data/players/${config.playerId}/local-history.json`);
    const history = JSON.parse(await readFile(path, 'utf8'));
    const result = await uploadLocalHistory({ ...config.github, playerId: config.playerId, history, token: credential(config.github.repository) });
    await writeFile(path, `${JSON.stringify(result.history, null, 2)}\n`);
    console.log(result.changed ? `Uploaded ${result.history.records.length} normalized records to ${config.github.repository}` : 'GitHub history already up to date');
  } else console.log('Local import only. GitHub upload is disabled.');
  nodeScript('scripts/prepare-data.mjs');
}
if (args.includes('--watch')) {
  console.log(`Local Stats sync every ${config.intervalSeconds} seconds; GitHub upload ${upload ? 'enabled' : 'disabled'}. Ctrl+C stops.`);
  for (;;) {
    const cycleStarted = Date.now();
    try { await sync(); } catch (error) { console.error(`Sync failed: ${error.message}. Existing files retained; next cycle will retry.`); }
    await new Promise(resolve => setTimeout(resolve, Math.max(1000, config.intervalSeconds * 1000 - (Date.now() - cycleStarted))));
  }
} else await sync();
