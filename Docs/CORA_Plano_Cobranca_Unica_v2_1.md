# Cobrança única — arquitetura v2.1

**Set/2026** · substitui a v2 de 04/09. Correções após a Fase 0 do CC: **nada da
geração estava construído** (a v2 afirmava o contrário — erro de registro),
números da base atualizados, decisões de infraestrutura fechadas. Esta é a
versão a ser commitada em `cora-backoffice/docs/`.

---

## O que muda, em uma frase

A Cora deixa de usar **assinatura recorrente** do Asaas e passa a **gerar uma
cobrança por assinante por mês, via API**, já com mensalidade e extras somados.

---

## Por que mudou de plano

Quatro incidentes mostraram que remendar a recorrência não se sustenta:

**A duplicata da Sonia (30/08).** Alterar o valor da assinatura gerou duas
cobranças de outubro. Se não fosse percebida, ela seria cobrada R$ 426.

**A antecedência de 40 dias.** Três meses de cobranças coexistem, idênticas na
tela e no DDA do banco. A Luana confirmou que dá para reduzir para 14 dias —
pedido feito.

**O Pix quebrou (31/08).** Todas as faturas retornaram "QR Code inválido", sem
controle sobre a causa. **Resolvido em 01/09** — instabilidade do Asaas. Fica o
aprendizado: o contorno que funciona é Pix direto na chave CNPJ + baixa manual,
que dispara `PAYMENT_RECEIVED` normalmente.

**Cobrança com cartão informado é imutável (01/09).** O Asaas não permite
alterar o valor de cobranças em que o cliente já informou cartão. Isso invalida
de vez a opção de somar extras a uma cobrança pendente via `PUT`.

Nenhum dos quatro acontece com uma cobrança criada uma vez por mês, com o valor
final, depois do fechamento. **Cobrança criada com o valor certo nunca precisa
ser alterada.**

---

## O modelo de cobrança

**Uma cobrança por assinante por mês**, contendo:

| Componente | Período | Lógica |
|---|---|---|
| Mensalidade | mês corrente | **adiantada** — "você compra adiantado e eu me organizo pra te entregar toda quinta" |
| Extras | ciclo anterior | **pós-consumo** — só entra o que foi entregue |
| Ajuste proporcional | quando houver | aumento de plano no meio do mês |

### O ciclo (decidido 01/09)

Lógica de conta de luz: fecha a leitura, cobra alguns dias depois.

```
última quinta até o dia 25 · fecha a leitura de extras
dia 26                     · job monta a PRÉVIA (não cria nada no Asaas)
até o dia 28               · Hugo confere no backoffice e aperta "Gerar"
dia 8 do mês seguinte      · vencimento
```

- Entregas de quinta após o dia 25 entram no ciclo seguinte. O extrato diz isso
  explicitamente. Caso de teste obrigatório: outubro (quintas 1, 8, 15, 22,
  **29** — o 29 cai para novembro).
- **Por que vencimento 8 e não 10:** a régua de atraso precisa de espaço antes
  da quinta seguinte (aviso dia 9, segundo aviso dia 12, pausa dia 15).

### Regra de vigência (29/08, mantida)

| | Cobrança | Entrega |
|---|---|---|
| Aumento | proporcional no mês corrente + cheio na renovação | vale na quinta seguinte |
| Redução | não muda no mês corrente; novo valor na renovação | mantém o contratado até o fim do mês |

### Regras de borda (decididas 01/09)

**Entrada no meio do mês:** primeira cobrança proporcional por quintas
restantes ÷ quintas do mês, sobre mensalidade e frete. Portal libera na
confirmação do pagamento, como hoje.

**Pausa voluntária:** recebe até o fim do mês pago, sem estorno.

**Atraso:** aviso em D+1 (dia 9), segundo aviso em D+4 (dia 12) já informando
qual quinta fica suspensa, pausa por inadimplência em D+7 (dia 15) se não houver
retorno. O gatilho dos avisos verifica o status na hora de mandar — nunca o
evento `PAYMENT_OVERDUE` cru (caso Anouk, 04/09: atraso de horas resolvido pela
cliente de manhã). Campo `subscriptions.pause_reason` distingue
voluntária de inadimplência.

