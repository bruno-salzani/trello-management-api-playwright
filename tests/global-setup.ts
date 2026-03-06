import 'dotenv/config';
import { getJSON, del } from '../utils/http_client';
import { trelloAuth, TEST_PREFIX } from '../utils/api_helper';

function olderThan(dateIso: string, minutes: number): boolean {
  const t = new Date(dateIso).getTime();
  return Date.now() - t > minutes * 60 * 1000;
}

async function preemptiveCleanup() {
  const { key, token } = trelloAuth();
  const boards: any[] = await getJSON(`/members/me/boards`, {
    key,
    token,
    fields: 'name,closed,dateLastActivity',
  });
  const stale = boards.filter(
    (b) =>
      typeof b.name === 'string' &&
      b.name.startsWith(TEST_PREFIX) &&
      olderThan(b.dateLastActivity || new Date(0).toISOString(), 120)
  );
  for (const b of stale) {
    try {
      await del(`/boards/${b.id}`, { key, token });
      // eslint-disable-next-line no-console
      console.log(`[CLEANUP] Deleted stale board ${b.name} (${b.id})`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[CLEANUP] Failed to delete ${b.id}: ${(e as Error).message}`);
    }
  }
}

export default async function () {
  try {
    await preemptiveCleanup();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[CLEANUP] Preemptive cleanup skipped:', (e as Error).message);
  }
}
