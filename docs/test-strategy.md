# Test Strategy

## Objetivos

- Garantir estabilidade funcional e performance (p95) dos principais fluxos do Trello via API.
- Fornecer feedback rápido em PRs e visibilidade diária via Nightly-Perf.

## Pirâmide de Testes

- Contrato (leve): validação de campos essenciais por endpoint nos helpers.
- API Funcional/Negativa: foco em fluxos e erros conhecidos.
- Performance: p95 e estabilidade diária (Nightly).
- Futuros: Contract Testing (OpenAPI/Pact) e Mutation Testing (Stryker).

## Políticas

- SLAs: thresholds configuráveis por endpoint; gates de p95 na CI.
- Retry: apenas 429 em GET/DELETE com backoff e jitter; POST/PUT sem retry.
- Flaky: reruns seletivos e marcação [FLAKY] (futuro).
- Dados: prefixo TEST\_ e runId para limpeza e correlação.

## Observabilidade

- x-request-id por chamada; métricas JSONL + summary; resumo no Job Summary da pipeline.
- Futuro: tracing via OpenTelemetry.

## Ownership

- CODEOWNERS define responsáveis; PR Fast Checks garantem feedback rápido.