---

## A base (Fase 0, verificado no banco)

**40 assinaturas ativas** (sem dev): **15 cartão**, **22 boleto/Pix**, **3 sem
evento de pagamento**. A fonte de verdade passa a ser a coluna
`subscriptions.forma_pagamento` (enum cartao/boleto/pix), preenchida à mão pelo
Hugo conferindo no painel do Asaas — inferência por webhook não fecha.

**Primeira fase cobre só boleto/Pix (~25).** Os **15 de cartão permanecem na
recorrência do Asaas** durante a transição, com extras em cobrança separada.
Custo aceito: o caso "paguei uma, falta a outra" sobrevive para eles por um ou
dois ciclos.

A saída definitiva do cartão depende das respostas do time de API (e-mail
enviado 01/09): recuperabilidade do `creditCardToken`, momento do débito em
avulsa, liberação de tokenização, **Pix Automático via API**, unicidade de
`externalReference`. Pix Automático pode tirar o cartão do papel de único meio
automático.

⚠️ Se o token entrar no Supabase: sob RLS, nunca exposto a view acessível pela
anon key. Precedente: incidente de 22/08.

---

## Infraestrutura (decidido pós-Fase 0)

- **Server-side roda nas functions Vercel do portal**, padrão já existente do
  `/api/asaas/vincular` (service_role no portal; backoffice chama com JWT
  admin). **Não abrir `api/` no backoffice** — evita um segundo lugar com
  service_role para manter.
- **Cron:** Vercel plano Hobby, execução diária. O job roda todo dia e só age
  quando `hoje == 26`. Horário impreciso no Hobby — o alerta de ausência e o
  botão manual cobrem.
- **Chave sandbox:** `ASAAS_API_KEY_SANDBOX` no env da Vercel do portal.
- **Banco:** sem pg_cron/pg_net — nada de agendamento no Postgres.
- Colunas reais: a constraint de idempotência é
  `faturas_subscription_id_periodo_referencia_key` sobre `periodo_referencia`
  (formato `AAAA-MM`, com CHECK). Reusar `asaas_invoice_url` existente; criar só
  `linha_digitavel` e `pix_payload`.

---

## Contenção

O risco real é **falhar em silêncio** — ou cobrar duas vezes.

**1. Idempotência local, não do Asaas.** `externalReference` é campo livre; a
garantia é a unique constraint em `faturas (subscription_id,
periodo_referencia)`, com insert **antes** da chamada à API. Falhou o insert,
não chama.

**2. Conciliação por conjunto, não por contagem.** Conjunto de
`subscription_id` esperado vs criado, e soma dos valores vs prévia. Antes de
gerar: **zero cobranças antigas do período em aberto** no Asaas.

**3. Alerta de ausência.** Prévia não montada até hora definida do dia 26 →
aviso ao Hugo.

**4. Botão manual como plano B.** Mesma tela da conferência.

**Conferência humana sempre:** o job monta a prévia, o Hugo confere e dispara.

---

## Portal: tela "Pagamentos"

Na geração, gravar em `faturas`: `asaas_invoice_url`, `linha_digitavel` e
`pix_payload`. O portal lê por RLS e mostra mês, valor, detalhe e os três
jeitos de pagar — sem chamada ao Asaas pelo portal. Recupera o boleto
registrado que o e-mail do Asaas levava.

---

## Régua de comunicação

**O e-mail da cobrança é o próprio extrato** (mensalidade + detalhe dos extras +
linha digitável + Pix + link). A régua: cobrança-extrato (dia 28), lembrete 3
dias antes (dia 5), aviso D+1, segundo aviso D+4, pausa D+7, pagamento
confirmado (webhook).

**Notificações do Asaas:** desligadas para o assinante quando a régua estiver de
pé (já desligadas para 19 desde 29/08). Para o Hugo: manter ligadas se
separáveis no painel; senão, o aviso de pagamento vem da régua e vira
dependência crítica.

