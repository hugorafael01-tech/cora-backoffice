# Briefing técnico — Backoffice: tabela `faturas` + enum `'entregue'`
## Duas mudanças de schema que destravam o Portal

**Data:** 2026-05-20
**Repo:** `cora-backoffice`
**Documento-fonte (schema fechado):** `CORA_Recomendacao_Backoffice_Faturas_e_Enum_Entregue.md`
**Sessão upstream:** Frente C item 4 do Portal (tela Perfil read-only, fechada em 2026-05-20)
**Branch sugerida:** `feat/faturas-e-enum-entregue`

---

## Contexto de negócio (curto)

Cora é padaria por assinatura. Padeiro solo (Hugo). Alpha em julho/2026 com até 30 assinantes, lançamento oficial em agosto/2026. Pagamento via Asaas (assinatura recorrente em cartão de crédito).

Esta sessão fecha duas dívidas de schema que o Portal não consegue resolver sozinho (governança: schema vive aqui, não no Portal).

**Estado atual (relevante para entender o porquê das mudanças):**

- Tela Perfil do Portal hoje tem dois "buracos" no MVP — sub-linha "Cobrança de [mês] · Pago" e footnote "paga em DD/MM" — ambos omitidos até `faturas` existir.
- Histórico de entregas no Portal infere "entregue" por `delivery_date < hoje && status='confirmado'`. Aresta conhecida: entrega cancelada sem mudança de status aparece como entregue. Esta sessão fecha a aresta adicionando `'entregue'` ao enum.

Esta sessão não toca em código do Portal. A migração wire-to-real (GET `/api/faturas` e mudança do filtro de histórico) é tarefa separada, em outra sessão, depois deste merge.

---

## Convenções confirmadas (Fase 1+ do Backoffice)

- pt-BR snake_case em tabelas e colunas novas (`faturas`, `periodo_referencia`).
- Sufixo `_at` em inglês para timestamps (`paid_at`, `delivered_at`, `created_at`, `updated_at`).
- Enum com sufixo `_enum` (`fatura_status_enum`).
- Decimal para dinheiro (`numeric(10,2)`), não centavos.
- Migrations via `supabase db push`. Migrations nomeadas seguindo a sequência existente no diretório `supabase/migrations/`.
- Commits ASCII (sem acento).
- Os snippets SQL do documento-fonte são a referência. Não inventar campos novos sem confirmar com Hugo.

---

## Escopo desta sessão

Duas mudanças **independentes** entre si. Implementar em ordem (a primeira é mais simples e destrava mais cedo):

1. **Enum `weekly_order_status` ganha `'entregue'`** + coluna `delivered_at` + index parcial.
2. **Tabela `faturas`** + handler de webhook Asaas para 4 eventos.

---

## Mudança 1 — enum `'entregue'` (prioridade alta, mais simples)

### Schema (cópia fiel do documento-fonte)

```sql
alter type weekly_order_status add value 'entregue' after 'confirmado';

alter table weekly_orders add column delivered_at timestamptz;

create index weekly_orders_delivered_idx
  on weekly_orders(subscription_id, delivered_at desc)
  where status = 'entregue';
```

### Mecânica de transição (decidida)

**Até julho/2026 (pré-Alpha e Alpha inicial):** Hugo marca `'entregue'` via SQL direto no Supabase após cada quinta de entrega. Trabalho aceitável para ~10-30 assinantes. Esta sessão **não** precisa entregar UI nenhuma.

**A partir do Alpha consolidado (julho/2026, sessão futura):** página minimalista `/expedicao/hoje` no Backoffice:
- Lista entregas onde `delivery_date = hoje && status = 'confirmado'`
- Checkbox por linha (todas marcadas por padrão; Hugo destaca exceções)
- Botão "Marcar como entregues" → UPDATE em batch (`status = 'entregue'`, `delivered_at = now()`)
- Sem undo no MVP; erro corrige via SQL.

### Por que batch e não cron

Cron com `delivery_date = hoje && status='confirmado' → 'entregue'` reproduz exatamente a imprecisão que esta migration deveria fechar: marca como entregue mesmo se a entrega falhou. Batch dá controle explícito ao Hugo de confirmar fisicamente o que saiu. A UI vem depois; SQL no meio-tempo.

### Contexto sobre tabela órfã (importante)

`weekly_orders` é uma das três tabelas órfãs do Portal (existe no DB mas não está em `schema_migrations`). Decisão tomada (Caminho A): aceitar a dívida, adicionar `'entregue'` ao enum existente, **não evoluir mais essa tabela**. Qualquer feature nova de expedição (lote, rota, motorista, janela) vai em tabelas novas em pt-BR no Backoffice.

