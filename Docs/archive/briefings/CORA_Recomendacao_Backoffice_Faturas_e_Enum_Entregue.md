# Recomendação de schema — cora-backoffice
## Duas mudanças que destravam histórico financeiro e histórico de entregas no Portal

**Contexto:** durante a Frente C item 4 (redesign read-only da tela Perfil do Portal), o Claude Code do Portal mapeou duas lacunas de schema que impedem o Portal de mostrar dados reais ao assinante. Ambas exigem mudanças no `cora-backoffice` (regra de governança: schema vive aqui, nunca no Portal).

Este documento é a fonte primária para uma sessão futura com Claude Code no repo `cora-backoffice`.

---

## 1. Tabela `faturas` (mais prioritária)

### Problema
O Portal não tem como mostrar:
- Sub-linha "Cobrança de [mês] · R$ X · Pago" no bloco Cobrança da tela Perfil
- Footnote "Cobrança paga em DD/MM" no Modal de Recibo
- Histórico financeiro futuro do assinante (qualquer tela que precise ler "o que foi cobrado, quando, com sucesso?")

Billing real vive só no Asaas (externo). O Portal não persiste nada de cobrança hoje.

**Estado atual no MVP da tela Perfil:** sub-linha e footnotes financeiros estão **omitidos**. Quando esta tabela existir, ambos voltam.

### Decisão de design
Persistir uma linha por ciclo de cobrança em uma tabela `faturas` no Postgres, espelhando o estado real do Asaas. A fonte da verdade continua sendo o Asaas; esta tabela é uma materialização local para queries rápidas no Portal e no Backoffice.

### Schema proposto

```sql
-- Enum de status
create type fatura_status_enum as enum (
  'pendente',     -- gerada, aguardando pagamento
  'paga',         -- confirmada pelo Asaas
  'falha',        -- tentativa recusada (cartão expirado, sem saldo, etc.)
  'cancelada'     -- estornada ou anulada manualmente
);

-- Tabela
create table faturas (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id),

  -- Período de referência (sempre mês/ano, dia 01 a último dia)
  periodo_referencia text not null,   -- formato 'YYYY-MM' (ex: '2026-05')

  -- Decomposição (em reais, mesma convenção das outras tabelas: numeric, não centavos)
  valor_paes numeric(10,2) not null,
  valor_extras numeric(10,2) not null default 0,
  valor_frete numeric(10,2) not null default 0,
  valor_total numeric(10,2) not null,

  -- Estado da cobrança
  status fatura_status_enum not null default 'pendente',
  paid_at timestamptz,                -- preenchido quando status = 'paga'

  -- Referência externa
  asaas_payment_id text,              -- id da cobrança no Asaas (idempotência + reconciliação)
  asaas_invoice_url text,             -- link público pro recibo Asaas, se útil

  -- Auditoria
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Garantias
  unique (subscription_id, periodo_referencia)
);

create index faturas_subscription_id_idx on faturas(subscription_id);
create index faturas_status_idx on faturas(status);
create index faturas_paid_at_idx on faturas(paid_at) where status = 'paga';
```

### Mecânica de transição (decisão pendente, propor opções na sessão)
**Como uma linha vira `'paga'`?** Três opções:

- **(a)** Webhook do Asaas → endpoint no Backoffice atualiza a fatura quando recebe `PAYMENT_CONFIRMED`. Mais real-time, mais robusto, mas exige config no Asaas + endpoint público no Backoffice + lidar com retries.
- **(b)** Job manual rodando 1x/dia que lê o Asaas via API e reconcilia (`status` + `paid_at`). Mais simples, suficiente pro MVP.
- **(c)** Marcação manual no Backoffice (botão "Marcar como paga" na lista de faturas). Mais frágil, mas mínimo viável.

Recomendação inicial: começar com **(c)** + **(b)** como upgrade quando o volume justificar. Decidir na sessão.

### Geração das faturas (decisão pendente)
A cobrança recorrente é gerada pelo Asaas todo dia 01. Quem cria a linha em `faturas`?

- **(a)** Hugo cria manualmente no Backoffice (botão "Gerar faturas do mês") — viável até ~50 subs.
- **(b)** Job mensal automático que cria uma linha para cada subscription ativa no dia 01.
- **(c)** Webhook do Asaas dispara criação no momento que ele gera a cobrança.

Mesma lógica: começar simples, automatizar quando justificar.