---

## Ordem de construção

1. **Schema** — 6 statements a partir da 0038: enum + `pause_reason`,
   `origem_aquisicao`, `linha_digitavel`, `pix_payload`, enum +
   `forma_pagamento`
2. **Prévia** (montagem + tela de conferência no backoffice)
3. **Geração por API** (functions do portal, sandbox)
4. **Conciliação + pré-check**
5. **Script de exclusão das cobranças antigas de outubro** (dry-run; execução
   só após pagamentos de setembro, com o Hugo)
6. **Captura de `?origem=` no portal** (PR separado; sem campo visível —
   programa de indicação é estudo futuro, ClickUp 86e34ge73)

Depois de outubro no ar: e-mails de webhook, lembretes, régua de atraso, tela
Pagamentos, extrato/D4/boas-vindas.

---

## Transição: outubro como alvo, sem folga no calendário

Setembro fecha limpo: quintas 3, 10, 17 e 24.

| Data | O quê |
|---|---|
| ~08/09 | Pagamentos de setembro confirmados → cancelar as recorrências de boleto/Pix e excluir as cobranças de outubro já geradas por elas |
| 10–15/09 | Comunicar a base: vencimento muda de 3 para 8, vira uma cobrança só |
| 06–07/09 | Dev: fases 1–2 |
| 13–14/09 | Dev: fases 3–4 |
| 20–21/09 | Dev: fase 5 + teste ponta a ponta (**era folga; não é mais**) |
| **21/09** | **Go/no-go**: ciclo completo em sandbox — prévia → geração → conciliação passando → dry-run da exclusão. Faltou qualquer um → **novembro, sem drama** |
| 24/09 | Fecha a leitura de setembro |
| 26/09 | Prévia · conferência · geração |
| 08/10 | Vencimento da primeira cobrança única |

Limite duro: com antecedência de 14 dias, o Asaas geraria novembro por volta de
20/10 — recorrências canceladas bem antes (o marco de 08/09 resolve).

**Status real (Fase 0 do CC):** construído até aqui, **nada** da geração. Existe
a constraint (da mig 0027, feita para o webhook), `asaas_payment_id` (unique) e
`asaas_invoice_url`. `faturas` tem 0 linhas. Não há chamada de saída ao Asaas em
nenhum repo. A v2 registrava prévia e geração como "construídas e testadas em
sandbox" — estava errado.

---

## Caso Sabina — resolvido pelo modelo novo

Um CPF, um cartão, um login, duas entregas. No modelo novo: duas linhas na
prévia, duas cobranças avulsas no mesmo cliente Asaas, diferenciadas pela
descrição. Como é cartão, fica na transição com os demais, mantendo duas
cobranças até lá. Pendência de portal independente: `useSubscription` não
comporta duas assinaturas no mesmo login.

---

## Pendências

| Pergunta | Para quem | Status |
|---|---|---|
| Token dos cartões recuperável? Débito na criação ou dueDate? Tokenização precisa liberação? Pix Automático via API? `externalReference` tem unicidade? | time de API Asaas | e-mail enviado 01/09, aguardando |
| Antecedência 14 dias — efeito nas cobranças out/nov já geradas | Luana | pedido feito |
| Notificação do Hugo separável da do cliente | painel Asaas | verificar |
| `forma_pagamento` das 40 ativas | Hugo (painel Asaas) | após migration da Fase 1 |
| ~~Migration 0036 não aplicada; STATUS errado sobre a 0037~~ | fila do backoffice | **resolvido 04/09** — as duas ESTÃO aplicadas. Conferido no banco: `ingredientes_receita.etapa` existe (a coluna é `etapa`, não `etapa_id` — foi o probe pelo nome errado que deu o falso negativo) com a UNIQUE `(versao_receita_id, ingrediente_id, etapa)`, e `peso_farinha_por_pao()` já filtra pelas etapas de massa. STATUS corrigido no PR #82 |
