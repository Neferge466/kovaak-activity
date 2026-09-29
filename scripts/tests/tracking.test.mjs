import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, normalizeProfile, normalizeScenarios, normalizeEvents, makeInterval, deriveDaily, scenarioFocus } from '../lib/tracking.mjs';
const timezone = 'Asia/Shanghai';
const steamId = '76561199196193444';
const player = { id: 'main', steamId, username: 'NEFOR', timezone };
const snapshot = (capturedAt, plays = 100, scenarios = [{ id: '1', scenarioName: 'Tracking', plays }]) => ({ capturedAt, steamId, timezone, totalPlays: plays, scenarios });
test('first snapshot establishes a baseline, not historic daily training', () => {
  assert.equal(makeInterval(null, snapshot('2026-09-29T06:00:00Z'), timezone), null);
  assert.deepEqual(deriveDaily([]), []);
});
test('Shanghai date changes at 16:00 UTC', () => {
  assert.equal(localDate('2026-09-29T15:59:59Z', timezone), '2026-09-29');
  assert.equal(localDate('2026-09-29T16:00:00Z', timezone), '2026-09-30');
});
test('same-day differences are lower bounds with no fabricated duration', () => {
  const interval = makeInterval(snapshot('2026-09-29T06:00:00Z'), snapshot('2026-09-29T07:00:00Z', 109), timezone);
  assert.equal(interval.status, 'assigned');
  assert.deepEqual(deriveDaily([interval]), [{ date: '2026-09-29', runs: 9, coverage: 'partial' }]);
  assert.deepEqual(interval.scenarios, [{ id: '1', scenarioName: 'Tracking', runs: 9 }]);
});
test('cross-midnight changes are not attributed to either date', () => {
  const interval = makeInterval(snapshot('2026-09-29T15:17:00Z'), snapshot('2026-09-29T16:17:00Z', 109), timezone);
  assert.equal(interval.status, 'cross-day');
  assert.equal(interval.runs, 9);
  assert.deepEqual(deriveDaily([interval]), []);
  assert.deepEqual(interval.scenarios, []);
});
test('a long outage across dates does not create invented zero days', () => {
  const interval = makeInterval(snapshot('2026-09-29T06:00:00Z'), snapshot('2026-10-03T06:00:00Z', 100), timezone);
  assert.deepEqual(deriveDaily([interval]), []);
});
test('zero sampled growth retains partial coverage', () => {
  const interval = makeInterval(snapshot('2026-09-29T06:00:00Z'), snapshot('2026-09-29T07:00:00Z'), timezone);
  assert.equal(deriveDaily([interval])[0].coverage, 'partial');
});
test('counter rollback never subtracts daily activity', () => {
  const interval = makeInterval(snapshot('2026-09-29T06:00:00Z'), snapshot('2026-09-29T07:00:00Z', 80), timezone);
  assert.equal(interval.status, 'counter-reset');
  assert.deepEqual(deriveDaily([interval]), []);
});
test('identity, timezone, or backwards clock changes fail instead of mixing histories', () => {
  const old = snapshot('2026-09-29T06:00:00Z');
  assert.throws(() => makeInterval(old, { ...snapshot('2026-09-29T07:00:00Z'), steamId: 'other' }, timezone));
  assert.throws(() => makeInterval(old, snapshot('2026-09-29T07:00:00Z'), 'UTC'));
  assert.throws(() => makeInterval(old, snapshot('2026-09-29T05:00:00Z'), timezone));
});
test('missing scenario counters cannot turn into fake focus data', () => {
  const interval = makeInterval(snapshot('2026-09-29T06:00:00Z'), snapshot('2026-09-29T07:00:00Z', 109, [{ id: '1', scenarioName: 'Tracking', plays: 105 }]), timezone);
  assert.equal(interval.runs, 9);
  assert.deepEqual(interval.scenarios, []);
});
test('invalid, missing, or duplicate counters are rejected', () => {
  assert.throws(() => normalizeScenarios([{ leaderboardId: 1, scenarioName: 'A', counts: {} }]));
  assert.throws(() => normalizeScenarios([{ leaderboardId: 1, scenarioName: 'A', counts: { plays: -1 } }]));
  const row = { leaderboardId: 1, scenarioName: 'A', counts: { plays: 10 } };
  assert.throws(() => normalizeScenarios([row, row]));
});
test('profile projection verifies identity and excludes unrelated personal metadata', () => {
  const raw = { steamId, scenariosPlayed: '526', webapp: { username: 'NEFOR', socialMedia: { discord: 'private' } } };
  assert.equal(normalizeProfile(raw, player).totalPlays, 526);
  assert.equal(normalizeProfile(raw, player).webapp, undefined);
  assert.throws(() => normalizeProfile({ ...raw, steamId: 'other' }, player));
  assert.throws(() => normalizeProfile({ ...raw, scenariosPlayed: undefined }, player));
});
test('PB feed excludes other players and non-score events', () => {
  const event = { type: 'HIGH_SCORE', timestamp: '2026-09-28T13:38:24Z', scenarioName: 'A', leaderboardId: 1, score: 10, steamId };
  assert.equal(normalizeEvents([event, { ...event, steamId: 'other' }, { ...event, type: 'PROFILE_UPDATE' }], steamId).length, 1);
});
test('scenario focus uses recent differences, never lifetime plays or cross-day guesses', () => {
  const interval = makeInterval(snapshot('2026-09-29T06:00:00Z'), snapshot('2026-09-29T07:00:00Z', 109), timezone);
  assert.deepEqual(scenarioFocus([interval], '2026-09-01'), [{ id: '1', scenarioName: 'Tracking', runs: 9 }]);
  assert.deepEqual(scenarioFocus([interval], '2026-09-30'), []);
});