CC: não tentar reparar a órfã, não criar tabela espelho `pedidos_semanais`, não migrar dados. Patch mínimo no enum + coluna + index, nada mais.

### Critérios de aceite

| | Requisito |
|---|---|
| ✓ | Migration nomeada na sequência existente, aplicada via `supabase db push` |
| ✓ | `'entregue'` é valor válido do enum (verificar via `\dT+ weekly_order_status` ou query equivalente) |
| ✓ | Coluna `delivered_at timestamptz` aceita NULL |
| ✓ | Index parcial criado (só para `status='entregue'`) |
| ✓ | Sem código de aplicação. Sem UI. |

---

## Mudança 2 — tabela `faturas` + webhook Asaas

### Schema (cópia fiel do documento-fonte)

```sql
create type fatura_status_enum as enum (
  'pendente',
  'paga',
  'falha',
  'cancelada'
);

create table faturas (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id),
  periodo_referencia text not null,        -- formato 'YYYY-MM'
  valor_paes numeric(10,2) not null,
  valor_extras numeric(10,2) not null default 0,
  valor_frete numeric(10,2) not null default 0,
  valor_total numeric(10,2) not null,
  status fatura_status_enum not null default 'pendente',
  paid_at timestamptz,
  asaas_payment_id text,
  asaas_invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, periodo_referencia)
);

create index faturas_subscription_id_idx on faturas(subscription_id);
create index faturas_status_idx on faturas(status);
create index faturas_paid_at_idx on faturas(paid_at) where status = 'paga';
```

### Mecânica de transição (decidida)

Tanto **criação da linha (D2)** quanto **transição para `'paga'` (D1)** acontecem via webhook Asaas. Mesmo endpoint, mesmo handler, lógica branchada por tipo de evento.

### Endpoint do webhook

- Rota pública no Backoffice (sem auth Supabase). **Exceção arquitetural confirmada** com Hugo: as outras rotas usam magic link Supabase; esta usa validação de token Asaas.
- Validação via cabeçalho `asaas-access-token` (formato `whsec_...`). Token configurado no Asaas (painel ou API) e armazenado como env var no Vercel do Backoffice.
- Idempotência por `asaas_payment_id`. Asaas faz retry automático em falha — handler precisa ser idempotente (UPSERT, não INSERT cego).
- Parsing tolerante a campos novos no payload. Asaas adiciona atributos sem aviso prévio; parsing rígido (Zod `.strict()` ou similar) quebraria o pipeline.

### Eventos escutados no MVP

| Evento Asaas | Ação no handler |
|---|---|
| `PAYMENT_CREATED` | `INSERT ... ON CONFLICT (asaas_payment_id) DO NOTHING` — cria linha em `faturas` com `status='pendente'`. Resolver `payment.subscription` (id Asaas) para `subscription_id` local. |
| `PAYMENT_CONFIRMED` | UPDATE — `status='paga'`, `paid_at = payment.confirmedDate ?? now()` |
| `PAYMENT_OVERDUE` | UPDATE — `status='falha'` |
| `PAYMENT_DELETED` | UPDATE — `status='cancelada'` |

**Outros eventos** (`PAYMENT_RECEIVED`, `PAYMENT_UPDATED`, análises de risco, captura de cartão, chargebacks, refunds, etc.): endpoint responde 200 e ignora. Sem erro. Sem log de erro. Apenas log info "evento ignorado: X".

### Decisão sutil 1 — `PAYMENT_CONFIRMED` vs `PAYMENT_RECEIVED`

Asaas dispara os dois em momentos diferentes:
- `PAYMENT_CONFIRMED` — pagamento efetuado, saldo ainda não disponibilizado na conta Asaas
- `PAYMENT_RECEIVED` — saldo liquidado

Para o assinante no Portal, o que importa é que o pagamento foi processado. `'paga'` é marcado em `PAYMENT_CONFIRMED`. A liquidação financeira é problema de tesouraria, não de UX do assinante.

Se no futuro Hugo quiser separar, adiciona valor `'recebida'` ao enum e escuta os dois eventos. Não fazer agora.

### Decisão sutil 2 — vinculação Asaas → local

O payload do webhook traz `payment.subscription` = id da assinatura no Asaas (formato `sub_...`). A tabela local `subscriptions` hoje **não tem** coluna para esse id.

**Proposta:** adicionar coluna `asaas_subscription_id text unique` em `subscriptions` (mesma migration da Mudança 2, antes do `create table faturas`).

