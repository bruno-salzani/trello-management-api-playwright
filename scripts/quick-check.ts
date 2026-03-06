import { request } from '@playwright/test';
import 'dotenv/config';

async function main() {
  const ctx = await request.newContext({
    baseURL: 'https://api.trello.com/1',
    extraHTTPHeaders: {
      Accept: 'application/json',
      'User-Agent': 'trello-management-api-playwright',
    },
  });
  const name =
    'TEST_QC_' +
    new Date()
      .toISOString()
      .replace(/[:.TZ-]/g, '')
      .slice(0, 14);
  const res = await ctx.post('/boards', {
    form: {
      name,
      defaultLists: 'false',
      key: process.env.TRELLO_KEY!,
      token: process.env.TRELLO_TOKEN!,
    },
  });
  const ct = res.headers()['content-type'];
  const status = res.status();
  const finalUrl = res.url();
  let preview: string;
  try {
    const txt = await res.text();
    preview = txt.slice(0, 200);
  } catch {
    preview = '<no text>';
  }
  console.log(JSON.stringify({ status, contentType: ct, finalUrl, preview }));
  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
