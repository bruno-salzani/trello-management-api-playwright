const fs = require('fs');
const path = require('path');

function main() {
  const file = path.resolve('test-results', 'flaky.jsonl');
  if (!fs.existsSync(file)) {
    console.log('No flaky.jsonl found; nothing to analyze.');
    return;
  }
  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter(Boolean);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const counts = new Map();
  const perProject = new Map();
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const t = new Date(e.ts).getTime();
      if (isFinite(t) && t >= weekAgo) {
        const key = `${e.title} :: ${e.project || ''}`.trim();
        counts.set(key, (counts.get(key) || 0) + 1);
        const projectTag =
          /\[PERF\]/i.test(e.title) ? 'perf' :
          /\[NEGATIVE\]/i.test(e.title) ? 'negative' :
          /\[FUNCTIONAL\]/i.test(e.title) ? 'functional' :
          (e.project || 'unknown');
        perProject.set(projectTag, (perProject.get(projectTag) || 0) + 1);
      }
    } catch {}
  }
  let flagged = false;
  for (const [key, c] of counts.entries()) {
    if (c > 3) {
      console.warn(`[ALERTA FLAKY] "${key}" marcado como flaky ${c}x nos últimos 7 dias`);
      flagged = true;
    }
  }
  const gates = {
    functional: parseInt(process.env.FLAKY_GATE_FUNCTIONAL || '9999', 10),
    negative: parseInt(process.env.FLAKY_GATE_NEGATIVE || '9999', 10),
    perf: parseInt(process.env.FLAKY_GATE_PERF || '9999', 10),
  };
  let gateFailed = false;
  for (const [proj, cnt] of perProject.entries()) {
    const limit = gates[proj] ?? 9999;
    if (cnt > limit) {
      console.error(`[FLAKY GATE] Projeto ${proj} excedeu limite: ${cnt} > ${limit}`);
      gateFailed = true;
    }
  }
  if (!flagged) {
    console.log('Nenhum teste ultrapassou 3 flakies na última semana.');
  } else if (process.env.FAIL_ON_FLAKY === '1') {
    process.exit(1);
  }
  if (gateFailed) {
    process.exit(1);
  }
}

main();
