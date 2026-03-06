import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { BoardSchema } from '../utils/contracts.ts';

async function main() {
  const consumer = new PactV3({
    consumer: 'trello-management-api-playwright',
    provider: 'trello-api',
  });

  consumer
    .given('Board can be created')
    .uponReceiving('create board')
    .withRequest({
      method: 'POST',
      path: '/1/boards',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: {
        name: MatchersV3.like('TEST_PACT'),
        defaultLists: MatchersV3.like('false'),
        key: MatchersV3.like('***'),
        token: MatchersV3.like('***'),
      },
    })
    .willRespondWith({
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: {
        id: MatchersV3.like('abc123'),
        name: MatchersV3.like('TEST_PACT'),
        closed: MatchersV3.like(false),
      },
    });

  consumer
    .given('Board exists')
    .uponReceiving('get board by id')
    .withRequest({
      method: 'GET',
      path: MatchersV3.regex(/\/1\/boards\/[\w-]+/, '/1/boards/abc123'),
      headers: { Accept: 'application/json' },
    })
    .willRespondWith({
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: {
        id: MatchersV3.like('abc123'),
        name: MatchersV3.like('TEST_PACT'),
        closed: MatchersV3.like(false),
      },
    });

  await consumer.executeTest(async (mockServer) => {
    const createRes = await fetch(`${mockServer.url}/1/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=TEST_PACT&defaultLists=false&key=***&token=***',
    });
    if (!createRes.ok) throw new Error(`create failed ${createRes.status}`);
    const created = await createRes.json();
    BoardSchema.parse(created);
    const id = created.id;
    const getRes = await fetch(`${mockServer.url}/1/boards/${id}`, {
      headers: { Accept: 'application/json' },
    });
    if (!getRes.ok) throw new Error(`get failed ${getRes.status}`);
    const got = await getRes.json();
    BoardSchema.parse(got);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
