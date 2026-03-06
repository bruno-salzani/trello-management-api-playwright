import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import {
  TrelloAuthError,
  TrelloBadRequestError,
  TrelloError,
  TrelloNotFoundError,
  TrelloRateLimitError,
  TrelloServerError,
} from './errors';

const HOST = 'api.trello.com';
const RUN_ID =
  process.env.RUN_ID ||
  `run_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
const MOCK = process.env.MOCK_API === '1';
const CHAOS = process.env.ENABLE_CHAOS === '1';
const CHAOS_RATE = Math.max(
  0,
  Math.min(1, parseFloat(process.env.CHAOS_RATE || '0.05') || 0.05)
);
const CHAOS_RATE_GET = clampRate(process.env.CHAOS_RATE_GET);
const CHAOS_RATE_POST = clampRate(process.env.CHAOS_RATE_POST);
const CHAOS_RATE_PUT = clampRate(process.env.CHAOS_RATE_PUT);
const CHAOS_RATE_DELETE = clampRate(process.env.CHAOS_RATE_DELETE);
const CHAOS_INCLUDE = (process.env.CHAOS_INCLUDE || '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => new RegExp(s));
const CHAOS_EXCLUDE = (process.env.CHAOS_EXCLUDE || '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => new RegExp(s));
const CHAOS_STATUSES = (process.env.CHAOS_STATUSES || '429,500')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => n === 429 || (n >= 500 && n < 600));

const CHAOS_PRESET = (process.env.CHAOS_PRESET || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
if (CHAOS_PRESET.length > 0 && (process.env.CHAOS_INCLUDE || '') === '') {
  for (const p of CHAOS_PRESET) {
    if (p === 'boards') CHAOS_INCLUDE.push(/\/1\/boards/);
    if (p === 'lists') CHAOS_INCLUDE.push(/\/1\/lists/);
    if (p === 'cards') CHAOS_INCLUDE.push(/\/1\/cards/);
    if (p === 'critical') {
      // Boards create/delete
      CHAOS_INCLUDE.push(/POST\s+\/1\/boards$/);
      CHAOS_INCLUDE.push(/DELETE\s+\/1\/boards\/.*/);
      // Lists create/archive
      CHAOS_INCLUDE.push(/POST\s+\/1\/lists$/);
      CHAOS_INCLUDE.push(/PUT\s+\/1\/lists\/.*\/closed$/);
      // Cards create/move/comment
      CHAOS_INCLUDE.push(/POST\s+\/1\/cards$/);
      CHAOS_INCLUDE.push(/PUT\s+\/1\/cards\/.*/);
      CHAOS_INCLUDE.push(/POST\s+\/1\/cards\/.*\/actions\/comments$/);
    }
  }
}
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

function metricsLog(entry: Record<string, any>) {
  try {
    const dir = path.resolve('test-results');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'metrics.jsonl');
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  } catch {}
}

function request(
  pathname: string,
  method: Method,
  body?: string,
  extraHeaders?: Record<string, string>
) {
  const headers: Record<string, string | number> = {
    Accept: 'application/json',
    'User-Agent': 'trello-management-api-playwright (by Bruno Salzani)',
    'x-request-id': `${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`,
  };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  if (body !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  const options: https.RequestOptions = {
    host: HOST,
    port: 443,
    path: pathname,
    method,
    headers,
    agent: new https.Agent({ keepAlive: false }),
  };
  return new Promise<{ status: number; text: string; headers: any }>((resolve, reject) => {
    const t0 = Date.now();
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const ms = Date.now() - t0;
        const reqId = (options.headers as any)?.['x-request-id'];
        metricsLog({
          ts: new Date().toISOString(),
          runId: RUN_ID,
          reqId,
          method,
          path: pathname,
          status,
          ms,
        });
        if (process.env.DEBUG_HTTP) {
          console.log(`[HTTP] ${method} ${pathname} -> ${status} in ${ms}ms id=${reqId}`);
        }
        resolve({ status, text: data, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestWithRetry(
  path: string,
  method: Method,
  body: string | undefined,
  options: { retryOn429: boolean; headers?: Record<string, string> }
) {
  if (CHAOS && Math.random() < chaosRateFor(method, path)) {
    const chaosStatus = pickChaosStatus();
    const headers: any = {};
    if (chaosStatus === 429) headers['retry-after'] = '0.1';
    const ms = 0;
    metricsLog({
      ts: new Date().toISOString(),
      runId: RUN_ID,
      reqId: `${RUN_ID}-chaos`,
      method,
      path,
      status: chaosStatus,
      ms,
      chaos: true,
    });
    if (process.env.DEBUG_HTTP) {
      console.warn(`[HTTP][CHAOS] ${method} ${path} -> ${chaosStatus}`);
    }
    return { status: chaosStatus, text: 'Injected chaos error', headers };
  }
  let attempt = 0;
  const maxAttempts = 4;
  while (true) {
    const res = await request(path, method, body, options.headers);
    if (res.status >= 400) {
      try {
        const curl = buildCurl(path, method, body || '');
        console.error(`[CURL] ${curl}`);
      } catch {}
    }
    if (res.status !== 429 || !options.retryOn429 || attempt >= maxAttempts - 1) {
      return res;
    }
    const ra = res.headers['retry-after'];
    let wait = ra ? parseFloat(Array.isArray(ra) ? ra[0] : ra) * 1000 : 500 * Math.pow(2, attempt);
    wait += Math.floor(Math.random() * 100);
    await new Promise((r) => setTimeout(r, wait));
    attempt++;
  }
}

function mapError(status: number, text: string): TrelloError {
  const msg = text.slice(0, 300) || `HTTP ${status}`;
  if (status === 400) return new TrelloBadRequestError(msg);
  if (status === 401 || status === 403) return new TrelloAuthError(msg, status);
  if (status === 404) return new TrelloNotFoundError(msg);
  if (status === 429) return new TrelloRateLimitError(msg);
  if (status >= 500) return new TrelloServerError(msg, status);
  return new TrelloError(msg, status);
}

const mem = {
  boards: new Map<string, any>(),
  lists: new Map<string, any>(),
  cards: new Map<string, any>(),
};

function id() {
  return Math.random().toString(36).slice(2, 10);
}

function ok(pathname: string, method: Method, body: any) {
  const t0 = Date.now();
  const ms = Date.now() - t0;
  metricsLog({
    ts: new Date().toISOString(),
    runId: RUN_ID,
    reqId: `${RUN_ID}-${id()}`,
    method,
    path: pathname,
    status: 200,
    ms,
  });
  return body;
}

function err(pathname: string, method: Method, status: number, text: string) {
  const t0 = Date.now();
  const ms = Date.now() - t0;
  metricsLog({
    ts: new Date().toISOString(),
    runId: RUN_ID,
    reqId: `${RUN_ID}-${id()}`,
    method,
    path: pathname,
    status,
    ms,
  });
  throw mapError(status, text);
}

export async function postForm(pathname: string, form: Record<string, any>) {
  if (!MOCK) {
    const body = new URLSearchParams(form).toString();
    const res = await requestWithRetry(`/1${pathname}`, 'POST', body, { retryOn429: false });
    if (res.status < 200 || res.status >= 300) throw mapError(res.status, res.text);
    return JSON.parse(res.text);
  }
  const p = `/1${pathname}`;
  if (CHAOS && Math.random() < chaosRateFor('POST', p)) {
    const s = pickChaosStatus();
    return err(p, 'POST', s, 'Injected chaos error');
  }
  if (p === '/1/boards') {
    if (!form?.name) return err(p, 'POST', 400, 'name required');
    const b = {
      id: id(),
      name: form.name,
      closed: false,
      dateLastActivity: new Date().toISOString(),
    };
    mem.boards.set(b.id, b);
    return ok(p, 'POST', b);
  }
  if (p === '/1/lists') {
    if (!form?.idBoard || !mem.boards.has(form.idBoard))
      return err(p, 'POST', 400, 'idBoard invalid');
    const l = { id: id(), idBoard: form.idBoard, name: form.name || '', closed: false };
    mem.lists.set(l.id, l);
    return ok(p, 'POST', l);
  }
  if (p.startsWith('/1/cards/') && p.endsWith('/actions/comments')) {
    const idCard = p.split('/')[3];
    if (!mem.cards.has(idCard)) return err(p, 'POST', 404, 'card not found');
    const text = form?.text || '';
    return ok(p, 'POST', { type: 'commentCard', data: { text } });
  }
  if (p === '/1/cards') {
    if (!form?.idList || !mem.lists.has(form.idList)) return err(p, 'POST', 400, 'idList invalid');
    const c = { id: id(), idList: form.idList, name: form.name || '' };
    mem.cards.set(c.id, c);
    return ok(p, 'POST', c);
  }
  return ok(p, 'POST', {});
}

export async function putForm(pathname: string, form: Record<string, any>) {
  if (!MOCK) {
    const body = new URLSearchParams(form).toString();
    const res = await requestWithRetry(`/1${pathname}`, 'PUT', body, { retryOn429: false });
    if (res.status < 200 || res.status >= 300) throw mapError(res.status, res.text);
    return JSON.parse(res.text);
  }
  const p = `/1${pathname}`;
  if (CHAOS && Math.random() < chaosRateFor('PUT', p)) {
    const s = pickChaosStatus();
    return err(p, 'PUT', s, 'Injected chaos error');
  }
  if (p.includes('/1/lists/') && p.endsWith('/closed')) {
    const idList = p.split('/')[3];
    const l = mem.lists.get(idList);
    if (!l) return err(p, 'PUT', 404, 'list not found');
    const v = String(form?.value) === 'true';
    l.closed = v;
    return ok(p, 'PUT', l);
  }
  if (p.startsWith('/1/cards/')) {
    const idCard = p.split('/')[3];
    const c = mem.cards.get(idCard);
    if (!c) return err(p, 'PUT', 404, 'card not found');
    if (form?.idList && !mem.lists.has(form.idList)) return err(p, 'PUT', 400, 'idList invalid');
    if (form?.idList) c.idList = form.idList;
    return ok(p, 'PUT', c);
  }
  return ok(p, 'PUT', {});
}

export async function getJSON(pathname: string, params?: Record<string, any>) {
  if (!MOCK) {
    const q = new URLSearchParams(params || {}).toString();
    const full = q ? `/1${pathname}?${q}` : `/1${pathname}`;
    const res = await requestWithRetry(full, 'GET', undefined, { retryOn429: true });
    if (res.status < 200 || res.status >= 300) throw mapError(res.status, res.text);
    return JSON.parse(res.text);
  }
  const p = `/1${pathname}`;
  if (CHAOS && Math.random() < chaosRateFor('GET', p)) {
    const s = pickChaosStatus();
    return err(p, 'GET', s, 'Injected chaos error');
  }
  if (p.startsWith('/1/boards/')) {
    const idBoard = p.split('/')[3];
    const b = mem.boards.get(idBoard);
    if (!b) return err(p, 'GET', 404, 'board not found');
    return ok(p, 'GET', b);
  }
  if (p === '/1/members/me/boards') {
    const arr = Array.from(mem.boards.values());
    return ok(p, 'GET', arr);
  }
  return ok(p, 'GET', {});
}

export async function del(pathname: string, params?: Record<string, any>) {
  if (!MOCK) {
    const q = new URLSearchParams(params || {}).toString();
    const full = q ? `/1${pathname}?${q}` : `/1${pathname}`;
    const res = await requestWithRetry(full, 'DELETE', undefined, { retryOn429: true });
    if (res.status < 200 || res.status >= 300) throw mapError(res.status, res.text);
    return true;
  }
  const p = `/1${pathname}`;
  if (CHAOS && Math.random() < chaosRateFor('DELETE', p)) {
    const s = pickChaosStatus();
    return err(p, 'DELETE', s, 'Injected chaos error');
  }
  if (p.startsWith('/1/boards/')) {
    const idBoard = p.split('/')[3];
    if (!mem.boards.has(idBoard)) return err(p, 'DELETE', 404, 'board not found');
    mem.boards.delete(idBoard);
    for (const [lid, l] of Array.from(mem.lists.entries())) {
      if (l.idBoard === idBoard) {
        mem.lists.delete(lid);
        for (const [cid, c] of Array.from(mem.cards.entries())) {
          if (c.idList === lid) mem.cards.delete(cid);
        }
      }
    }
    return ok(p, 'DELETE', { ok: true });
  }
  return ok(p, 'DELETE', { ok: true });
}

function buildCurl(pathname: string, method: Method, body: string) {
  const url = `https://${HOST}${pathname}`;
  let cmd = `curl -X ${method} "${url}" -H "Accept: application/json" -H "User-Agent: trello-management-api-playwright (by Bruno Salzani)"`;
  if (body) {
    const masked = maskSecrets(body);
    cmd += ` -H "Content-Type: application/x-www-form-urlencoded" --data "${masked}"`;
  }
  return cmd;
}