### Impacto no Portal
Quando esta tabela existir, o Portal vai precisar de:
1. **GET `/api/faturas?subscription_id=xxx&limit=12`** — últimas faturas, ordenado por `periodo_referencia desc`. Usado para sub-linha do bloco Cobrança ("Cobrança de [mês] · R$ X · Pago") e para footnote do Modal de Recibo ("Cobrança paga em DD/MM").

**Não é deste documento implementar esse endpoint** — só o schema é responsabilidade do Backoffice. O endpoint vive no Portal e é parte de uma task futura.

---

## 2. Adicionar valor `'entregue'` ao enum `weekly_order_status`

### Problema
Hoje `weekly_order_status` só tem `'rascunho'` e `'confirmado'` (migration `0003_weekly_orders.sql` no Portal). O Portal precisa distinguir "entrega cumprida" para mostrar o histórico ao assinante na tela Perfil.

**Solução temporária no MVP:** o Portal infere "entregue" por `delivery_date < hoje && status='confirmado'`. Aresta conhecida: se uma entrega for cancelada sem mudança de status, aparece como "entregue" indevidamente.

**Solução definitiva:** adicionar o valor `'entregue'` ao enum e criar mecânica de transição.

### Schema proposto

```sql
-- Adicionar novo valor ao enum existente
alter type weekly_order_status add value 'entregue' after 'confirmado';

-- Opcional, mas recomendado: timestamp de quando virou entregue
alter table weekly_orders add column delivered_at timestamptz;

-- Index para queries de histórico do assinante
create index weekly_orders_delivered_idx
  on weekly_orders(subscription_id, delivered_at desc)
  where status = 'entregue';
```

### Mecânica de transição
Como `'confirmado'` vira `'entregue'`?

- **(a)** Botão "Marcar entregues" na UI de Produção do Backoffice (etapa Expedição), que faz UPDATE em batch nas entregas do dia. Hugo clica após terminar a expedição.
- **(b)** Cron simples rodando 1x/dia depois das 22h marcando `'confirmado' → 'entregue'` para todas as entregas onde `delivery_date = hoje`.
- **(c)** Botão linha-a-linha na lista de pedidos do dia.

Recomendação: **(a)** é a mais natural porque conversa com o fluxo real do Hugo. Ele termina a expedição, abre o Backoffice, clica uma vez no dia. Implementação simples, controle explícito.

### Impacto no Portal (após esta mudança)
O Portal vai migrar de:

```js
// hoje
.where('delivery_date', '<', hoje)
.where('status', '=', 'confirmado')
```

Para:

```js
// depois
.where('status', '=', 'entregue')
.order('delivered_at', 'desc')
```

E o GET `/api/weekly-orders?history=true` ganha precisão real.

---

## Prioridade sugerida

1. **Enum `'entregue'`** primeiro. Mudança pequena, alto valor (corrige a aresta de "entregue derivado" que vai pra produção no MVP), e a mecânica (a) se encaixa naturalmente em uma UI de Produção que provavelmente já está sendo desenhada.
2. **Tabela `faturas`** segundo. Maior em escopo (schema + mecânica + endpoint no Portal depois), mas destrava informação financeira real para o assinante e abre caminho pra dashboards no Backoffice.

Ambas devem entrar antes do **lançamento oficial em agosto/2026**. A primeira é mais urgente porque o histórico de entregas é central na narrativa "isso é real, funciona, eu posso confiar" — fake aí ofende. A segunda pode entrar nas semanas seguintes ao Alpha, conforme os primeiros assinantes interagem com a Cobrança e o Modal de Recibo.

---

## Critérios de aceite para a sessão futura

| | Requisito |
|---|---|
| ✓ | Migration aplicada via `supabase db push` no repo `cora-backoffice` |
| ✓ | Nomes em pt-BR snake_case (convenção de Fase 1+) |
| ✓ | Timestamps com sufixo `_at` em inglês (convenção) |
| ✓ | Decimal usado para dinheiro (não centavos) |
| ✓ | Enum sufixo `_enum` (convenção) |
| ✓ | Mecânica de transição decidida e documentada (com ou sem UI já implementada) |
| ✓ | Documento de impacto no Portal atualizado neste mesmo arquivo |

---

## Tasks ClickUp sugeridas

- `Backoffice — Schema faturas` (Lista: Infra & Compras ou nova "Backoffice & Schema")
- `Backoffice — Enum weekly_order_status entregue + mecânica Expedição`
- `Portal — GET /api/faturas` (depende da primeira)
- `Portal — Migrar GET ?history=true para filtrar por status='entregue'` (depende da segunda)
