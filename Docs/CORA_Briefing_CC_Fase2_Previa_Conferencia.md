# Briefing CC — Fase 2: Prévia + tela de conferência

**Set/2026** · Continuação do briefing "Geração de cobranças". Arquitetura:
`docs/CORA_Plano_Cobranca_Unica_v2_1.md`. Fase 1 (schema 0038–0043) **aplicada e
mergeada** (PR #82). Go/no-go: **21/09**.

## Regras da sessão (invariáveis)

- Ler `BACKOFFICE_STATUS.md` e `PORTAL_STATUS.md` antes de qualquer código.
- Feature branch; squash merge via UI pelo Hugo; commits ASCII sem acentos.
- Schema só no `cora-backoffice`; migrations um statement por arquivo, quem
  aplica é o Hugo (exceto a Tarefa 0 abaixo, que já está aplicada).
- Reportar plano de arquivos antes de codar cada bloco; parar no fim da fase.

---

## TAREFA 0 — Dívidas de registro (antes de tudo)

O banco está **uma migration à frente do repo**. Em 04/09, fora de sessão:

1. **Migration 0044 aplicada direto no banco** — criar o arquivo
   `0044_forma_pagamento_boleto_pix.sql` com o statement exato:
   `ALTER TYPE forma_pagamento_enum ADD VALUE 'boleto_pix';`
   + verificação PRE/POS no padrão das irmãs. Cabeçalho deve registrar: aplicada
   em 04/09 antes de o arquivo existir, racional abaixo.
   **Racional do valor novo:** o export do Asaas mostrou que 25 das 40 ativas
   são "Pergunte ao cliente" (billingType UNDEFINED — o assinante escolhe boleto
   ou Pix a cada pagamento, e alterna). Não é 'boleto' nem 'pix'; forçar seria
   gravar mentira. `boleto_pix` = cobrança que aceita os dois.
2. **Atualizar o STATUS:** 0038–0044 aplicadas (04/09); `forma_pagamento`
   preenchida nas 40 (0 null); tabela de migrations e "em voo".

## A base, preenchida e verificada (04/09)

| forma_pagamento | qtde | quem entra na cobrança única |
|---|---|---|
| cartao | 13 | **NÃO** — ficam na recorrência do Asaas na transição |
| boleto | 2 | sim |
| boleto_pix | 25 | sim |
| null | 0 | — |

**Filtro da prévia: `forma_pagamento != 'cartao'`** (27 assinantes). NUNCA
`IN ('boleto','pix')`. Se aparecer ativa com `forma_pagamento IS NULL` (novo
assinante não conferido), a prévia **mostra a linha com alerta em voz alta** —
jamais filtra calada.

---

## O que construir

### 2a. Montagem da prévia

Função (onde ela vive — client-side no backoffice via RLS admin, ou function no
portal — é decisão sua a propor na Fase 0 desta sessão, com trade-off; a
geração da Fase 3 vai rodar no portal, padrão `/api/asaas/vincular`).

Entrada: `periodo_referencia` (AAAA-MM). Saída, por assinante com
`forma_pagamento != 'cartao'`:

- **Mensalidade** do mês de referência: `valor_mensal` vigente, com a regra de
  vigência de 29/08 (redução só vale na renovação — se houver
  `next_billing_change_date`/`next_billing_value` aplicável, é ele que vale).
- **Extras do ciclo encerrado:** consumo entregue nas quintas do ciclo — da
  primeira quinta APÓS o corte anterior até a **última quinta ≤ dia 25** do mês
  anterior ao de referência. Mapear a fonte real no schema (pedidos
  pontuais/entregas — investigar e reportar qual tabela é a verdade antes de
  codar).
- **Ajuste proporcional** de aumento no meio do mês anterior, se houver.
- **Entrada nova:** primeira cobrança proporcional por quintas restantes ÷
  quintas do mês (mensalidade e frete).
- Total por assinante, forma de pagamento, e total geral.

### 2b. Tela de conferência (backoffice)

- Rota nova no backoffice, admin-only, seguindo o padrão visual das telas
  existentes.
- Seletor de período (default: próximo ciclo), lista da prévia, totais.
- **Alertas visíveis:** ativa com forma_pagamento null; assinante sem extras
  mapeáveis por inconsistência de dados; qualquer soma que não feche.
- Botão "Gerar cobranças" **presente e desabilitado** com nota "Fase 3" — o
  lugar dele é aqui, a ação ainda não existe.

---

## Casos nomeados (obrigatórios no teste)

1. **Aldina + Fernanda (pagador único).** Duas subscriptions no banco (CPFs
   76989771704 e 72067900706), ambas `boleto`, pagas pela Aldina — hoje uma
   assinatura única de R$ 228 no Asaas. Decisão recomendada (Hugo pode
   derrubar): **uma fatura por subscription**, duas cobranças no mesmo pagador
   com descrição clara — preserva a constraint `(subscription_id,
   periodo_referencia)` e o modelo. A prévia deve mostrar as duas linhas e o
   vínculo. NÃO redesenhar `faturas` por causa deste caso.
2. **Sabina + Maria Helena (mesmo CPF, cartão).** Fora da primeira leva (cartão),
   mas o filtro não pode quebrar com CPF duplicado.
3. **Outubro tem quinta 29.** Ciclo de outubro fecha na quinta 22; a entrega de
   29/10 cai no ciclo de novembro. Teste sintético obrigatório.
4. **Setembro real.** Quintas 3, 10, 17, 24 — todas dentro. A prévia de
   referência 2026-10 (mensalidade out + extras set) é o teste de aceitação:
   o Hugo confere contra os números que ele conhece.

## Fora de escopo (não desenvolver)

Geração real no Asaas, conciliação, cron do dia 26, script de exclusão das
antigas, e-mails/régua, tela Pagamentos do portal, qualquer coisa de cartão.

## Critério de pronto da fase

Prévia de 2026-10 montada com dados reais, conferida pelo Hugo linha a linha, e
teste sintético da quinta 29/10 passando. Tarefa 0 mergeada.
