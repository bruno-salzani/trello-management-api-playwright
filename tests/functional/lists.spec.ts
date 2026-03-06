import { test, expect } from '@playwright/test';
import {
  archiveList,
  createBoard,
  createList,
  deleteBoard,
  uniqueName,
} from '../../utils/api_helper';

test.describe('Gerenciamento de Listas', () => {
  let boardId: string;
  const baseName = uniqueName('BoardLists');
  const SLA_CREATE_LIST = parseInt(
    process.env.SLA_MS_CREATE_LIST || process.env.SLA_MS || '2000',
    10
  );
  const SLA_ARCHIVE_LIST = parseInt(
    process.env.SLA_MS_ARCHIVE_LIST || process.env.SLA_MS || '2000',
    10
  );

  test.beforeAll(async () => {
    const created = await createBoard(baseName, { defaultLists: 'false' });
    boardId = created.id;
  });

  test.afterAll(async () => {
    if (boardId) {
      await deleteBoard(boardId);
    }
  });

  test('[FUNCTIONAL][LISTS][SLA] Criar listas To Do, Doing e Done e arquivar uma', async () => {
    const t0 = Date.now();
    const toDo = await createList('To Do', boardId);
    const tList1 = Date.now() - t0;
    const t1 = Date.now();
    const doing = await createList('Doing', boardId);
    const tList2 = Date.now() - t1;
    const t2 = Date.now();
    const done = await createList('Done', boardId);
    const tList3 = Date.now() - t2;

    expect(toDo.idBoard).toBe(boardId);
    expect(doing.idBoard).toBe(boardId);
    expect(done.idBoard).toBe(boardId);

    const t3 = Date.now();
    const archived = await archiveList(doing.id, true);
    const tArchive = Date.now() - t3;
    expect(archived.closed).toBe(true);

    expect(tList1).toBeLessThan(SLA_CREATE_LIST);
    expect(tList2).toBeLessThan(SLA_CREATE_LIST);
    expect(tList3).toBeLessThan(SLA_CREATE_LIST);
    expect(tArchive).toBeLessThan(SLA_ARCHIVE_LIST);
  });

  test('[NEGATIVE][LISTS] Arquivar lista inexistente retorna erro', async () => {
    let error: any;
    try {
      await archiveList('lista_inexistente', true);
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    expect(String(error)).toMatch(/404|NotFound|400|BadRequest/i);
  });
});
