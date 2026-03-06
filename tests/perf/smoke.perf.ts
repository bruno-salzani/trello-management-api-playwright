import { test, expect } from '@playwright/test';
import { createBoard, deleteBoard, uniqueName } from '../../utils/api_helper';

test.describe('[PERF] Boards', () => {
  test('[PERF][BOARDS] Criar e deletar board rapidamente', async () => {
    const name = uniqueName('PerfBoard');
    const created = await createBoard(name, { defaultLists: 'false' });
    expect(created.name).toBe(name);
    await deleteBoard(created.id);
  });
});
