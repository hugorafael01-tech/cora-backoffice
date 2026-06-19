# Briefing: Produção, aba inicial derivada do estado do ciclo (BUGS item 3)

Repo: `cora-backoffice`
Origem: `BUGS.md`, item 3.
Tipo: defeito (atrapalha). Sem mudança de schema.

## Sintoma

Ao reabrir o backoffice depois de um tempo parado, a Produção abre na aba "Definir Volume" mesmo quando o ciclo já está em produção. Esperado: abrir na fase em andamento.

## Causa raiz (confirmada no código, jun/2026)

Fluxo de entrada da Produção:

1. `/producao` redireciona pra `/producao/atual` (App.tsx).
2. `/producao/atual` -> `ProducaoAtualRedirect` resolve o ciclo atual via `escolherCicloAtual` e navega pra `/producao/:id`, preservando apenas o `search` que JÁ existir na URL.
3. `/producao/:id` -> `ProducaoDefinirVolume`. A aba ativa vem do query param `?aba=` (valores válidos: `volume` | `preparacao` | `acompanhamento` | `registro`). Quando `?aba=` está ausente, o default é `volume`.

Em cold open (reabrir o app, navegar de fora) não existe `?aba=` na URL. Então a aba cai em `volume` sempre, independente de onde o ciclo está. Não é perda de estado, é default de aba que ignora o estado do ciclo.

## Comportamento esperado

A aba inicial deve refletir o estado do ciclo. O helper `derivaEstado(semana, agora)` em `src/lib/semana.ts` já retorna `'rascunho' | 'A' | 'B' | 'C'`. Mapeamento proposto (confirmar, ver "Decisões"):

- `rascunho` ou `A` (pré-corte, previsão): aba `volume`
- `B` (pós-corte, produção em curso): aba `acompanhamento`
- `C` (concluído, retrospectivo): aba `registro`

Regra dura: deep-link explícito tem prioridade. Se a URL trouxer `?aba=volume` (ou qualquer aba válida), respeitar e NÃO sobrescrever. A derivação só age quando `?aba=` está ausente.

## Onde mexer (proposta, confirmar no código antes)

Helper de estado já existe: `derivaEstado` em `src/lib/semana.ts`.

Opção 1 (preferida): em `ProducaoAtualRedirect`, ao resolver o ciclo, derivar a aba a partir do estado e anexar `?aba=` no `navigate` quando a URL não trouxer aba. Centraliza a lógica de "qual é a fase atual" no ponto que já é responsável por resolver o "atual", e não toca a tela.

- Atenção: hoje `escolherCicloAtual` e o `select` em `ProducaoAtualRedirect` puxam só `id, data_entrega, status` da tabela `semanas`. `derivaEstado` precisa de `data_corte` além de `status`. Incluir `data_corte` no select.

Opção 2: em `ProducaoDefinirVolume`, computar o default de aba a partir do estado quando `abaParam` é nulo. Risco maior: precisa garantir que não sobrescreve navegação explícita nem entra em loop com `setSearchParams`. A tela já gerencia `?aba=` via `useSearchParams` com `replace`.

## Decisões a tomar (CC propõe, Hugo aprova antes de codar)

1. Opção 1 vs Opção 2.
2. Mapeamento estado -> aba: confirmar que `B` sempre quer `acompanhamento`. Definir o fallback se o ciclo estiver em `B` mas o volume ainda não tiver sido definido (abrir em `acompanhamento` vazio é ruim? cair em `volume` nesse caso?).

## Fora de escopo (não tocar)

- Conteúdo das abas (Acompanhamento, Registro, Preparação, Volume). Só a escolha da aba inicial.
- `escolherCicloAtual`, exceto incluir `data_corte` no select se a Opção 1 exigir.
- Item 4 (nome legível do ciclo) e a contagem regressiva D-0. São briefing separado, NÃO entram aqui.
- Qualquer mudança de schema. Se concluir que precisa de coluna/enum novo, PARAR e avisar.

## Definição de pronto

- Reabrir `/producao` com ciclo em estado `B` abre em `acompanhamento`; estado `C` abre em `registro`; `A`/`rascunho` abre em `volume`.
- `?aba=X` explícito na URL continua respeitado (não é sobrescrito pela derivação).
- Trocar de aba manualmente continua funcionando, com `replace` (sem poluir histórico).
- Sem regressão no redirect de `/producao` -> `/producao/atual` -> `/producao/:id`.

## Smoke test (preview Vercel)

Com os dados atuais, validar o máximo de estados possível:

1. Abrir `/producao` direto (sem `?aba=`) e confirmar que a aba inicial bate com o estado do ciclo atual.
2. Abrir `/producao/atual?aba=volume` com um ciclo em estado B e confirmar que respeita `volume` (não força `acompanhamento`).
3. Trocar de aba na tela e confirmar que a URL atualiza e o histórico não enche.

Se não houver ciclo em algum estado pra testar, entregar a query read-only pra Hugo rodar no SQL Editor e confirmar o estado dos ciclos existentes, e validar os estados disponíveis.
