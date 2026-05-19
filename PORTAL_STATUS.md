# Cora Backoffice — Status Atual

_Atualizado em 2026-05-19 ao fechar Fase 1 Etapa 0 (Schema)._

## Versão
- **App:** v0.0.0
- **Branch:** main
- **Último commit:** `1594d25` — 2026-05-19 — Merge pull request #1 from hugorafael01-tech/fase-1-schema

## Stack
- Vite + React 19 + TypeScript (pinned 6.0.2) + Tailwind v4 (`@tailwindcss/vite`)
- `@supabase/supabase-js` direto, sem ORM
- Supabase project: `kjzuvmhedicxbuynfqev` (compartilhado com Portal — schema gerenciado só pelo Backoffice)
- Deploy: Vercel em `admin.acora.com.br` (atrás de Supabase Auth + `admin_users`)

## Estrutura
```
supabase/migrations/         SQL puro, ordem importa, aplicado via npm run db:push
src/lib/supabase.ts          client init (anon key, RLS aplica is_admin())
src/lib/database.types.ts    gerado via npm run db:types (1370 linhas, atual)
src/components/RequireAuth   gate de admin (consulta admin_users)
src/pages/                   Login (magic link), AuthCallback, Home (healthcheck)
Docs/                        briefings + wireframes
```

## Schema aplicado (13 migrations)

### Fase 0 (fechada 14/mai/2026)
- `0001_initial.sql` — copia do Portal (subscriptions, coverage_*, set_updated_at)
- `0002_admin_users.sql` — tabela + função `is_admin()`
- `0003_view_assinatura_itens.sql` — desagrega `subscriptions.itens` JSONB
- `0004_catalogo.sql` — produtos, planos, plan_produtos, fornecedores, ingredientes + enums
- `0005_receitas.sql` — receitas com versionamento + `fork_versao_receita()` + `ativar_versao_receita()`
- `0006_seed.sql` — 25 ingredientes, 6 produtos, 6 receitas v1 ativas

### Fase 1 Etapa 0 (fechada 19/mai/2026)
- `0007_policies_admin_tabelas_portal.sql` — admin read em `app_settings`, `capacity_waitlist`, `weekly_orders`
- `0008_lotes_insumo.sql` — tabela `lotes_insumo` + ALTER `ingredientes` (`quantidade_atual_g`, `quantidade_minima_g`) + trigger AFTER INSERT que soma estoque
- `0009_alter_produtos_e_seed_grupos.sql` — `tipo_cardapio_enum` + seed (`base`: original/integral; `rotativo`: focaccia/multigraos/brioche/ciabatta) + seed `grupo_sugerido` (1: focaccia; 3: integral/multigraos)
- `0010_semanas_e_cardapios.sql` — `semanas`, `cardapios` (snapshot), `popular_cardapio_padrao()`
- `0011_pedidos_pontuais.sql` — `pedidos_pontuais` + `metodo_pagamento_enum`
- `0012_producao.sql` — `producoes`, `contextos_dia`, `contextos_producao`, `etapas_producao` + 3 enums + ALTER `etapas_receita` ADD `tipo` (com seed por nome) + `popular_etapas_producao()`, `peso_farinha_por_pao()`, `mise_en_place_semana()`
- `0013_view_planejamento_semana.sql` — agrega `weekly_orders.composition` + `weekly_orders.extras` + `pedidos_pontuais.composicao` por slug/semana

## Convenções fechadas
- Tabelas/colunas em pt-BR snake_case (exceto tabelas do Portal: `subscriptions`, `weekly_orders`, etc.)
- Timestamps com sufixo `_at` (inglês, convenção pré-existente)
- IDs `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Money: `NUMERIC` (não `_cents`)
- Quantidades de insumo: `NUMERIC` com sufixo `_g`
- Trigger `set_updated_at()` em toda tabela com `updated_at`
- `is_admin()` em todas as policies do Backoffice
- `percentual_baker`: **decimal** (0.85 = 85%) — convenção da Fase 0. Funções `peso_farinha_por_pao()` e `mise_en_place_semana()` operam sem divisor `/100.0` (errata aplicada no briefing Fase 1 v3)
- ASCII-only em commits, squash merge via GitHub UI

## Build / Deploy
- **Último build local:** 2026-05-19 (`tsc -b && vite build` → 436 kB / 126 kB gzip)
- **vercel.json:** presente (SPA rewrite)

## Próximo passo
- **Fase 1 Etapa 1 — Módulo Semana** (branch `fase-1-semana`). UI conforme `Docs/wireframes/semana/Cora_Backoffice_-_Semana_wireframes_v5.html` (Estados A/B/C × Desktop/Mobile). Inclui sub-tela provisória de cardápio (comentário obrigatório de provisoriedade no código). Detalhes na seção 7 do briefing Fase 1 v3.
- **Fase 1 Etapa 2 — Módulo Produção** (branch `fase-1-producao`). UI conforme `Docs/wireframes/producao/Cora_Backoffice_-_Produc_a_o_wireframes_v5_3.html`. Terça (pré-prod), Quarta (em prod), Quinta (cocção via `etapas_producao` tipo `coccao`).
- **Fase 1 Etapa 3 — Pedidos pontuais** (branch `fase-1-pontuais`). CRUD mínimo sem wireframe formal.

## Pendências em aberto (não bloqueiam Fase 1 Etapa 1)
- Validar grupos definitivos G1/G2/G3 com Alex (skill `/master-baker`). Por ora segue o seed do wireframe.
- Brioche e Ciabatta: `tipo_cardapio='rotativo'` + `grupo_sugerido=2` por default — ajustar quando virarem parte do portfólio ativo de lançamento.
- Lógica de fornadas múltiplas (Original 45 = 2 fornadas de 23+22) fica no frontend ao chamar `popular_etapas_producao()`. Refatorar para função SQL se virar dor.
- Webhook Asaas pros pedidos pontuais: registro manual no MVP, fica pra Fase Financeira.

## Histórico

- **2026-05-19 — Fase 1 Etapa 0 (Schema):** migrations 0007-0013 aplicadas em `kjzuvmhedicxbuynfqev`. Validações da seção 7 do briefing v3 OK: `migration list` alinhado, 8 tabelas novas, 5 funções callable, view retorna 0 rows sem erro, trigger de `lotes_insumo` funcional, `peso_farinha_por_pao` retorna valores corretos pros 6 produtos (Original 477g, Integral 434g, Multigrãos 281g, Focaccia 155g, Brioche 148g, Ciabatta 362g). Errata aplicada na convenção decimal de `percentual_baker` (caminho (a): corrigir funções sem `/100.0` divisor). PR `#1` mergeado via GitHub UI (merge commit, não squash — deviation menor do briefing).
- **2026-05-14 — Fase 0 fechada:** repo no GitHub, `admin.acora.com.br` no ar via Vercel, magic link funcional, 6 migrations aplicadas, seed completo.
