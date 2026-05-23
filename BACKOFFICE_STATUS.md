# BACKOFFICE_STATUS

*Read first em toda sessão de Backoffice (CC, Claude Chat, ou qualquer instância). Atualizado ao fim de cada sessão.*

**Última atualização:** 20 de maio de 2026.

---

## Estado do repositório

- **Repositório:** `github.com/hugorafael01-tech/cora-backoffice`
- **Branch principal:** `main` (commit `cf2ed9c`)
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
| 0001 - 0013 | ✅ aplicada | `main` | Fase 1 Etapa 0 |
| 0014 | ✅ aplicada | `main` (`fd57556`) | subscription_change_tracking |
| 0015_bairros_atendidos | ✅ aplicada em PROD | **`fase-1-semana` (unmerged)** | Aplicada via db push direto da branch antes do merge. Arquivo SQL não existe em main. |
| 0016_janelas_entrega | ✅ aplicada em PROD | **`feat/janelas-entrega` (unmerged, pushada)** | Desacopla data_entrega/cutoff de semanas. V1-V8 validados. |

**Importante:** o remoto está à frente do `main`. Toda branch nova baseada em `main` que rodar `supabase db push` vai dar gap (CLI aborta silenciosamente). Mitigação: trazer 0015 e 0016 via `git checkout fase-1-semana -- supabase/migrations/0015_*.sql` e `git checkout feat/janelas-entrega -- supabase/migrations/0016_*.sql` antes de aplicar nova migration.

A divergência se resolve quando as duas branches mergearem no main.

---

## Branches em voo

- **`fase-1-semana`** — Etapa 1 (UI Semana). Já tem 0015_bairros_atendidos aplicada em PROD. Aguardando finalização da UI antes do merge.
- **`feat/janelas-entrega`** — pushada (`origin/feat/janelas-entrega`, commit `1438ae5`), pendente PR. Tem 0016_janelas_entrega aplicada em PROD. Aguardando merge de `fase-1-semana` no main pra rebasar e abrir PR.

**Ordem ideal de merge:** fase-1-semana → main, rebasar feat/janelas-entrega, feat/janelas-entrega → main. Resultado: histórico de migration `0014, 0015, 0016` sequencial em main.

---

## Como aplicar migrations (lições aprendidas)

**Setup desta máquina:**
- Sem Docker
- Sem psql/credenciais locais
- `supabase login` via personal access token (90 dias)
- Toda migration é aplicada pelo Hugo no terminal via `supabase db push`

**Sequência padrão:**

```bash
cd ~/Desktop/cora-backoffice
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
- Se `db push` silencia e não pede confirmação, há gap entre local e remoto. Trazer migrations faltantes via `git checkout` da branch correspondente.
- `CHECK` constraint com subquery falha em Postgres. Use `BEFORE INSERT OR UPDATE` trigger.
- Funções/triggers reutilizáveis já existem: `set_updated_at()`, `is_admin()`. Validar nome no DDL antes de assumir.

---

## Pendências em aberto

### Decisões aguardando sessão dedicada

- **Faturas + enum `entregue`:** ver `CORA_Recomendacao_Backoffice_Faturas_e_Enum_Entregue.md`. 3 mecânicas operacionais a definir (criação, transição de status, marcação de entrega).
- **`weekly_orders` órfã:** se conceito de "entregue" for entrar, decidir se vai no enum legacy ou em nova tabela `entregas` (ver discussão na sessão de faturas).

### Tech debt registrada

- Gap de migrations no main (0015, 0016 só em branches) — resolve com merge sequencial
- `subscriptions.janela_padrao_id` não criado ainda — entra quando entrega regular for materializada em rows (provavelmente acompanhando UI Pedidos)
- Drop de `semanas.data_entrega` e `semanas.data_corte` (deprecated) — migration separada quando todos os consumidores migrarem (UI Semana, UI Produção, UI Pedidos, Portal)

---

## Sources of truth

- `Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md` — schema consolidado, autoritative
- `Docs/CORA_Briefing_Backoffice_Janelas_Entrega.md` — briefing de desacoplamento
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
