import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveScoreHistory, mergeDailyLowerBounds } from '../lib/score-history.mjs';

test('historical records deduplicate and use player timezone without filling unknown days', () => {
  const record = { scenarioId: 'a', scenarioName: 'Aim', timestamp: '2026-09-27T16:30:00Z', score: 100 };
  const result = deriveScoreHistory({ records: [record, { ...record }, { ...record, timestamp: '2026-09-28T02:00:00Z', score: 90 }, { ...record, timestamp: '2026-09-30T00:00:00Z' }] }, 'Asia/Shanghai', '2026-09-29');
  assert.equal(result.recordCount, 2);
  assert.deepEqual(result.daily, [{ date: '2026-09-28', runs: 2, coverage: 'partial', scenarioCount: 1 }]);
  assert.deepEqual(result.progress[0].scores.map(row => row.score), [100, 90]);
});

test('overlapping historical scores and sampled counters never add together', () => {
  const result = mergeDailyLowerBounds([{ date: '2026-09-28', runs: 7, coverage: 'partial' }], [{ date: '2026-09-28', runs: 4, scenarioCount: 2, coverage: 'partial' }, { date: '2026-01-01', runs: 1, coverage: 'partial' }]);
  assert.deepEqual(result.map(row => [row.date, row.runs]), [['2026-01-01', 1], ['2026-09-28', 7]]);
});

test('recent scores exclude old history and do not invent a second score', () => {
  const result = deriveScoreHistory({ records: [{ scenarioId: 'a', scenarioName: 'Aim', timestamp: '2026-01-01T00:00:00Z', score: 10 }, { scenarioId: 'a', scenarioName: 'Aim', timestamp: '2026-09-28T00:00:00Z', score: 20 }] }, 'Asia/Shanghai', '2026-09-29');
  assert.equal(result.progress.length, 0);
  assert.equal(result.focus[0].runs, 1);
  assert.equal(result.daily.length, 2);
});
