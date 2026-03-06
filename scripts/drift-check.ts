import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { BoardSchema, CardSchema, ListSchema } from '../utils/contracts';

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  return res.json();
}

function keysOf(zodSchema: any): string[] {
  try {
    const shape = zodSchema._def.shape();
    return Object.keys(shape);
  } catch {
    return [];
  }
}

function pickSchemaComponents(openapi: any): Record<string, any> {
  const comp = openapi?.components?.schemas || {};
  const out: Record<string, any> = {};
  for (const [name, schema] of Object.entries<any>(comp)) {
    if (/board/i.test(name)) out.Board = schema;
    if (/list/i.test(name)) out.List = schema;
    if (/card/i.test(name)) out.Card = schema;
  }
  return out;
}

function propKeysFromSchema(schema: any): string[] {
  const props = schema?.properties || {};
  return Object.keys(props);
}

function resolveRef(openapi: any, obj: any): any {
  if (!obj) return obj;
  if (obj.$ref && typeof obj.$ref === 'string') {
    const ref = obj.$ref.replace(/^#\//, '').split('/');
    let cur: any = openapi;
    for (const p of ref) cur = cur?.[p];
    return cur || obj;
  }
  return obj;
}

function responsePropKeysFor(openapi: any, path: string, method: string): string[] {
  const m = openapi?.paths?.[path]?.[method.toLowerCase()];
  const resp = m?.responses?.['200'] || m?.responses?.['201'] || m?.responses?.default;
  const schema =
    resp?.content?.['application/json']?.schema ||
    resp?.content?.['application/json; charset=utf-8']?.schema;
  const resolved = resolveRef(openapi, schema);
  return propKeysFromSchema(resolveRef(openapi, resolved));
}

async function main() {
  const url =
    process.env.OPENAPI_URL ||
    'https://api.trello.com/1/openapi.json';
  let openapi: any | null = null;
  try {
    openapi = await fetchJson(url);
  } catch (e) {
    console.warn('[DRIFT] Não foi possível baixar OpenAPI:', (e as Error).message);
    return;
  }
  const comp = pickSchemaComponents(openapi);
  const zod = {
    Board: new Set(keysOf(BoardSchema)),
    List: new Set(keysOf(ListSchema)),
    Card: new Set(keysOf(CardSchema)),
  };
  const drift: Record<string, any> = {};
  for (const key of ['Board', 'List', 'Card'] as const) {
    const swaggerKeys = new Set(propKeysFromSchema((comp as any)[key]));
    const zodKeys = zod[key];
    const missingInZod = [...swaggerKeys].filter((k) => !zodKeys.has(k));
    const missingInSwagger = [...zodKeys].filter((k) => !swaggerKeys.has(k));
    drift[key] = { missingInZod, missingInSwagger };
  }
  const endpoints = [
    { method: 'POST', path: '/1/boards', zod: 'Board' },
    { method: 'GET', path: '/1/boards/{id}', zod: 'Board' },
    { method: 'DELETE', path: '/1/boards/{id}', zod: null },
    { method: 'POST', path: '/1/lists', zod: 'List' },
    { method: 'PUT', path: '/1/lists/{id}/closed', zod: 'List' },
    { method: 'POST', path: '/1/cards', zod: 'Card' },
    { method: 'PUT', path: '/1/cards/{id}', zod: 'Card' },
    { method: 'POST', path: '/1/cards/{id}/actions/comments', zod: null },
  ] as const;
  const endpointDiff: Record<string, any> = {};
  for (const e of endpoints) {
    const keys = new Set(responsePropKeysFor(openapi, e.path, e.method));
    let missingInZod: string[] = [];
    if (e.zod && keys.size > 0) {
      const zodKeys = zod[e.zod as 'Board' | 'List' | 'Card'];
      missingInZod = [...keys].filter((k) => !zodKeys.has(k));
    }
    endpointDiff[`${e.method} ${e.path}`] = {
      responseKeys: [...keys],
      missingInZod,
    };
  }
  const dir = path.resolve('test-results');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'drift-report.json');
  fs.writeFileSync(
    out,
    JSON.stringify({ generatedAt: new Date().toISOString(), drift, endpointDiff }, null, 2)
  );
  let hasSignal = false;
  for (const [k, v] of Object.entries<any>(drift)) {
    if ((v.missingInZod?.length || 0) > 0) {
      console.warn(`[DRIFT] ${k}: campos presentes no OpenAPI e ausentes no Zod: ${v.missingInZod.join(', ')}`);
      hasSignal = true;
    }
  }
  if (!hasSignal) {
    console.log('[DRIFT] Sem diferenças relevantes entre OpenAPI e Zod (chaves básicas).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
