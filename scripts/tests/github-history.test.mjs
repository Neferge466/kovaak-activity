import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadLocalHistory, mergeUploadedHistory, publicLocalHistory } from '../lib/github-history.mjs';
const record = timestamp => ({ scenarioId: 'a', scenarioName: 'Aim', score: 100, timestamp });
const history = records => ({ schemaVersion: 1, steamId: '76561199196193444', source: 'local-stats', coverage: 'partial', fetchedAt: '2026-09-29T00:00:00Z', recordedTimezone: 'Asia/Shanghai', records });
const metadata = (data, sha = 'old-sha') => ({ sha, encoding: 'base64', content: Buffer.from(JSON.stringify(data)).toString('base64') });
test('GitHub mock upload adds only unique records and preserves remote-only history', async () => {
  const remote = history([record('2026-09-28T00:00:00Z')]);
  const incoming = history([record('2026-09-28T00:01:00Z')]);
  let put;
  const result = await uploadLocalHistory({ repository: 'test/repo', branch: 'main', playerId: 'main', history: incoming, token: 'mock', fetchImpl: async (url, options) => {
    assert.ok(url.startsWith('https://api.github.com/repos/test/repo/'));
    if (options.method === 'PUT') { put = JSON.parse(options.body); return { ok: true }; }
    return { ok: true, json: async () => metadata(remote) };
  } });
  assert.equal(result.history.records.length, 2); assert.equal(put.sha, 'old-sha');
  assert.equal(JSON.parse(Buffer.from(put.content, 'base64').toString()).records.length, 2);
});
test('GitHub mock upload performs no write if history is unchanged', async () => {
  const data = history([record('2026-09-28T00:00:00Z')]);
  const result = await uploadLocalHistory({ repository: 'test/repo', branch: 'main', playerId: 'main', history: data, token: 'mock', fetchImpl: async (_, options) => {
    assert.notEqual(options.method, 'PUT'); return { ok: true, json: async () => metadata(data) };
  } });
  assert.equal(result.changed, false);
});
test('GitHub mock conflicts reread and merge concurrent records before retrying', async () => {
  let puts = 0; let gets = 0;
  const result = await uploadLocalHistory({ repository: 'test/repo', branch: 'main', playerId: 'main', history: history([record('2026-09-28T00:02:00Z')]), token: 'mock', fetchImpl: async (_, options) => {
    if (options.method === 'PUT') return ++puts === 1 ? { ok: false, status: 409 } : { ok: true };
    gets++; return { ok: true, json: async () => metadata(history(gets === 1 ? [] : [record('2026-09-28T00:01:00Z')]), `sha-${gets}`) };
  } });
  assert.equal(puts, 2); assert.equal(result.history.records.length, 2);
});
test('wrong player history is never combined or overwritten', () => {
  assert.throws(() => mergeUploadedHistory({ ...history([]), steamId: 'other' }, history([])), /identity/);
});
test('upload whitelist strips paths, credentials and extra CSV/device fields', () => {
  const payload = publicLocalHistory({ ...history([{ ...record('2026-09-28T00:00:00Z'), computerName: 'PRIVATE-PC', rawCsv: 'PRIVATE', apiToken: 'SECRET' }]), statsFolder: 'C:/Users/Private/stats', password: 'SECRET', accountEmail: 'PRIVATE', recordsExtra: [] });
  assert.deepEqual(Object.keys(payload), ['schemaVersion', 'steamId', 'source', 'coverage', 'fetchedAt', 'recordedTimezone', 'records']);
  assert.deepEqual(Object.keys(payload.records[0]), ['scenarioId', 'scenarioName', 'timestamp', 'score']);
  assert.ok(!JSON.stringify(payload).includes('PRIVATE')); assert.ok(!JSON.stringify(payload).includes('SECRET'));
});
