import { createHash } from 'node:crypto';

function csvRow(line) {
  const values = []; let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(value); value = ''; }
    else value += char;
  }
  values.push(value); return values;
}

export function parseLocalStats(filename, content, scenarioIds = new Map()) {
  const match = filename.match(/^(.*) - Challenge - (\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2}) Stats\.csv$/);
  if (!match) throw new Error('Unsupported Stats filename');
  const fields = new Map(content.replace(/^\uFEFF/, '').split(/\r?\n/).map(csvRow).filter(row => row[0]?.endsWith(':')).map(row => [row[0].slice(0, -1), row[1]]));
  const scenarioName = fields.get('Scenario'); const score = Number(fields.get('Score'));
  if (!scenarioName || !fields.get('Score')?.trim() || !Number.isFinite(score)) throw new Error('Missing scenario or score');
  const timestamp = new Date(`${match[2]}-${match[3]}-${match[4]}T${match[5]}:${match[6]}:${match[7]}+08:00`).toISOString();
  const start = fields.get('Challenge Start');
  let startedAt;
  if (/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(start ?? '')) {
    let instant = new Date(`${match[2]}-${match[3]}-${match[4]}T${start}+08:00`);
    if (instant.getTime() > Date.parse(timestamp) + 1000) instant = new Date(instant.getTime() - 86400000);
    startedAt = instant.toISOString();
  }
  const scenarioId = scenarioIds.get(scenarioName) ?? `local-${createHash('sha256').update(scenarioName).digest('hex').slice(0, 16)}`;
  return { scenarioId, scenarioName, timestamp, score, ...(startedAt ? { startedAt } : {}) };
}
