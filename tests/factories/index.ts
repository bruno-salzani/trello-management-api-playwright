export function runId() {
  return process.env.RUN_ID || `run_${Date.now().toString(36)}`;
}

export function boardName(prefix = 'Board') {
  const rid = runId();
  return `TEST_${prefix}_${rid}_${Math.random().toString(36).slice(2, 6)}`;
}

export function cardName(prefix = 'Card') {
  const rid = runId();
  return `TEST_${prefix}_${rid}_${Math.random().toString(36).slice(2, 6)}`;
}
