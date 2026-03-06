import 'dotenv/config';

async function main() {
  const key = process.env.TRELLO_KEY;
  const tokenToRevoke = process.env.TOKEN_TO_REVOKE || process.env.TRELLO_TOKEN;
  if (!key) {
    console.error('Defina TRELLO_KEY no .env ou variável de ambiente');
    process.exit(1);
  }
  if (!tokenToRevoke) {
    console.error('Defina TOKEN_TO_REVOKE (ou TRELLO_TOKEN) para revogar');
    process.exit(1);
  }

  const url = `https://api.trello.com/1/tokens/${encodeURIComponent(tokenToRevoke)}?key=${encodeURIComponent(
    key
  )}&token=${encodeURIComponent(tokenToRevoke)}`;
  const res = await fetch(url, { method: 'DELETE' });
  const status = res.status;
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  if (status >= 200 && status < 300) {
    console.log('Token revogado com sucesso.');
  } else {
    console.error('Falha ao revogar token:', status, body);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
