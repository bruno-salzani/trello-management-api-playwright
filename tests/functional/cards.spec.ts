import { test, expect } from '@playwright/test';
import {
  addComment,
  createBoard,
  createCard,
  createList,
  deleteBoard,
  moveCard,
  uniqueName,
} from '../../utils/api_helper';

test.describe('Gerenciamento de Cards', () => {
  let boardId: string;
  let listAId: string;
  let listBId: string;
  const SLA_CREATE_CARD = parseInt(
    process.env.SLA_MS_CREATE_CARD || process.env.SLA_MS || '2000',
    10
  );
  const SLA_MOVE_CARD = parseInt(process.env.SLA_MS_MOVE_CARD || process.env.SLA_MS || '2000', 10);
  const SLA_COMMENT_CARD = parseInt(
    process.env.SLA_MS_COMMENT_CARD || process.env.SLA_MS || '2000',
    10
  );

  test.beforeAll(async () => {
    const board = await createBoard(uniqueName('BoardCards'), { defaultLists: 'false' });
    boardId = board.id;
    const listA = await createList('To Do', boardId);
    const listB = await createList('Doing', boardId);
    listAId = listA.id;
    listBId = listB.id;
  });

  test.afterAll(async () => {
    if (boardId) {
      await deleteBoard(boardId);
    }
  });

  test('[FUNCTIONAL][CARDS][SLA] Criar, mover e comentar um card', async () => {
    const t0 = Date.now();
    const card = await createCard('Implementar pipeline CI', listAId);
    const tCreate = Date.now() - t0;
    expect(card.idList).toBe(listAId);

    const t1 = Date.now();
    const moved = await moveCard(card.id, listBId);
    const tMove = Date.now() - t1;
    expect(moved.idList).toBe(listBId);

    const t2 = Date.now();
    const comment = await addComment(card.id, 'Comentário técnico: card movido via API');
    const tComment = Date.now() - t2;
    expect(comment.type || comment.data?.text).toBeDefined();

    expect(tCreate).toBeLessThan(SLA_CREATE_CARD);
    expect(tMove).toBeLessThan(SLA_MOVE_CARD);
    expect(tComment).toBeLessThan(SLA_COMMENT_CARD);
  });

  test('[NEGATIVE][CARDS] Criar card com list_id inválido retorna erro', async () => {
    let error: any;
    try {
      await createCard('Card inválido', 'lista_inexistente');
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    expect(String(error)).toMatch(/400|BadRequest/i);
  });

  test('[NEGATIVE][CARDS] Mover card para list_id inválido retorna erro', async () => {
    const card = await createCard('Card para mover inválido', listAId);
    let error: any;
    try {
      await moveCard(card.id, 'lista_inexistente');
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    expect(String(error)).toMatch(/400|BadRequest/i);
  });

  test('[NEGATIVE][CARDS] Comentar em card inexistente retorna 404', async () => {
    let error: any;
    try {
      await addComment('card_inexistente', 'comentário');
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    expect(String(error)).toMatch(/404|NotFound/i);
  });
});
