import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Run calendar checks against the actual TS utility module without a test framework.
const source = await readFile(new URL('../src/utils/activity.ts', import.meta.url), 'utf8');
const url = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { level, summarize, weeklyData, calendarDates } = await import(url);
const mockSource = await readFile(new URL('../src/data/mock.ts', import.meta.url), 'utf8');
const mockJs = stripTypeScriptTypes(mockSource).replace("'../utils/activity'", JSON.stringify(url));
const { mockActivity } = await import(`data:text/javascript;base64,${Buffer.from(mockJs).toString('base64')}`);

assert.equal(level(0, 'trainingMinutes'), 0);
for (const [value, expected] of [[1, 1], [15, 1], [16, 2], [30, 2], [31, 3], [60, 3], [61, 4], [90, 4], [91, 5]]) assert.equal(level(value, 'trainingMinutes'), expected);
for (const [value, expected] of [[10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [100, 4], [101, 5]]) assert.equal(level(value, 'runs'), expected);
assert.deepEqual(summarize([]), { active: 0, streak: 0, minutes: 0, runs: 0 });
const example = [{ date: '2026-01-04', runs: 1, trainingMinutes: 30 }, { date: '2026-01-05', runs: 2, trainingMinutes: 60 }, { date: '2026-01-06', runs: 0, trainingMinutes: 0 }];
assert.deepEqual(weeklyData(example, 'trainingMinutes'), [{ date: '2025-12-29', value: .5 }, { date: '2026-01-05', value: 1 }]);
assert.equal(summarize(example).streak, 0);
assert.equal(mockActivity(2024).length, 366);
assert.equal(mockActivity(2025).length, 365);
assert.equal(mockActivity(2026).at(-1).date, '2026-09-29');
assert.equal(summarize(mockActivity(2026)).streak, 12);
for (const year of [2024, 2025, 2026, 2028]) {
  const cells = calendarDates(year);
  const inYear = cells.filter(cell => cell.inYear).map(cell => cell.date);
  assert.equal(cells.length % 7, 0);
  assert.equal(new Date(`${cells[0].date}T00:00:00Z`).getUTCDay(), 1);
  assert.equal(inYear.length, year % 4 === 0 ? 366 : 365);
  assert.equal(new Set(inYear).size, inYear.length);
  assert.equal(inYear[0], `${year}-01-01`);
  assert.equal(inYear.at(-1), `${year}-12-31`);
}
console.log('Calendar checks passed: leap years, full-year alignment, intensity boundaries, weekly aggregation, missing data, and demo streak.');