```sql
alter table subscriptions add column asaas_subscription_id text;
create unique index subscriptions_asaas_id_idx on subscriptions(asaas_subscription_id) where asaas_subscription_id is not null;
```

O handler do webhook resolve `sub_xxx` → `subscription_id` local via essa coluna. Se não encontrar, loga erro e responde 200 (não derruba o fluxo do Asaas; Hugo investiga depois).

**CC: confirmar essa proposta antes de codar.** Alternativa seria deixar `subscription_id` da fatura como text apontando direto pro Asaas, mas isso quebra a FK e a convenção. Vamos com a coluna nova.

### Pendência relacionada (fora do escopo, contexto importante)

O Portal hoje cria `subscription` no banco mas **não cria assinatura no Asaas automaticamente**. Hugo manda link de cobrança avulsa no WhatsApp, e depois cria a assinatura no painel Asaas manualmente. A automação do `POST /v3/subscriptions` é tarefa futura no Portal.

Por ora, o fluxo manual é:
1. Assinante completa onboarding → `subscriptions` é INSERTado com status `pending_payment`.
2. Hugo manda link Asaas no WhatsApp → assinante paga.
3. Hugo cria assinatura no painel Asaas manualmente.
4. Hugo popula `asaas_subscription_id` na linha da `subscriptions` via SQL.
5. A partir daí, o webhook toma conta.

O webhook implementado nesta sessão precisa **tolerar** a ausência de `asaas_subscription_id` (loga warning, ignora evento, retorna 200). Não trata como erro fatal.

### Decisão sutil 3 — timing real de 40 dias antes

Comportamento confirmado na documentação Asaas:

> "Cobranças recorrentes pertencentes a uma assinatura são geradas 40 dias antes do vencimento (dueDate). Dessa forma, uma assinatura configurada para vencer 5 dias após sua criação, com vencimento mensal, já terá duas cobranças pertencentes a ela no sistema."

Implicações concretas para o handler:

1. **`periodo_referencia` representa o mês de vencimento**, não de criação. Derivar de `payment.dueDate` no payload (formato `YYYY-MM-DD` → extrair `YYYY-MM`), **não** de `now()`.
2. Linhas em `faturas` se acumulam por antecipação: ao criar assinatura no Asaas, o webhook recebe `PAYMENT_CREATED` para a primeira cobrança imediatamente e ~40 dias antes de cada próxima.
3. O Portal vai filtrar faturas por `periodo_referencia`, não por `created_at` ou `paid_at`. Não é problema desta sessão, mas garante a corretude do schema agora.

### Valores em `faturas` — origem dos dados

| Coluna | Origem |
|---|---|
| `valor_paes` | `subscriptions.valor_paes` no momento da criação da fatura |
| `valor_frete` | `subscriptions.valor_frete` no momento da criação (pode ser 0 se condomínio ativo) |
| `valor_extras` | 0 no MVP (extras não cobrados ainda via Asaas) |
| `valor_total` | `valor_paes + valor_extras + valor_frete` — confirmar contra `payment.value` do payload Asaas; se divergir, gravar o que vier do Asaas e logar warning |

A fatura é snapshot do momento da geração. Se Hugo mudar o plano do assinante depois, faturas antigas continuam com os valores antigos. Esperado.

### Configuração do webhook no Asaas

Fora do código, mas faz parte do delivery:

