import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalStats } from '../lib/local-stats.mjs';
import { deriveScoreHistory } from '../lib/score-history.mjs';

test('local Stats uses UTC+8, quoted CSV fields and preserved zero score', () => {
  const row = parseLocalStats('Aim, Easy - Challenge - 2026.09.28-21.00.00 Stats.csv', 'Scenario:,"Aim, Easy"\r\nScore:,0.0\r\nChallenge Start:,20:59:00.200\r\nFight Time:,12.5', new Map([['Aim, Easy', '42']]));
  assert.equal(row.scenarioId, '42');
  assert.equal(row.timestamp, '2026-09-28T13:00:00.000Z');
  assert.equal(row.startedAt, '2026-09-28T12:59:00.200Z');
  assert.equal(row.score, 0);
  assert.equal(row.trainingMinutes, undefined);
});

test('a run spanning midnight starts on the previous Shanghai date', () => {
  const row = parseLocalStats('Aim - Challenge - 2026.09.28-00.00.20 Stats.csv', 'Scenario:,Aim\nScore:,100\nChallenge Start:,23:59:20.500');
  assert.equal(row.startedAt, '2026-09-27T15:59:20.500Z');
  assert.equal(row.timestamp, '2026-09-27T16:00:20.000Z');
  const result = deriveScoreHistory({ records: [row] }, 'Asia/Shanghai', '2026-09-29');
  assert.equal(result.daily[0].date, '2026-09-28');
  assert.equal(result.pattern.peakStart, 21);
});

test('missing scores and unsupported filenames fail instead of importing false zeros', () => {
  assert.throws(() => parseLocalStats('Aim - Challenge - 2026.09.28-21.00.00 Stats.csv', 'Scenario:,Aim'), /Missing/);
  assert.throws(() => parseLocalStats('unrecognized.csv', 'Scenario:,Aim\nScore:,5'), /Unsupported/);
});
