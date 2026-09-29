import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulatePolling } from '../mock-score-polling.mjs';
import { pollScoreHistory, mergeScoreRecords, combineLocalAndOnline, normalizeScoreResponse } from '../lib/score-polling.mjs';

test('10-minute mock polling retains scores, ignores repeat responses, detects truncated windows', async () => {
  const result = await simulatePolling();
  assert.deepEqual(result.cycles.map(row => row.newUnique), [10, 10, 9, 0]);
  assert.equal(result.onlineRetained, 29);
  assert.equal(result.generated, 30);
  assert.equal(result.possibleGaps, 1);
  assert.equal(result.combinedRetained, 30);
});
test('identical scores at different timestamps are distinct, ISO formatting differences are duplicates', () => {
  const row = { scenarioId: 'a', scenarioName: 'Aim', score: 0, timestamp: '2026-09-28T00:00:00Z' };
  assert.equal(mergeScoreRecords([row], [{ ...row, timestamp: '2026-09-28T00:00:00.000Z' }, { ...row, timestamp: '2026-09-28T00:01:00Z' }]).length, 2);
  assert.equal(mergeScoreRecords([row], [{ ...row, score: 0.001 }]).length, 1);
});
test('failed scenarios preserve existing history while other scenarios advance', async () => {
  const old = { scenarioId: 'a', scenarioName: 'A', timestamp: '2026-09-28T00:00:00Z', score: 1 };
  const result = await pollScoreHistory({ scenarios: [{ id: 'a', scenarioName: 'A' }, { id: 'b', scenarioName: 'B' }], previous: { records: [old] }, timezone: 'Asia/Shanghai', capturedAt: '2026-09-28T00:10:00Z', fetchScores: async row => { if (row.id === 'a') throw new Error('Temporary failure'); return [{ score: 5, attributes: { epoch: String(Date.parse('2026-09-28T00:05:00Z')) } }]; } });
  assert.equal(result.records.length, 2); assert.equal(result.errors.length, 1); assert.equal(result.records[0].scenarioName, 'A');
});
test('local completion and online upload deduplicate by precise challenge start', () => {
  const local = { fetchedAt: '2026-09-28T02:00:00Z', records: [{ scenarioId: 'local-a', scenarioName: 'Aim', score: 10.009, timestamp: '2026-09-28T00:01:00Z', startedAt: '2026-09-28T00:00:00.200Z' }] };
  const online = normalizeScoreResponse([{ score: 10, attributes: { epoch: String(Date.parse('2026-09-28T00:01:05.321Z')), challengeStart: '08:00:00.200' } }], { id: 'a', scenarioName: 'Aim' }, 'Asia/Shanghai');
  assert.equal(combineLocalAndOnline(local, { records: online }).records.length, 1);
  const newRun = { ...online[0], timestamp: '2026-09-28T02:01:00Z', startedAt: '2026-09-28T02:00:00.200Z' };
  assert.equal(combineLocalAndOnline(local, { records: [...online, newRun] }).records.length, 2);
});
