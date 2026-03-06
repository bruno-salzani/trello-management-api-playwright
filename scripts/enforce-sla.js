const fs = require('fs');

function envMs(name, def) {
  const v = process.env[name];
  return v ? parseInt(v, 10) : def;
}

// Thresholds p95 defaults; can be overridden by env
const thresholds = {
  'POST /1/boards': envMs('SLA_P95_CREATE_BOARD', envMs('SLA_MS', 2000)),
  'GET /1/boards': envMs('SLA_P95_GET_BOARD', envMs('SLA_MS', 2000)),
  'DELETE /1/boards': envMs('SLA_P95_DELETE_BOARD', envMs('SLA_MS', 2000)),
  'POST /1/lists': envMs('SLA_P95_CREATE_LIST', envMs('SLA_MS', 2000)),
  'PUT /1/lists': envMs('SLA_P95_ARCHIVE_LIST', envMs('SLA_MS', 2000)),
  'POST /1/cards': envMs('SLA_P95_CREATE_CARD', envMs('SLA_MS', 2000)),
  'PUT /1/cards': envMs('SLA_P95_MOVE_CARD', envMs('SLA_MS', 2000)),
  'POST /1/cards/actions/comments': envMs('SLA_P95_COMMENT_CARD', envMs('SLA_MS', 2000)),
};

function main() {
  const file = 'test-results/metrics-summary.json';
  if (!fs.existsSync(file)) {
    console.log('No metrics-summary.json found; skipping gates.');
    return;
  }
  const summary = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let failed = false;
  for (const [k, v] of Object.entries(summary.summary || {})) {
    let norm = k;
    if (/^GET\s+\/1\/boards\//.test(k)) norm = 'GET /1/boards';
    if (/^DELETE\s+\/1\/boards\//.test(k)) norm = 'DELETE /1/boards';
    const gate = thresholds[k] ?? thresholds[norm];
    if (gate !== undefined && v.p95Ms > gate) {
      console.error(`Gate failed: ${k} p95=${v.p95Ms}ms > ${gate}ms`);
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }
}

main();
