## Contribuindo

Obrigado por considerar contribuir! Este repositório demonstra boas práticas de testes de API com Playwright.

### Pré-requisitos

- Node 20 (veja `.nvmrc`)
- `.env` com `TRELLO_KEY` e `TRELLO_TOKEN`

### Fluxo local

1. Instale: `npm install`
2. Checagem: `npm run typecheck`
3. Testes:
   - Funcionais: `npm run test:functional`
   - Negativos: `npm run test:negative`
   - Perf opcional: `npm run test:perf`

### Padrões

- Não commit de segredos (o `.env` está no `.gitignore`)
- Mantenha títulos dos testes com tags apropriadas
- Atualize README quando adicionar scripts ou workflows

### Pull Requests

Use o template de PR e anexe relatório do Playwright quando aplicável.
