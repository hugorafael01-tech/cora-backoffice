# Briefing — Migration 0027: tabela `faturas`

Repo: `cora-backoffice`
Tipo: migration de schema (expand-only, tabela nova). Sem UI. Sem código de aplicação.
Decisão de origem: sessão de 15/06/2026 (Claude Chat). Supersede a seção 1 do doc `CORA_Recomendacao_Backoffice_Faturas_e_Enum_Entregue.md`.

## Contexto

A `faturas` materializa localmente o histórico de cobranças **pagas**, pra o Portal mostrar "Cobrança de [mês] · R$ X · pago" e pra dashboards no backoffice. A fonte da verdade do total continua sendo o Asaas; esta tabela é cópia local pra leitura rápida.

A seção 2 do doc de recomendação (adicionar `'entregue'` a `weekly_order_status`) está OBSOLETA: a tabela `entregas` (migration 0026) já carrega o status de entrega (`pendente`/`em_rota`/`entregue` + `entregue_at`). Não tocar nisso. Esta migration é só a `faturas`.

## Decisões fechadas (não redesenhar)

1. **Fase 1 é pago-only, dirigido por webhook.** A fatura nasce já `'paga'` quando o webhook do Asaas (que vive no **Portal**, fora deste repo) confirma o pagamento. Não há geração antecipada de `'pendente'` no fase 1. Pendente/vencido o Hugo vê no Asaas e no painel Financeiro (nível subscription). O enum guarda os outros estados pro futuro, mas o fase 1 só usa `'paga'`.

2. **Total real do Asaas + snapshot da base.** `valor_total` é o valor real cobrado (Asaas, a verdade). `valor_paes` (= 99 × qty) e `valor_frete` (= 15) são snapshot da base no momento da materialização, pra conferência. Os **extras NÃO viram coluna**: são derivados na leitura como `valor_total - valor_paes - valor_frete`.

3. **Sem CHECK aritmético amarrando `valor_total = valor_paes + valor_frete`.** Eles divergem de propósito (extras avulsos e cobrança proporcional em upgrade no meio do ciclo). O total é verdade independente da base. NÃO adicionar esse CHECK.

## DDL proposto (0027_faturas.sql)

```sql
create type fatura_status_enum as enum ('pendente', 'paga', 'falha', 'cancelada');

create table faturas (
  id                 uuid primary key default gen_random_uuid(),
  subscription_id    uuid not null references subscriptions(id),

  periodo_referencia text not null check (periodo_referencia ~ '^\d{4}-\d{2}$'),  -- 'YYYY-MM'

  -- Snapshot da base no momento da materializacao (deterministico do plano)
  qty_paes           integer not null check (qty_paes >= 0),
  valor_paes         numeric(10,2) not null check (valor_paes >= 0),   -- 99 x qty_paes (congela o preco vigente)
  valor_frete        numeric(10,2) not null check (valor_frete >= 0),  -- 15

  -- Total real cobrado (Asaas). extras = valor_total - valor_paes - valor_frete (derivado na leitura)
  valor_total        numeric(10,2) not null check (valor_total >= 0),

  status             fatura_status_enum not null default 'pendente',
  paid_at            timestamptz,

  asaas_payment_id   text unique,   -- idempotencia do webhook + reconciliacao
  asaas_invoice_url  text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (subscription_id, periodo_referencia)
);

create index faturas_subscription_id_idx on faturas(subscription_id);
create index faturas_status_idx on faturas(status);
create index faturas_paid_at_idx on faturas(paid_at) where status = 'paga';

create trigger faturas_set_updated_at
  before update on faturas
  for each row execute function set_updated_at();
```

Notas de implementação:
- `set_updated_at()` já existe (0012). Confirmar o nome exato no DDL antes de assumir.
- `gen_random_uuid()`, padrão das outras tabelas. Manter.
- `asaas_payment_id text unique`: nullable + unique. No Postgres múltiplos NULL convivem, então faturas sem id de Asaas ainda coexistem, e duplicar evento do mesmo pagamento é barrado. É o alvo idempotente do webhook.

## RLS (espelhar a `asaas_webhook_events` da 0020)

A postura da `asaas_webhook_events` (migration 0020) é exatamente a que a `faturas` precisa. Replicar:
- `authenticated` com `is_admin()`: SELECT (o painel Financeiro lê via client autenticado de admin).
- escrita: apenas `service_role` (o webhook do Portal grava; o client nunca escreve, postura pós-0019).
- `anon`: nada (revoke).
- **Sem** policy de SELECT-own pro assinante. No fase 1 o Portal lê faturas via endpoint server (service_role), não direto do client. Se um dia quisermos leitura client-side do assinante, adiciona-se uma policy select-own depois (expand). Não criar agora.

Ler a 0020 e seguir o mesmo padrão de `enable row level security` + policy `is_admin()` + grants/revokes. Não inventar mecânica de grant nova.

## Verificação (0027_faturas.verificacao.sql, padrão 0025/0026)

Probes PRE e POS, uma query por vez (SQL Editor trunca múltiplos SELECT):
- PRE: `faturas` não existe; `fatura_status_enum` não existe.
- POS: tabela existe com as colunas e tipos esperados; enum existe com os 4 valores; a UNIQUE `(subscription_id, periodo_referencia)` e a UNIQUE de `asaas_payment_id` existem; índices criados; RLS habilitada com a policy de admin; trigger de updated_at presente.

## Fora de escopo (PARE se for tentado)

- Qualquer código de aplicação: webhook, endpoint, UI. Esta migration é só schema.
- Tocar em `subscriptions`, `entregas`, `weekly_orders`, `asaas_webhook_events` ou qualquer tabela existente.
- Backfill de faturas históricas.
- Adicionar `'entregue'` a `weekly_order_status` (obsoleto, ver contexto).
- Coluna de extras (decisão: derivado na leitura, não persistido).

## Aplicação

Você cria o arquivo `0027_faturas.sql` + o `0027_faturas.verificacao.sql`, mas **NÃO aplica**. Quem aplica é o Hugo (via `supabase db push` se o histórico local bater com o remoto, senão colando no SQL Editor, conforme as lições do BACKOFFICE_STATUS.md). Depois de aplicada e os probes POS conferidos, commit do arquivo de migration. Atualizar o BACKOFFICE_STATUS.md com a entrada da 0027.

## Pare e pergunte (além do template)

1. Se `set_updated_at()` ou `is_admin()` não existirem com esses nomes no schema atual.
2. Se a 0020 usar um padrão de RLS diferente do descrito aqui (seguir o que estiver na 0020, e me avisar da diferença).
3. Se o `db push` não enxergar a migration como pendente (desync local/remoto), seguir o caminho do SQL Editor e avisar.

## Dependências downstream (NÃO nesta sessão, só pra registro)

- **Portal:** estender o webhook do Asaas pra materializar a fatura `'paga'` ao confirmar pagamento. Aqui mora a única incógnita real: de onde sai o `qty_paes` no momento da cobrança (coluna legada `total_paes` vs as novas `qty_*`, que o cutover D.2-D.4 ainda não populou). Resolver quando essa task do Portal for desenhada.
- **Portal:** `GET /api/faturas?subscription_id=...` (endpoint server, service_role) pro Perfil.
- **Backoffice:** painel Financeiro pode ganhar uma conferência por fatura (paes + frete + extras derivado vs total), se útil.
