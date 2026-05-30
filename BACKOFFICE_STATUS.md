# BACKOFFICE_STATUS

*Read first em toda sessão de Backoffice (CC, Claude Chat, ou qualquer instância). Atualizado ao fim de cada sessão.*

**Última atualização:** 30 de maio de 2026.

---

## Estado do repositório

- **Repositório:** `github.com/hugorafael01-tech/cora-backoffice`
- **Branch principal:** `main` (commit `f5daadd`)
- **Subdomain:** `admin.acora.com.br`
- **Stack:** Vite + React + TypeScript + Tailwind + Supabase Auth (magic link) + Vercel Functions
- **Banco:** Supabase Postgres — **mesmo projeto** compartilhado com Portal (sem staging isolado)

---

## Schema governance

**Regra dura:** mudanças de schema (migrations, colunas, enums, tabelas) acontecem **APENAS** neste repo via `supabase db push`. O repo do Portal nunca toca schema — Portal lê, Backoffice define.

**Convenções (Fase 1+):**
- Tabelas e colunas em pt-BR snake_case (ex: `semanas`, `pedidos_pontuais`, `janelas_entrega`)
- Timestamps com sufixo `_at` em inglês (`created_at`, `updated_at`, `cutoff_at`)
- Dates em pt-BR (`data_entrega`, `data_inicio`, `data_corte`)
- Money como `numeric`, não `_cents`
- Quantidades de ingredientes em gramas com sufixo `_g`
- `percentual_baker` decimal (0.85 = 85%)
- Enums com sufixo `_enum` (ex: `janela_status_enum`)

**Tabelas legacy (Portal-era, NÃO mexer):** `subscriptions`, `coverage_waitlist`, `coverage_whitelist`, `weekly_orders`, `app_settings`, `capacity_waitlist`. As três últimas são órfãs (não em `schema_migrations`). Se conceito novo encostar nelas, criar tabela nova e referenciar, não reparar legado.

---

## Migrations

