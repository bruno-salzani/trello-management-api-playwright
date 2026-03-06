## Segurança

- As credenciais (`TRELLO_KEY`, `TRELLO_TOKEN`) devem ficar somente no `.env` local ou nos _Secrets_ do GitHub.
- Nunca envie chaves/tokens em PRs, Issues ou logs.
- Tokens expostos devem ser revogados imediatamente (script `npm run token:revoke`).
- Dúvidas ou incidentes: abra uma _Security Advisory_ privada no GitHub.
