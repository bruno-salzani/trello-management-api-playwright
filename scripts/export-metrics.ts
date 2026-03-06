import fs from 'node:fs';
import path from 'node:path';

type SummaryEntry = {
  count: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p95Ms: number;
};

function toCsvRow(cols: (string | number)[]) {
  return cols
    .map((c) => (typeof c === 'string' && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : String(c)))
    .join(',');
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function pushInflux(lines: string[]) {
  const url = process.env.INFLUX_URL;
  const bucket = process.env.INFLUX_BUCKET;
  const org = process.env.INFLUX_ORG;
  const token = process.env.INFLUX_TOKEN;
  if (!url || !bucket || !org || !token) {
    console.log('[METRICS] INFLUX_* não configurado; pulando push');
    return;
  }
  const writeUrl = `${url.replace(/\/+$/, '')}/api/v2/write?org=${encodeURIComponent(
    org
  )}&bucket=${encodeURIComponent(bucket)}&precision=ms`;
  const body = lines.join('\n');
  const res = await fetch(writeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Authorization: `Token ${token}`,
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Influx push falhou ${res.status}: ${txt.slice(0, 300)}`);
  }
  console.log(`[METRICS] Influx push ok (${lines.length} linhas)`);
}

async function main() {
  const dir = path.resolve('test-results');
  const file = path.join(dir, 'metrics-summary.json');
  if (!fs.existsSync(file)) {
    console.log('[METRICS] Sem metrics-summary.json; nada a exportar.');
    return;
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    generatedAt?: string;
    summary?: Record<string, SummaryEntry>;
  };
  const ts = json.generatedAt ? new Date(json.generatedAt).getTime() : Date.now();
  const summary = json.summary || {};

  ensureDir(dir);
  const csvPath = path.join(dir, 'metrics-summary.csv');
  const rows: string[] = [];
  rows.push(
    toCsvRow(['method', 'path', 'count', 'minMs', 'maxMs', 'avgMs', 'p95Ms', 'generatedAt'])
  );
  const influxLines: string[] = [];
  for (const [k, v] of Object.entries(summary)) {
    const m = k.match(/^([A-Z]+)\s+(.*)$/);
    const method = m ? m[1] : '';
    const route = m ? m[2] : k;
    rows.push(
      toCsvRow([method, route, v.count, v.minMs, v.maxMs, v.avgMs, v.p95Ms, new Date(ts).toISOString()])
    );
    const tags = `method=${method},route=${route.replace(/\s+/g, '_').replace(/[=, ]/g, '_')}`;
    const fields = `count=${v.count}i,minMs=${v.minMs},maxMs=${v.maxMs},avgMs=${v.avgMs},p95Ms=${v.p95Ms}`;
    influxLines.push(`trello_api_perf,${tags} ${fields} ${ts}`);
  }
  fs.writeFileSync(csvPath, rows.join('\n'));
  console.log(`[METRICS] CSV gerado em ${path.relative(process.cwd(), csvPath)}`);

  if (process.env.INFLUX_URL) {
    await pushInflux(influxLines).catch((e) => {
      console.warn('[METRICS] Falha ao enviar para Influx:', (e as Error).message);
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

