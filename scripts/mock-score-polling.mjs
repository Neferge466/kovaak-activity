import { pollScoreHistory, combineLocalAndOnline } from './lib/score-polling.mjs';
import { pathToFileURL } from 'node:url';

export async function simulatePolling() {
  const baseline = Date.parse('2026-09-29T00:00:00Z');
  const scenario = { id: 'mock', scenarioName: 'MOCK · 55-second challenge' };
  const completions = Array.from({ length: 30 }, (_, index) => {
    const startedAt = new Date(baseline + index * 55000).toISOString();
    const timestamp = new Date(baseline + (index + 1) * 55000).toISOString();
    const challengeStart = new Date(Date.parse(startedAt) + 8 * 3600000).toISOString().slice(11, 23);
    return { scenarioId: scenario.id, scenarioName: scenario.scenarioName, timestamp, startedAt, score: 100, api: { score: 100, attributes: { epoch: String(Date.parse(timestamp) + 1500), challengeStart } } };
  });
  let previous = null; const cycles = [];
  for (const elapsed of [600, 1200, 1800, 1800]) {
    const incoming = completions.filter(row => Date.parse(row.timestamp) + 1500 <= baseline + elapsed * 1000).slice(-10).reverse().map(row => row.api);
    const result = await pollScoreHistory({ scenarios: [scenario], previous, timezone: 'Asia/Shanghai', capturedAt: new Date(baseline + elapsed * 1000).toISOString(), fetchScores: async () => incoming });
    cycles.push({ seconds: elapsed, returned: incoming.length, newUnique: result.records.length - (previous?.records.length ?? 0), retained: result.records.length });
    previous = { ...result, fetchedAt: new Date(baseline + elapsed * 1000).toISOString() };
  }
  const local = { source: 'local-stats', fetchedAt: new Date(baseline + 1800 * 1000).toISOString(), records: completions.map(({ api, ...row }) => row) };
  const combined = combineLocalAndOnline(local, previous);
  return { cycles, generated: completions.length, onlineRetained: previous.records.length, possibleGaps: previous.possibleGaps.length, combinedRetained: combined.records.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await simulatePolling(), null, 2));