1. Sandbox: criar webhook via painel Asaas ou via API (`POST /v3/webhooks`), apontando para `https://admin.acora.com.br/api/webhooks/asaas`, com authToken `whsec_...` gerado.
2. Eventos selecionados: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`.
3. `sendType: SEQUENTIALLY` (ordem importa para idempotência de UPDATEs).
4. Env var no Vercel do Backoffice: `ASAAS_WEBHOOK_TOKEN=whsec_...`
5. Repetir para produção quando sandbox estiver validado.

### Critérios de aceite

| | Requisito |
|---|---|
| ✓ | Migration aplicada via `supabase db push` — `fatura_status_enum` + `faturas` + 3 indexes + coluna `asaas_subscription_id` em `subscriptions` |
| ✓ | Endpoint `/api/webhooks/asaas` recebe POST, valida `asaas-access-token`, retorna 200 sempre que parseou ok (mesmo se ignorou) |
| ✓ | Handler trata os 4 eventos do MVP; outros eventos respondem 200 silencioso |
| ✓ | Parsing tolerante a campos novos no payload (sem `.strict()`) |
| ✓ | UPSERT por `asaas_payment_id` em `PAYMENT_CREATED` — idempotente |
| ✓ | `periodo_referencia` derivado de `payment.dueDate`, formato `YYYY-MM` |
| ✓ | Webhook ausente de `asaas_subscription_id` correspondente: log warning, return 200 |
| ✓ | Webhook configurado no Asaas sandbox com authToken |
| ✓ | Teste e2e em sandbox: criar assinatura → confirmar webhook chegou e gerou linha em `faturas` → forçar confirmação → verificar `status='paga'` |
| ✓ | Teste de idempotência: replay manual do mesmo webhook não duplica linha nem corrompe estado |

---

## Ordem de implementação proposta

CC: apresentar plano detalhado antes de codar, confirmando essa ordem ou propondo alternativa.

| Fase | Conteúdo | Estimativa | Validação |
|---|---|---|---|
| 1 | Migration enum `'entregue'` + `delivered_at` + index | 15-30 min | Query no Supabase confirma enum + coluna + index |
| 2 | Migration `faturas` + enum + coluna em `subscriptions` | 30-45 min | Query no Supabase confirma estrutura |
| 3 | Endpoint `/api/webhooks/asaas` com validação + os 4 handlers + parsing tolerante + logs | 2-3 h | Testes locais com payloads-fixture |
| 4 | Config Asaas sandbox + teste e2e | 1 h | Cliente sandbox + assinatura sandbox + webhook real |
| 5 | Config Asaas produção (não disparar até primeiro assinante real) | 15 min | Webhook listado no painel prod, env var no Vercel prod |

**Fase 6 (fora desta sessão)**: página `/expedicao/hoje`. Não bloqueia merge. Hugo aguenta SQL direto até julho.

Sugestão: Fase 1 mergeia separada antes da Fase 2+ estar pronta, pra destravar o Portal de leitura mais cedo. CC confirma.

---

## Fora do escopo desta sessão

- GET `/api/faturas` no Portal (sessão separada, depois)
- Wire-to-real da tela Perfil (sessão separada)
- Automação do `POST /v3/subscriptions` no Asaas (continua manual)
- UI de listagem de faturas no Backoffice (backlog)
- Página `/expedicao/hoje` (backlog, julho)
- Espelhar `weekly_orders` em pt-BR (decisão Caminho A: não fazer)
- Tratar eventos `PAYMENT_RECEIVED`, `PAYMENT_UPDATED`, chargebacks, refunds (backlog)
- Notificação de inadimplência via WhatsApp (backlog)

---

## Decisões abertas pro CC propor no plano

Antes de codar, CC apresenta plano que responda a:

1. **Estrutura das migrations** — uma para Mudança 1, outra para Mudança 2 (separadas)? Recomendação: separar, permite merge incremental.
2. **Vinculação Asaas → local** — confirmar Opção A (`asaas_subscription_id` em `subscriptions`) ou propor alternativa.
3. **Stack do endpoint** — Vercel Functions, runtime, framework. Aplicar lições do Portal: `await` em chamadas externas (sem fire-and-forget), try/catch global, retorno rápido.
4. **Validação HMAC** — middleware vs in-handler. Seguir o padrão já existente no repo do Backoffice.
5. **Estratégia de logs** — onde Hugo inspeciona webhook que falhou (Supabase logs? Vercel logs? Sentry?). Mínimo viável: logs estruturados em Vercel com `event_type`, `asaas_payment_id`, `subscription_id`, resultado.
6. **Fixtures de teste** — propor 4-5 payloads representativos (assinatura nova, confirmação, atraso, deleção, ausência de subscription) para teste local antes do sandbox real.

---

## Referências

- **Schema fonte:** `CORA_Recomendacao_Backoffice_Faturas_e_Enum_Entregue.md`
- **Documentação Asaas:**
  - Webhook para cobranças: https://docs.asaas.com/docs/webhook-para-cobrancas
  - Criando uma assinatura: https://docs.asaas.com/docs/criando-uma-assinatura
  - Timing 40 dias antes: https://docs.asaas.com/docs/assinaturas
  - Criar webhook via API: https://docs.asaas.com/docs/criar-novo-webhook-pela-api
- **Convenções de schema Fase 1+:** `CORA_Briefing_Backoffice_Fase1_Schema_v3.md` (no próprio repo)
- **Briefing upstream do Portal:** `CORA_Briefing_Frente_C_Item4_PerfilReadonly_v2.md`

---

## Padrões de execução (aplicar sem exceção)

- Commits ASCII (sem acento)
- Smoke test em Preview deployment antes de merge
- Squash merge via PR no fim
- Branch sugerida: `feat/faturas-e-enum-entregue`
- Sem código gerado em qualquer escopo do Portal — esta sessão é Backoffice-only

