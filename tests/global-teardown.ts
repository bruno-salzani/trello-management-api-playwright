import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

export default async function globalTeardown() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    aggregateMetrics();
    return;
  }

  const base = 'https://api.trello.com/1';

  const q = new URLSearchParams({ fields: 'name', key, token });
  const res = await fetch(`${base}/members/me/boards?${q.toString()}`);
  if (!res.ok) return;
  const boards = await res.json();
  const testBoards = boards.filter(
    (b: any) => typeof b.name === 'string' && b.name.startsWith('TEST_')
  );
  for (const b of testBoards) {
    const delQ = new URLSearchParams({ key, token });
    await fetch(`${base}/boards/${b.id}?${delQ.toString()}`, { method: 'DELETE' });
  }
  aggregateMetrics();
}

function aggregateMetrics() {
  try {
    const dir = path.resolve('test-results');
    const file = path.join(dir, 'metrics.jsonl');
    if (!fs.existsSync(file)) return;
    const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter(Boolean);
    const buckets: Record<string, number[]> = {};
    for (const line of lines) {
      const e = JSON.parse(line);
      const key = `${e.method} ${e.path}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(e.ms);
    }
    const summary: Record<string, any> = {};
    for (const [k, arr] of Object.entries(buckets)) {
      const sorted = arr.slice().sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95) - 1] ?? sorted[sorted.length - 1];
      const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
      summary[k] = {
        count: arr.length,
        minMs: sorted[0],
        maxMs: sorted[sorted.length - 1],
        avgMs: avg,
        p95Ms: p95,
      };
    }
    const out = path.join(dir, 'metrics-summary.json');
    fs.writeFileSync(
      out,
      JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2)
    );
  } catch {}
}
