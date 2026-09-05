# Briefing CC — Fase 3: geração de cobranças por API (v2)

**05/09/2026** · substitui a v1 do mesmo dia. Correções após leitura do código
real do webhook (`cora-portal/api/webhooks/asaas/index.js` e
`api/_lib/asaas-status.js`): formato do `externalReference`, reflexo de status
em grupo, e o descarte de eventos de sandbox.

Fase 2 completa e mergeada (2a, 2b, 2c). Arquitetura:
`Docs/CORA_Plano_Cobranca_Unica_v2_1.md`. **Go/no-go: 21/09**, fallback novembro.

## Regras da sessão

Feature branch; squash pelo Hugo; commits ASCII sem acento; ler os dois
STATUS.md antes; parar e reportar no fim de cada bloco. Sandbox do Asaas
sempre — **produção nunca nesta fase**.

---

## TAREFA 0 — Fase 0 (sem código)

Ler os STATUS, mapear o que existe contra os blocos abaixo, **reportar e
parar**. Incluir no reporte a proposta de mapeamento para o sandbox (seção
própria abaixo).

---

## Decisões já tomadas (não reabrir)

**Uma cobrança por pagador** (Hugo, 05/09). O grupo da Aldina vira **um** boleto
de R$ 278, não dois de R$ 139. É o ponto do modelo e é o que a tela já mostra.

**`faturas` continua uma por assinatura.** Preserva o detalhe por cesta (que
vira o extrato) e a idempotência em `(subscription_id, periodo_referencia)`. As
N faturas de um grupo compartilham o mesmo `asaas_payment_id`.

**Migration 0046:** soltar o UNIQUE de `faturas.asaas_payment_id`, que hoje
impede o id repetido no grupo. Manter a coluna e um índice não-único. A tabela
tem **0 linhas** — gratuito agora, caro depois.

> Alternativa descartada: tabela `cobrancas` por pagador. Mais limpa
> conceitualmente, mais schema e mais reescrita da prévia. Para 26 grupos com 1
> par agrupado, não paga.

---

## BLOCO A — O gêmeo (começar por aqui)

Transpor `cora-backoffice/src/lib/previa.ts` para
`cora-portal/api/_lib/previa.js`. **Não depende de nenhum bloqueio externo.**

- JavaScript sem anotações de tipo; a conta idêntica **até o centavo e até a
  ordem dos alertas**.
- Portar os testes junto. Mesmos casos, mesmos números.
- Cabeçalho nos dois arquivos apontando o gêmeo.
- Nenhuma dependência nova. A aritmética de data em UTC sobre `YYYY-MM-DD`
  existe justamente para atravessar sem `date-fns`.

**Teste de travessia obrigatório:** entrada fixa rodada nos dois lados, saída
idêntica. É o que a conciliação da Fase 4 vai automatizar.

## BLOCO B — Endpoint de geração (portal)

Function no `cora-portal`, padrão do `/api/asaas/vincular`: service_role,
autenticada por JWT admin, chamada pelo backoffice. **Nada de `api/` no
backoffice.**

**Sequência, e a ordem importa:**

1. Recalcular a prévia do zero, no servidor, com o gêmeo. **Nunca confiar no
   total que veio do browser** — é a razão de a fase existir.
2. Para cada grupo de pagador, inserir as N linhas em `faturas` (status
   `pendente`, `asaas_payment_id` nulo) **antes** de qualquer chamada à API.
   Falhou o insert pela constraint, não chama.
3. `POST /v3/payments` — uma chamada por grupo.
4. Gravar em todas as N faturas do grupo: `asaas_payment_id`,
   `asaas_invoice_url`, `linha_digitavel`, `pix_payload`.

**Retry:** a semântica muda com o passo 2. Fatura existente **com**
`asaas_payment_id` = pronta, pular. Existente **sem** = a chamada à API não
completou, refazer só a chamada, sem reinserir. Testar os dois caminhos.

### ⚠️ `externalReference` = UUID puro do pagador

A v1 deste briefing dizia `pagador_subscription_id + AAAA-MM`. **Está errado e
quebraria o webhook.** O handler só tenta o caminho principal quando o valor
casa com `UUID_RE` (regex de uuid puro, linha 37 do webhook); um valor composto
falha o teste e cai no fallback por `asaas_customer_id`, que é o caminho fraco.

Use **o uuid da assinatura do pagador, sozinho**. Não precisa carregar o
período: a idempotência é a constraint local em `faturas`, nunca o
`externalReference` (o Asaas não valida unicidade desse campo).

### ⚠️ Reflexo de status em grupo

O webhook reflete status **só na assinatura que casou** (`update ... .eq("id",
subscriptionId)`, com o mapa de `_lib/asaas-status.js`: `PAYMENT_CONFIRMED` e
`PAYMENT_RECEIVED` viram `em_dia`, `PAYMENT_OVERDUE` vira `vencido`).

