import { postForm, putForm, getJSON, del } from './http_client';
import { validateBoard, validateCard, validateList, validateListClosed } from './contracts';

export const TEST_PREFIX = 'TEST_';

export function trelloAuth() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (process.env.MOCK_API === '1') {
    return { key: 'mock', token: 'mock' };
  }
  if (!key || !token) {
    throw new Error('Defina TRELLO_KEY e TRELLO_TOKEN no .env');
  }
  return { key, token };
}

export function uniqueName(base: string) {
  const ts = new Date()
    .toISOString()
    .replace(/[:.TZ-]/g, '')
    .slice(0, 14);
  return `${TEST_PREFIX}${base}_${ts}`;
}

export async function createBoard(name: string, extra?: Record<string, any>) {
  const b = await postForm('/boards', { name, ...(extra || {}), ...trelloAuth() });
  validateBoard(b);
  return b;
}

export async function getBoard(idBoard: string) {
  const b = await getJSON(`/boards/${idBoard}`, { ...trelloAuth() });
  validateBoard(b);
  return b;
}

export async function deleteBoard(idBoard: string) {
  await del(`/boards/${idBoard}`, { ...trelloAuth() });
}

export async function createList(name: string, idBoard: string) {
  const l = await postForm('/lists', { name, idBoard, ...trelloAuth() });
  validateList(l);
  return l;
}

export async function archiveList(idList: string, closed = true) {
  const l = await putForm(`/lists/${idList}/closed`, { value: String(closed), ...trelloAuth() });
  validateListClosed(l);
  return l;
}

export async function createCard(name: string, idList: string) {
  const c = await postForm('/cards', { name, idList, ...trelloAuth() });
  validateCard(c);
  return c;
}

export async function moveCard(idCard: string, idList: string) {
  const c = await putForm(`/cards/${idCard}`, { idList, ...trelloAuth() });
  validateCard(c);
  return c;
}

export async function addComment(idCard: string, text: string) {
  const r = await postForm(`/cards/${idCard}/actions/comments`, { text, ...trelloAuth() });
  if (!r) throw new Error('Contrato inválido: comentário sem resposta');
  return r;
}
