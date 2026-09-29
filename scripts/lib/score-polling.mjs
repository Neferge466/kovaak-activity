export function scoreKey(row) {
  return `${row.scenarioName}:${Date.parse(row.timestamp)}`;
}
export function mergeScoreRecords(previous, incoming) {
  const records = new Map();
  for (const row of [...previous, ...incoming]) {
    if (typeof row.scenarioName !== 'string' || !row.scenarioName || typeof row.scenarioId !== 'string' || !row.scenarioId || !Number.isFinite(row.score) || typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp)) || (row.startedAt && (typeof row.startedAt !== 'string' || !Number.isFinite(Date.parse(row.startedAt))))) throw new Error('Invalid score record');
    records.set(scoreKey(row), row);
  }
  const starts = new Map();
  for (const row of records.values()) starts.set(row.startedAt ? `${row.scenarioName}:start:${Date.parse(row.startedAt)}` : scoreKey(row), row);
  return [...starts.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.scenarioName.localeCompare(b.scenarioName) || a.score - b.score);
}
export function normalizeScoreResponse(rows, scenario, timezone) {
  if (!Array.isArray(rows)) throw new Error('Invalid score history response');
  return rows.map(row => {
    const epoch = Number(row.attributes?.epoch);
    if (!row.attributes?.epoch || !Number.isFinite(epoch) || !Number.isFinite(row.score)) throw new Error('Missing score timestamp');
    const timestamp = new Date(epoch).toISOString();
    const start = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(row.attributes?.challengeStart ?? '');
    let startedAt;
    if (start && Number(start[1]) < 24 && Number(start[2]) < 60 && Number(start[3]) < 60) {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(epoch));
      const time = Object.fromEntries(parts.map(part => [part.type, part.value]));
      const endClock = ((Number(time.hour) * 60 + Number(time.minute)) * 60 + Number(time.second)) * 1000 + epoch % 1000;
      const startClock = ((Number(start[1]) * 60 + Number(start[2])) * 60 + Number(start[3])) * 1000 + Number((start[4] ?? '').padEnd(3, '0'));
      startedAt = new Date(epoch - ((endClock - startClock + 86400000) % 86400000)).toISOString();
    }
    return { scenarioId: scenario.id, scenarioName: scenario.scenarioName, timestamp, score: row.score, ...(startedAt ? { startedAt } : {}) };
  });
}

export async function pollScoreHistory({ scenarios, previous, timezone, fetchScores, concurrency = 3, capturedAt }) {
  const results = []; const errors = []; const possibleGaps = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, scenarios.length) }, async () => {
    while (next < scenarios.length) {
      const scenario = scenarios[next++];
      try {
        const incoming = normalizeScoreResponse(await fetchScores(scenario), scenario, timezone);
        const old = (previous?.records ?? []).filter(row => row.scenarioName === scenario.scenarioName);
        const seen = new Set(old.map(scoreKey));
        if (old.length && incoming.length >= 10 && !incoming.some(row => seen.has(scoreKey(row)))) possibleGaps.push({ scenarioName: scenario.scenarioName, detectedAt: capturedAt });
        results.push(...incoming);
      } catch (error) { errors.push({ scenarioName: scenario.scenarioName, error: error.message }); }
    }
  }));
  return {
    records: mergeScoreRecords(previous?.records ?? [], results), errors,
    possibleGaps: [...(previous?.possibleGaps ?? []), ...possibleGaps],
  };
}
export function combineLocalAndOnline(local, online) {
  if (!local) return online;
  const localStarts = new Set(local.records.filter(row => row.startedAt).map(row => `${row.scenarioName}:${Date.parse(row.startedAt)}`));
  const extra = (online?.records ?? []).filter(row => {
    if (row.startedAt) return !localStarts.has(`${row.scenarioName}:${Date.parse(row.startedAt)}`);
    return Date.parse(row.timestamp) > Date.parse(local.fetchedAt);
  });
  return { ...local, records: mergeScoreRecords(local.records, extra), onlineAdded: extra.length };
}