function maskSecrets(s: string) {
  try {
    return s
      .replace(/(key=)[^&]*/gi, '$1***')
      .replace(/(token=)[^&]*/gi, '$1***');
  } catch {
    return s;
  }
}

function clampRate(v?: string) {
  if (!v) return undefined;
  const n = parseFloat(v);
  if (!isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n));
}

function chaosRateFor(method: Method, pathname: string) {
  const target = `${method} ${pathname}`;
  if (CHAOS_INCLUDE.length > 0 && !CHAOS_INCLUDE.some((r) => r.test(target) || r.test(pathname))) {
    return 0;
  }
  if (CHAOS_EXCLUDE.some((r) => r.test(target) || r.test(pathname))) {
    return 0;
  }
  const perMethod =
    (method === 'GET' && CHAOS_RATE_GET !== undefined && CHAOS_RATE_GET) ||
    (method === 'POST' && CHAOS_RATE_POST !== undefined && CHAOS_RATE_POST) ||
    (method === 'PUT' && CHAOS_RATE_PUT !== undefined && CHAOS_RATE_PUT) ||
    (method === 'DELETE' && CHAOS_RATE_DELETE !== undefined && CHAOS_RATE_DELETE) ||
    undefined;
  return perMethod !== undefined ? perMethod : CHAOS_RATE;
}

function pickChaosStatus() {
  if (CHAOS_STATUSES.length > 0) {
    return CHAOS_STATUSES[Math.floor(Math.random() * CHAOS_STATUSES.length)];
  }
  return Math.random() < 0.5 ? 429 : 500;
}