Com uma cobrança cobrindo duas assinaturas, quando a Aldina pagar, **a Fernanda
continua marcada como não paga**. Aparece como "paguei e o sistema não viu" no
primeiro ciclo.

Propor o tratamento no reporte, com trade-off. Duas direções: o reflexo passar a
alcançar quem tem `pagador_subscription_id` apontando para a assinatura que
casou; ou o status derivar de `faturas` em vez de vir do webhook. **Não
implementar antes de combinar** — mexer no webhook é mexer no que hoje funciona
para 39 pessoas.

### Mapa de `billingType`

| forma_pagamento | billingType | por quê |
|---|---|---|
| `boleto_pix` (25) | `UNDEFINED` | aceita boleto e Pix, e é a que devolve linha digitável e payload Pix na mesma resposta |
| `boleto` (2) | `BOLETO` | |
| `pix` (0) | `PIX` | nenhum caso hoje |
| `cartao` (13) | — | fora de escopo, seguem na recorrência |

Grupo com formas mistas cobra pela forma **do pagador** — a prévia já resolve e
já alerta.

**Descrição da cobrança:** precisa identificar as cestas quando o grupo tem mais
de uma, no vocabulário da casa. Ex.: `Outubro: assinatura Aldina + Fernanda`.
Usar as skills de voz da Cora.

## BLOCO C — Ligar o botão

O "Gerar cobranças" da tela da prévia passa a chamar o endpoint. Continua
**desabilitado enquanto houver alerta que bloqueia** (`sem_cliente_asaas`,
`forma_pagamento_ausente`, `total_extras_divergente`). Estado de carregando,
erro visível, e resultado com o que foi criado.

---

## O sandbox: duas armadilhas

**1. Os clientes não existem lá.** Os `asaas_customer_id` do banco
(`cus_000...`) são de **produção**. No sandbox a geração falharia em todos.

Encaminhamento: criar **2 ou 3 clientes no sandbox** à mão, rodar o fluxo
completo contra um subconjunto reduzido que **inclua um grupo de pagador**, e
cobrir o resto com teste unitário e API mockada. Valida o contrato sem precisar
de 26 clientes. Propor na Tarefa 0 como mapear sem sujar o banco de produção.

**2. O webhook descarta eventos de sandbox** (`ehEventoSandbox`, linha 92 do
handler: responde 200 com `ignored: "sandbox"` e **não grava**). Então o ciclo
gerar → pagar → refletir status **não é testável de ponta a ponta pelo
sandbox**. O reflexo de status em grupo precisa ser testado por outro caminho —
propor qual.

## Bloqueios: estado real em 05/09

1. **`ASAAS_API_KEY_SANDBOX`** — o Hugo configurou **na Vercel** em 04/09. Se
   não aparece, é porque falta um `.env.local` para o desenvolvimento local, não
   porque a chave não existe. Confirmar de qual dos dois se trata antes de
   tratar como bloqueio.
2. ~~Fernanda sem `asaas_customer_id`~~ — **resolvido pela decisão do pagador**.
   A cobrança dela vai no cliente da Aldina. Conferido em 05/09: **nenhum dos 26
   pagadores está sem cliente no Asaas.**
3. **Policy de `faturas` para o assinante** — hoje só `admin_read_faturas`.
   **Não bloqueia outubro** (a tela Pagamentos é pós-outubro), mas registrar que
   a afirmação do plano sobre o assinante "ler por RLS" é falsa hoje.

## Caso Sabina — não "consertar"

`Sabina Paixão` está ativa com `asaas_customer_id` **nulo**, e é de propósito.
Ela e a Maria Helena têm o mesmo CPF e o Asaas não aceita cliente duplicado, e a
cobrança de setembro dela foi criada dentro do cliente da Maria Helena
(`cus_000189998872`).

**Não preencher o `asaas_customer_id` dela com o mesmo valor.** O fallback do
webhook usa `.maybeSingle()` sobre `asaas_customer_id`, que **dá erro com mais
de uma linha** — o catch engole, `reflectionFailed` fica true e o
`subscription_id` fica nulo. Hoje a Maria Helena resolve certo; com o
preenchimento, as **duas** parariam de refletir status.

Ela aparece "sem status" no Financeiro até a migração do cartão, e isso é o
comportamento aceito. Ambas são cartão, fora do escopo desta fase.

## Fora de escopo (não desenvolver)

Conciliação (Fase 4), exclusão das cobranças antigas (Fase 5), e-mails e régua,
tela Pagamentos do portal, qualquer coisa de cartão, token ou Pix Automático.

## Critério de pronto

Ciclo de `2026-10` gerado em sandbox contra o subconjunto de teste: prévia
recalculada no servidor batendo com a da tela, cobrança única no grupo de
pagador, `externalReference` como uuid puro, `faturas` com o mesmo
`asaas_payment_id` nas duas linhas do par, e os dois caminhos de retry testados
sem duplicar.
