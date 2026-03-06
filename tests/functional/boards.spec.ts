import { test, expect } from '@playwright/test';
import { createBoard, deleteBoard, getBoard, uniqueName } from '../../utils/api_helper';

test.describe('Gerenciamento de Boards', () => {
  const SLA_CREATE = parseInt(process.env.SLA_MS_CREATE_BOARD || process.env.SLA_MS || '2000', 10);
  const SLA_GET = parseInt(process.env.SLA_MS_GET_BOARD || process.env.SLA_MS || '2000', 10);
  const SLA_DELETE = parseInt(process.env.SLA_MS_DELETE_BOARD || process.env.SLA_MS || '2000', 10);
  test('[FUNCTIONAL][BOARDS][SLA] Criar, validar e deletar um board', async () => {
    const name = uniqueName('Board');
    const t0 = Date.now();
    const created = await createBoard(name, { defaultLists: 'false' });
    const tCreate = Date.now() - t0;
    expect(created.name).toBe(name);
    const boardId = created.id;

    const t1 = Date.now();
    const fetched = await getBoard(boardId);
    const tGet = Date.now() - t1;
    expect(fetched.id).toBe(boardId);
    expect(fetched.name).toBe(name);

    const t2 = Date.now();
    await deleteBoard(boardId);
    const tDelete = Date.now() - t2;

    if (process.env.MOCK_API === '1') {
      let notFound: any;
      try {
        await getBoard(boardId);
      } catch (e) {
        notFound = e;
      }
      expect(String(notFound)).toMatch(/404|NotFound/i);
    } else {
      const q = new URLSearchParams({
        key: process.env.TRELLO_KEY!,
        token: process.env.TRELLO_TOKEN!,
      });
      const res = await fetch(`https://api.trello.com/1/boards/${boardId}?${q.toString()}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'trello-management-api-playwright' },
      });
      expect(res.status).toBe(404);
    }

    expect(tCreate).toBeLessThan(SLA_CREATE);
    expect(tGet).toBeLessThan(SLA_GET);
    expect(tDelete).toBeLessThan(SLA_DELETE);
  });

  test('[NEGATIVE][BOARDS] Deletar board já deletado retorna 404', async () => {
    const created = await createBoard(uniqueName('BoardNeg'), { defaultLists: 'false' });
    const boardId = created.id;
    await deleteBoard(boardId);
    if (process.env.MOCK_API === '1') {
      let error: any;
      try {
        await deleteBoard(boardId);
      } catch (e) {
        error = e;
      }
      expect(String(error)).toMatch(/404|NotFound/i);
    } else {
      const q = new URLSearchParams({
        key: process.env.TRELLO_KEY!,
        token: process.env.TRELLO_TOKEN!,
      });
      const res = await fetch(`https://api.trello.com/1/boards/${boardId}?${q.toString()}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'User-Agent': 'trello-management-api-playwright' },
      });
      expect(res.status).toBe(404);
    }
  });

  test('[NEGATIVE][BOARDS] Criar board com nome vazio retorna 400', async () => {
    if (process.env.MOCK_API === '1') {
      let error: any;
      try {
        await createBoard('', { defaultLists: 'false' } as any);
      } catch (e) {
        error = e;
      }
      expect(String(error)).toMatch(/400|BadRequest/i);
    } else {
      const q = new URLSearchParams({
        key: process.env.TRELLO_KEY!,
        token: process.env.TRELLO_TOKEN!,
      });
      const res = await fetch(`https://api.trello.com/1/boards?${q.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'trello-management-api-playwright',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ name: '', defaultLists: 'false' }).toString(),
      });
      expect(res.status).toBe(400);
    }
  });
});