| Migration | Status remoto | Branch que aplicou | Observação |
|---|---|---|---|
| 0001 - 0013 | aplicada | `main` | Fase 1 Etapa 0 |
| 0014 | aplicada | `main` (`fd57556`) | subscription_change_tracking |
| 0015_bairros_atendidos | aplicada | `main` (`f66cc9a`, PR #2) | tabela bairros_atendidos |
| 0016_janelas_entrega | aplicada | `main` (`42b389b`, PR #3) | desacopla data_entrega/cutoff de semanas |
| 0017_subscriptions_user_id | aplicada | `main` (`e52519e`, PR #4) | FK que habilita integração com Supabase Auth no Portal (Frente A do briefing CORA_Briefing_Auth_MagicLink_SMS_Ready) |
| 0018_profiles_e_expand_subscriptions | aplicada | `main` (`1453270`, PR #7) | Frente D / D.1 — fase **expand**. Cria `profiles` (1:1 c/ auth.users, RLS select-own) + 9 colunas nullable e 2 CHECKs de qty em `subscriptions`. Sem drop/rename do shape legado. |
| 0019_revoke_escrita_subscriptions_profiles | **mergeada, escrita pendente** | `main` (`f5daadd`, PR #11) | Segurança (ClickUp 86e1mcyuz). Revoga INSERT/UPDATE/DELETE de `authenticated`+`anon` em `subscriptions` e `profiles`, revoga SELECT de `anon`, dropa policy `subscriptions_update_own`. SELECT own do `authenticated` e `service_role` mantidos. **NÃO aplicada no banco ainda** (db push/SQL pendente do Hugo). |

---

## Branches em voo

Nenhum branch em voo no momento. Sessão de 29/05/2026 (PRs #7 migration 0018, #8 briefing Frente D, #9 prompt template) consolidada em main. Sessão de 30/05/2026 (PR #11 migration 0019 segurança) mergeada — **falta aplicar a 0019 no banco** (db push/SQL pendente do Hugo).

---

## Como aplicar migrations (lições aprendidas)

**Setup desta máquina:**
- Sem Docker
- Sem psql/credenciais locais
- `supabase login` via personal access token (90 dias)
- Toda migration é aplicada pelo Hugo no terminal via `supabase db push`

**Sequência padrão:**

```bash
cd ~/Developer/cora-backoffice
git checkout -b feat/nome-da-mudanca
# criar supabase/migrations/00XX_nome.sql
supabase migration list   # ver o que vai aplicar
supabase db push           # confirma com Y
# verificações no SQL Editor (uma por vez — Supabase SQL Editor truncates múltiplos resultados)
git add . && git commit -m "feat(schema): ..."
git push -u origin feat/nome-da-mudanca
```

**Gotchas:**
- Supabase SQL Editor só mostra o output do último SELECT quando você cola múltiplas queries. Rode uma por vez pra ver tudo.
- Se `db push` silencia e não pede confirmação, há gap entre local e remoto.
- `CHECK` constraint com subquery falha em Postgres. Use `BEFORE INSERT OR UPDATE` trigger.
- Funções/triggers reutilizáveis já existem: `set_updated_at()`, `is_admin()`. Validar nome no DDL antes de assumir.
- `subscriptions` já tem trigger `subscriptions_set_updated_at` (0001) e policy `subscriptions_select_own` (0017). A `subscriptions_update_own` foi **dropada na 0019** (segurança): escrita no client foi revogada, toda escrita é via `service_role`. Não recriar policy de write pro `authenticated`. Não duplicar ao expandir a tabela.
- Em expand-contract, CHECK do tipo `a + b = c` já é NULL-tolerant (operando NULL → expressão NULL → CHECK passa). Não morde linhas legadas até o cutover popular os valores.

---

## Pendências em aberto

### Decisões aguardando sessão dedicada

- **Faturas + enum `entregue`:** ver `CORA_Recomendacao_Backoffice_Faturas_e_Enum_Entregue.md`. 3 mecânicas operacionais a definir (criação, transição de status, marcação de entrega).
- **`weekly_orders` órfã:** se conceito de "entregue" for entrar, decidir se vai no enum legacy ou em nova tabela `entregas` (ver discussão na sessão de faturas).

### Frente D (Subscription no DB) — em andamento

- **D.1 (schema) concluída** nesta sessão via migration 0018 (expand). `profiles` e colunas novas de `subscriptions` no banco; shape legado intacto.
- **D.2 a D.5** (cutover de código: read-path, onboarding real, popular qty_*, etc.) são sessões separadas, ainda não iniciadas.
- **Gate de segurança (ClickUp 86e1mcyuz):** migration 0019 fecha a escrita direta do client em `subscriptions`/`profiles` (furo da `update_own`). Mergeada em `main` (PR #11); aplicar no banco **antes da D.3 ir pra prod** (quando passam a existir subscriptions reais). D.2 mantém SELECT own do `authenticated`.
- **Migration de contract (ClickUp 86e1mc0ta):** dropa as colunas mortas de `subscriptions` (nome, email, whatsapp, cpf, itens, total_paes, valor_paes, valor_mensal, valor_frete, coverage_unconfirmed, next_billing_change_date, next_billing_value) e vira `qty_*`/`user_id` NOT NULL após backfill. **Só roda depois** do cutover D.2/D.3/D.4. Não escrever antes.

### Tech debt registrada

- `subscriptions.janela_padrao_id` não criado ainda — entra quando entrega regular for materializada em rows (provavelmente acompanhando UI Pedidos)
- Drop de `semanas.data_entrega` e `semanas.data_corte` (deprecated) — migration separada quando todos os consumidores migrarem (UI Semana, UI Produção, UI Pedidos, Portal). Módulo Semana UI já está em main; auditoria de uso dessas colunas no módulo é pré-requisito do drop.

---

## Sources of truth

- `Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md` — schema consolidado, autoritative
- `Docs/CORA_Briefing_Backoffice_Janelas_Entrega.md` — briefing de desacoplamento
- `Docs/CORA_Briefing_FrenteD_D1_Schema.md` — briefing da Frente D / D.1 (profiles + expand subscriptions)
- `Docs/CORA_Recomendacao_Backoffice_Faturas_e_Enum_Entregue.md` — recomendação pendente
- Project knowledge (Claude): `CORA_Decisoes_v2.md`, `CORA_Precos_e_Planos_v1.md`, `CORA_Fichas_Producao_v5.xlsx`

---

## Como começar nova sessão

Cola como primeira mensagem:

```
Sessão sobre cora-backoffice. Lê PRIMEIRO o BACKOFFICE_STATUS.md
na raiz do repo. Tópico desta sessão: [tema específico].

Se for tocar em schema, segue a governance: migration via db push,
sequência padrão do STATUS. Não escrever migration antes de
confirmar nome real de colunas/funções no DDL.
```
