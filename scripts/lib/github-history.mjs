import { mergeScoreRecords } from './score-polling.mjs';
import { isDeepStrictEqual } from 'node:util';

export function publicLocalHistory(history) {
  if (history.source !== 'local-stats' || !/^\d{17}$/.test(history.steamId) || history.recordedTimezone !== 'Asia/Shanghai' || !Number.isFinite(Date.parse(history.fetchedAt))) throw new Error('Invalid local history metadata');
  const records = mergeScoreRecords([], history.records.map(row => ({
    scenarioId: row.scenarioId, scenarioName: row.scenarioName, timestamp: row.timestamp, score: row.score,
    ...(row.startedAt ? { startedAt: row.startedAt } : {}),
  })));
  return { schemaVersion: 1, steamId: history.steamId, source: 'local-stats', coverage: 'partial', fetchedAt: history.fetchedAt, recordedTimezone: history.recordedTimezone, records };
}

export function mergeUploadedHistory(remote, incoming) {
  incoming = publicLocalHistory(incoming);
  if (!remote) return incoming;
  if (remote.steamId !== incoming.steamId || remote.recordedTimezone !== incoming.recordedTimezone || remote.source !== 'local-stats') throw new Error('Remote history identity or timezone differs');
  remote = publicLocalHistory(remote);
  return { ...incoming, records: mergeScoreRecords(remote.records, incoming.records) };
}

export async function uploadLocalHistory({ repository, branch, playerId, history, token, fetchImpl = fetch }) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) || !/^[a-z0-9][a-z0-9_-]*$/.test(playerId) || !branch) throw new Error('Invalid GitHub destination');
  const path = `data/players/${playerId}/local-history.json`;
  const endpoint = `https://api.github.com/repos/${repository}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await fetchImpl(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers, signal: AbortSignal.timeout(30000) });
    let sha; let remote;
    if (existing.ok) {
      const metadata = await existing.json(); sha = metadata.sha;
      let content = metadata.content;
      if (metadata.encoding !== 'base64') {
        const blob = await fetchImpl(`https://api.github.com/repos/${repository}/git/blobs/${sha}`, { headers, signal: AbortSignal.timeout(30000) });
        if (!blob.ok) throw new Error(`GitHub history read failed: HTTP ${blob.status}`);
        content = (await blob.json()).content;
      }
      remote = JSON.parse(Buffer.from(content, 'base64').toString('utf8'));
    } else if (existing.status !== 404) throw new Error(`GitHub history read failed: HTTP ${existing.status}`);
    const merged = mergeUploadedHistory(remote, history);
    if (remote && isDeepStrictEqual(remote.records, merged.records) && isDeepStrictEqual(remote, publicLocalHistory(remote))) return { changed: false, history: publicLocalHistory(remote) };
    const result = await fetchImpl(endpoint, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ message: `Import local KovaaK Stats for ${playerId}`, branch, ...(sha ? { sha } : {}), content: Buffer.from(`${JSON.stringify(merged, null, 2)}\n`).toString('base64') }),
    });
    if (result.ok) return { changed: true, history: merged };
    if (result.status !== 409) throw new Error(`GitHub history upload failed: HTTP ${result.status}`);
  }
  throw new Error('GitHub history changed concurrently; retry on the next sync');
}
