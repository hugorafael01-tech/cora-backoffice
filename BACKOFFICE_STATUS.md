# BACKOFFICE_STATUS

*Read first em toda sessão de Backoffice (CC, Claude Chat, ou qualquer instância). Atualizado ao fim de cada sessão.*

**Última atualização:** 7 de junho de 2026.

---

## Estado do repositório

- **Repositório:** `github.com/hugorafael01-tech/cora-backoffice`
- **Branch principal:** `main` (commit `8d2492a`)
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
| 0019_revoke_escrita_subscriptions_profiles | **aplicada** (via SQL Editor) | `main` (`f5daadd`, PR #11) | Segurança (ClickUp 86e1mcyuz). Revoga INSERT/UPDATE/DELETE de `authenticated`+`anon` em `subscriptions` e `profiles`, revoga SELECT de `anon`, dropa policy `subscriptions_update_own`. SELECT own do `authenticated` e `service_role` mantidos. **Aplicada no banco** (SQL Editor, não db push). Verificada por probe anônimo em 03/jun: anon `SELECT` em `subscriptions` e `profiles` retorna `42501` (permission denied), provando que o REVOKE de SELECT do `anon` está de pé; como a migration roda em bloco único, os REVOKEs de write do `authenticated` e o DROP da policy `subscriptions_update_own` foram aplicados junto. Corroborada pelo endpoint de vínculo da Perna 3 Peça A, que só existe porque a escrita do client foi revogada. |
| 0020_asaas_webhooks_schema | **aplicada** (via SQL Editor) | `main` (`57ab4be`, PR #13) | Asaas webhooks Perna 1 / SCHEMA (ClickUp 86e1mk8c0). Expand-only. Cria enum `payment_status_enum` (`em_dia`/`pendente`/`vencido`), +3 colunas nullable em `subscriptions` (`payment_status`, `last_payment_at`, `last_payment_event`), e tabela `asaas_webhook_events` (caixa-preta de eventos crus: UNIQUE em `asaas_event_id`, FK nullable → `subscriptions`, índices em `subscription_id`/`event_type`, `payload jsonb`). RLS: SELECT pro `authenticated` via `is_admin()` (painel lê via client autenticado); escrita só `service_role` (REVOKE write de `authenticated`/`anon`, SELECT de `anon`). Não toca `status`/`subscription_status`. **Aplicada no banco** (SQL Editor, não db push; queries pré/pós em `0020_asaas_webhooks_schema.verificacao.sql`). Verificada por probe em 03/jun: tabela `asaas_webhook_events` existe (coluna inexistente → `42703`, não erro de tabela); as 3 colunas em `subscriptions` existem (`42501`, não `42703`); enum `payment_status_enum` existe (é o tipo de `payment_status`). Corroborada pela Perna 2 provada ponta a ponta com evento real do Asaas em 02/jun. |
| 0021_producao_fatia1_levain_origem | **aplicada** (via SQL Editor) | `main` (`8028bfb`, PR #19) | Produção fatia 1. Expand-only. (1) **Levain como ingrediente** (não coluna): adiciona `levain` ao catálogo + 1 linha por versão com o `percentual_baker` validado do Alex (Original/Integral 0.20, Multigrãos 0.40, Ciabatta 0.25, Focaccia 0.30, Brioche 0.10). Corrige `peso_farinha_por_pao()`/`mise_en_place_semana()`, que superestimavam a farinha ~12% (Original: 820/1,72=477 errado → com levain no Sigma 820/1,92=427 correto). (2) `producoes.origem` enum `producao_origem_enum` {pedido, manual, teste}, default `teste`. (3) Trigger `trg_producoes_set_prevista` (fonte única) preenche `massa_prevista_kg` e `levain_previsto_kg`. RLS de `producoes` já era `admin_all` (0012). **Aplicada no banco** (SQL Editor; histórico CLI dessincronizado desde 0018). Verificada por probe em 07/jun: farinha Original=427, 7 linhas de levain, `origem` default `teste`. |
| 0022_produto_formato_disco_bola | **aplicada** (via SQL Editor) | `main` (`8028bfb`, PR #19) | Adiciona `disco` e `bola` ao enum `produto_formato` (formatos de venda da pizza). Transação separada da 0023 (Postgres não usa valor de enum recém-adicionado na mesma transação). Verificada por probe em 07/jun (`enum_range` lista disco+bola). |
| 0023_seed_pizza | **aplicada** (via SQL Editor) | `main` (`8028bfb`, PR #19) | Pizza Clássica (Levain) como receita real (formulação do Alex). Produto formato `disco`, versão rascunho, ingredientes com levain (farinha/un ~150g). Etapas NÃO seedadas (sem inventar tempos). `lemady` (melhorador 0,3%) no catálogo. Depende de 0021 (levain) e 0022 (disco/bola). Verificada por probe em 07/jun (farinha Pizza=150). |

---

## Branches em voo

Nenhum branch em voo no momento. Sessão de 29/05/2026 (PRs #7 migration 0018, #8 briefing Frente D, #9 prompt template) consolidada em main. Sessão de 30/05/2026 (PR #11 migration 0019 segurança) mergeada e **aplicada no banco** (via SQL Editor; verificada por probe em 03/jun). Sessão de 01/06/2026 (PR #13 migration 0020 Asaas webhooks Perna 1/SCHEMA) mergeada e **aplicada no banco** (via SQL Editor; verificada por probe em 03/jun). Sessões de 03/06/2026: módulo Financeiro Peça C mergeado (PR #16 read-only, PR #17 ação de vincular) + atualizações de documentação deste STATUS — sem mudança de schema. Sessão de 07/06/2026: Produção fatia 1 — schema (migrations 0021/0022/0023) mergeado (PR #19) e **aplicado no banco** (via SQL Editor; verificado por probe em 07/jun); frontend da tela "Definir volume" (Estado A) mergeado (PR #20). Pizza modelada como receita real.

---

## Como aplicar migrations (lições aprendidas)

**Setup desta máquina:**
- Sem Docker
- Sem psql/credenciais locais
- `supabase login` via personal access token (90 dias)
- Toda migration é aplicada pelo Hugo via `supabase db push` **quando** o histórico local bate com o remoto. **Exceção (lição 0019/0020):** quando o histórico local está dessincronizado da CLI, `db push` não enxerga as migrations novas como pendentes (`supabase migration list` mostra a coluna Remote em branco pra elas). Nesse caso o caminho é colar o SQL no **SQL Editor** do Supabase. As migrations 0019 e 0020 foram aplicadas assim. Consequência: `supabase migration list` não é fonte de verdade do que existe no banco quando se usa SQL Editor — confirmar o schema direto (ex: probe na REST API).

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
- **Gate de segurança (ClickUp 86e1mcyuz):** migration 0019 fecha a escrita direta do client em `subscriptions`/`profiles` (furo da `update_own`). Mergeada em `main` (PR #11) e **aplicada no banco** (via SQL Editor; verificada por probe em 03/jun) — gate fechado. D.2 mantém SELECT own do `authenticated`.
- **Migration de contract (ClickUp 86e1mc0ta):** dropa as colunas mortas de `subscriptions` (nome, email, whatsapp, cpf, itens, total_paes, valor_paes, valor_mensal, valor_frete, coverage_unconfirmed, next_billing_change_date, next_billing_value) e vira `qty_*`/`user_id` NOT NULL após backfill. **Só roda depois** do cutover D.2/D.3/D.4. Não escrever antes.

### Asaas webhooks (ClickUp 86e1mk8c0) — concluída (resta só pendência operacional)

- **Perna 1 (SCHEMA) concluída e aplicada** via migration 0020 (expand). Enum `payment_status_enum`, 3 colunas de pagamento em `subscriptions` e tabela `asaas_webhook_events` no schema; mergeada (PR #13) e **aplicada no banco** (SQL Editor; verificada por probe em 03/jun).
- **Perna 2 (endpoint) — cora-portal, NÃO neste repo: NO AR e validada.** `/api/webhooks/asaas` que valida `asaas-access-token`, grava o evento cru na `asaas_webhook_events` (via service_role), responde 200, e reflete `payment_status` na `subscription` (derivado da tabela). Idempotência pela UNIQUE em `asaas_event_id`. **Provada ponta a ponta com evento real do Asaas em 02/jun** (PR #35 + fix #37).
- **Perna 3 (painel + vínculo) — cora-backoffice + cora-portal:**
  - **Peça A (endpoint de vínculo) — cora-portal: NO AR e validada em produção em 03/jun** (PR #39). `POST /api/asaas/vincular` que o backoffice chama pra gravar `subscriptions.asaas_customer_id` (escrita via service_role, já que a 0019 revogou a escrita do client). Autorização por JWT do admin + checagem `is_admin` server-side por email contra `admin_users` (à prova de bypass: email vem de `authData.user.email`, nunca do body). Validado em 8 casos via curl com JWT admin real.
  - **Peça C (UI no backoffice) — cora-backoffice: NO AR** em `admin.acora.com.br/financeiro` (ClickUp 86e1pfph9 / 86e1pwnhv).
    - **C1 (read-only, PR #16):** cards de resumo (em dia / vencidas / sem status / pra identificar), panorama de assinaturas com filtros e busca, pagamentos órfãos agrupados por cliente, e estados vazios. Lê `subscriptions` + `asaas_webhook_events` via client autenticado (`is_admin()`).
    - **C2 (ação de vincular, PR #17): validada em produção.** Modal de busca de assinante que chama `POST /api/asaas/vincular` no portal (cross-origin; CORS resolvido no portal, PR #41), usando o access_token da sessão atual do admin. Trata 200/409/404/400/401. Não escreve em `subscriptions` direto (respeita 0019; escrita via service_role no portal). URL do portal via `VITE_PORTAL_URL`. Ao vincular, o endpoint **reconcilia todos os órfãos daquele `asaas_customer_id`** (carimba `subscription_id`; PR #42 no portal), então o pagamento sai de "pra identificar" e não reaparece num reload.
- **Recorte fase 1:** cobrança criada manualmente no painel do Asaas. O painel **não expõe `externalReference`** na criação manual de cobrança (só via API), então o casamento evento→assinante **NÃO** é por `externalReference`. Na fase 1 o casamento é por **`asaas_customer_id`**: o endpoint de webhook (Perna 2) casa o evento pelo `asaas_customer_id` do pagador (fallback já implementado e testado), e o vínculo `assinante ↔ cliente-Asaas` é gravado em `subscriptions.asaas_customer_id` pelo endpoint da Peça A (a UI da Peça C é onde o Hugo dispara esse vínculo). "Pago" dispara com PAYMENT_CONFIRMED **ou** PAYMENT_RECEIVED (cartão só vira RECEIVED 32 dias após CONFIRMED); "Vencido" com PAYMENT_OVERDUE.
- **Pendência operacional do Hugo (única coisa que falta):** criar o webhook em **produção** do Asaas (hoje só o Sandbox existe). Com a Peça C no ar, é o último passo pra ligar o fluxo no Alpha — fecha a Perna 3 e a integração Asaas inteira.

### Frente Produção — fatia 1 concluída

- **Briefing:** `Docs/CORA_Briefing_Backoffice_Producao_Fatia1_DefinirVolume.md`. Wireframe: `Docs/wireframes/producao/Producao - Definir Volume v1.html` (estende o v5+3).
- **Schema (PR #19):** migrations 0021/0022/0023 mergeadas e aplicadas (ver tabela de Migrations). **Levain é ingrediente, não coluna**; `peso_farinha_por_pao`/`mise_en_place` agora corretas. Trigger `producoes_set_prevista` é a **fonte única** de `massa_prevista_kg`/`levain_previsto_kg`.
- **Frontend (PR #20):** tela "Definir volume" (Estado A) em `admin.acora.com.br/producao`, no padrão do módulo Semana. Rota `/producao` → `/producao/atual` → `/producao/:id` (reusa `escolherAtual`, extraído pra `lib/semana.ts`); Produção ligada no nav (sidebar + bottom nav). Lista de volume com contador; fontes = cardápio da semana + adicionar receita ativa + nova receita de teste (variação via `fork_versao_receita` com overrides; pão novo = produto+receita+versão rascunho, slug único). Preview ao vivo de massa/levain espelha o trigger (client só espelha; banco é a verdade). Calculadora de build do levain (perfil líquido 1:2:2). "Criar produções da semana": upsert em `producoes` (`ON CONFLICT semana_id+versao_receita_id`, `origem='teste'`, `status='planejada'`) + `popular_etapas_producao`; escrita direta do client como admin (RLS `admin_all`, sem endpoint/CORS). Remover produção tem guard `origem='teste'` (nunca apaga pedido/manual real). `database.types.ts` patchado à mão pra refletir 0021-0023 (CLI dessincronizada).
- **Higiene de dados:** produções de teste têm `origem='teste'`, purgáveis antes do Alpha. Banco é compartilhado preview/prod — cuidado com dado de teste.
- **Próximo:** fatia 2 (acompanhamento) e fatia 3 (registros); 4º estado "pedidos N" (futuro, trava semântica contador-vs-total). Etapas das receitas de teste e da Pizza, e reconciliação completa (hidratação/splits/perda) Excel vs banco: passe do módulo Receitas.

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
