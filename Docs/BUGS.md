# BUGS — cora-backoffice

Registro vivo de defeitos, atritos de UX e mudanças de modelo observados na operação do backoffice. Operação solo, sem ferramenta externa: editar este arquivo direto e referenciar o item no commit que corrige.

Última atualização: 02/jul/2026

## Como usar

Formato por item: `[tag · severidade] Tela/módulo: o que acontece (e o esperado, se souber)`

Tags:
- `defeito`: comportamento errado, contra a spec
- `ux`: funciona, mas a interface é ruim
- `redesign`: muda o modelo ou o fluxo, precisa de mini-spec antes de código
- `feature`: capacidade nova

Severidade:
- `quebra`: trava o fluxo ou gera dado errado
- `atrapalha`: funciona, mas custa tempo ou atenção
- `cosmético`: incômodo visual, sem impacto operacional

Priorização é etapa separada. Aqui é só captura.

---

## Defeitos

- `[defeito · atrapalha]` **Semana/Ciclo:** ciclo concluído continua exibindo "pré-produção · planejada". Falta transição de status no encerramento (`week_status` → `concluida` refletido no resumo). (item 5)
- `[defeito · atrapalha]` **Semana/EditarCiclo:** o UPDATE da janela "Padrão" não checa zero-rows — se a janela não casar, salva calado e dessincroniza de `semanas`. Guard: `.select()` + erro visível. (follow-up da PR #56)

## Corrigidos

- ~~`[defeito · atrapalha]` **Produção (estado/landing):** ao reabrir o backoffice depois de um tempo parado, abre em "Definir Volume" em vez da fase em andamento.~~ Corrigido em [PR #54](https://github.com/hugorafael01-tech/cora-backoffice/pull/54) (19/jun/2026): `ProducaoAtualRedirect` injeta `?aba=` derivado do estado do ciclo quando a URL não traz o param. `rascunho`/`A` → volume · `B` → acompanhamento · `C` → registro. Deep-link explícito tem prioridade. (item 3)

## UX / interface

- `[ux · atrapalha]` **Navegação global:** bottom nav com alvos de toque pequenos. Refazer mobile-first, com áreas de clique maiores. (item 7)

## Redesign: módulo Produção / Acompanhamento (precisa mini-spec)

Cluster único, não 4 bugs soltos. Atacam a mesma tela com a mesma lógica nova: pensar a produção em blocos/etapas macro, não receita a receita. Alto atrito operacional diário, tende a piorar quando o volume subir com o Ramalhos. Merece sessão própria antes de qualquer código.

- Registro das fases de produção muito trabalhoso; divisão por receita (não por blocos) não ajuda. (item 2)
- Preparação lista itens que não se aplicam à operação real (ex: mise en place de água nunca é feito). (item 8)
- Referência de temperatura no acompanhamento deveria ser do D2 (dia em que a massa é batida e precisa de fermentação mais acelerada pra assar de manhã cedo). (item 9)
- Acompanhamento subdividido em 5 etapas macro: 1) conferência do mise en place, 2) autólise/batimentos, 3) dobras/bulk, 4) fermentação TA > TF (overnight), 5) cocção. (item 10)

## Features (cross-system)

- `[feature · atrapalha]` **Expedição / Endereços:** sem forma de reordenar os endereços da rota. Bairros próximos (ex: Botafogo e Humaitá) ficam separados enquanto Gávea entra antes, forçando o entregador a improvisar a sequência mentalmente. Esperado: arrastar-e-soltar (ou outro mecanismo) para definir a ordem de entrega manualmente antes de sair. (item 11)

- `[feature]` **Pedido para não-assinante:** criar uma compra/pedido para alguém fora da assinatura (ex: brinde a um pré-cadastrado). Toca pedidos/portal/backoffice. (item 6)
  - Conexão: mesmo buraco da fornada paralela parqueada (venda fora do ritmo de assinatura). Avaliar um conceito único de "produção/venda avulsa" que cubra os dois.

## Parqueado (não construir agora)

- **Produção paralela / fornada avulsa desacoplada da semana ISO.** Modelo atual: `weeks` tem `UNIQUE (iso_year, iso_week)` e uma `delivery_date` única, logo uma entrega por semana ISO. Fornadas paralelas (ex: feira de sábado junto da semana normal) não cabem sem desacoplar o ciclo de produção da semana ISO.
  - Por que parar agora: Ramalhos ainda não chegou, zero ciclo real rodado, modelar hoje é de imaginação. Operar por fora nos primeiros ciclos, observar o padrão real, modelar com 2-3 exemplos concretos.
  - Upstream: depende do mapeamento de feiras (tarefa de negócio do Hugo, fora deste arquivo).
  - Possível fusão com o item 6 (não-assinante).
