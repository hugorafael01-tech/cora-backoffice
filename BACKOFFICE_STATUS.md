# BACKOFFICE_STATUS

*Read first em toda sessão de Backoffice (CC, Claude Chat, ou qualquer instância). Atualizado ao fim de cada sessão.*

**Última atualização:** 10 de junho de 2026 (P1a+P1b — **ciclos**: migration 0025 **aplicada** (drop do `UNIQUE (numero, ano)` + `semanas.sobra_levain_g`) e a UI de ciclos no ar: criar com data livre, switcher de ciclos abertos, `/atual` por entrega, sobra de levain persistida).

---

## Estado do repositório

- **Repositório:** `github.com/hugorafael01-tech/cora-backoffice`
- **Branch principal:** `main` (pós PR #33 — pivot da B2b-1; último schema na `69c41c7`/#30)
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
| 0021_producao_fatia1_levain_origem | **aplicada** (via SQL Editor) | `main` (PR #20, `b478509`) | Produção fatia 1. **Levain vira ingrediente** (linha em `ingredientes_receita` por versão) — conserta `peso_farinha_por_pao()` e `mise_en_place_semana()`, que subestimavam a farinha ~12% por omitir o levain do Σ baker. Enum `producao_origem_enum` (`pedido`/`manual`/`teste`) + coluna `producoes.origem` default `'teste'`. Trigger `producoes_set_prevista` (massa_prevista_kg = qty×peso_massa_g; levain_previsto_kg = qty×peso_farinha_por_pao×baker%_levain) — banco é a fonte da verdade do previsto. Verificada por probe 07/jun. |
| 0022_produto_formato_disco_bola | **aplicada** (via SQL Editor) | `main` (PR #20, `b478509`) | `ALTER TYPE produto_formato ADD VALUE 'disco'/'bola'`. Gotcha: enum value novo não é usável na mesma transação → seed da Pizza separada na 0023. |
| 0023_seed_pizza | **aplicada** (via SQL Editor) | `main` (PR #20, `b478509`) | Cria ingrediente `levain` no catálogo (se faltava) + **Pizza Clássica** (produto+receita+versão rascunho; formato `'disco'`; peso_massa 283g/un; perda_coccao 0.08; preço avulso NULL; ingredientes incl. levain 0.20). Verificada por probe 07/jun (farinha Original 427, Pizza 150, 7 receitas com levain). |
| 0024_contextos_dia_indice_relativo | **aplicada** (via SQL Editor) | `main` (PR #30, `69c41c7`) | B2a. `contextos_dia.dia`: `text` dia-da-semana (`terca`/`quarta`/`quinta`) → **`INT` contagem regressiva** (`D0`=entrega, `D1`=véspera, `D2`=2 dias antes); drop do CHECK `IN(...)`, `ALTER TYPE INT USING CASE`, `ADD CHECK (dia >= 0)`; `UNIQUE (semana_id, dia)` intacto. Remove o **único lock de dia-da-semana do schema**. Também dropa as colunas mortas `temp_agua_autolise_c`/`temp_massa_pos_batimento_c` de `contextos_producao` (temp vive em `etapas_producao.temp_c` desde a B1). Verificada por probe PRE/POS 09/jun. |
| 0025_ciclos_sobra | **aplicada** (via SQL Editor) | `main` (PR #40) | P1a. `DROP CONSTRAINT semanas_numero_ano_key` — era a **última trava de schema** amarrando 1 ciclo por semana ISO; removida, vários ciclos coexistem na mesma semana ISO (sobrepostos, entrega em qualquer dia), **identidade do ciclo = `data_entrega`**, `numero`/`ano` viram informativos. Carona: `ADD COLUMN semanas.sobra_levain_g NUMERIC NOT NULL DEFAULT 400 CHECK (>= 0)` — persiste a sobra de levain por ciclo. Aplicada no SQL Editor (não db push); probes PRE/POS em `0025_ciclos_sobra.verificacao.sql`. UI de ciclos na **P1b** (PR #41). |
| 0026_entregas | **criada e APLICADA** (10/jun, SQL Editor, probes PRE/POS verificados) | `feat/e1-migration-0026` (PR #43) | Expedição E1. `CREATE TABLE entregas`: **snapshot de entregas por ciclo** — congela nome/endereço/itens na geração e carrega o status. Origem dupla `origem IN ('assinatura','avulso')`; `weekly_order_id`/`pedido_pontual_id` são refs **lógicas SEM FK** (`weekly_orders` é pré-governança; `pedidos_pontuais` segue por simetria do snapshot), com CHECK de exatamente-um (`(wo IS NOT NULL)::int + (pp IS NOT NULL)::int = 1`). `itens jsonb` (`[{slug,nome,qty}]`), `regiao IN ('niteroi','rio')`, `status IN ('pendente','em_rota','entregue')` default `pendente` + `em_rota_at`/`entregue_at`. Idempotência do gerador via `UNIQUE (semana_id, weekly_order_id)` e `UNIQUE (semana_id, pedido_pontual_id)` (NULL ≠ NULL no Postgres). RLS `admin_all` + trigger `set_updated_at` (padrão 0012). **Aplicada no SQL Editor** (não db push) em 10/jun; probes PRE/POS de `0026_entregas.verificacao.sql` verificados (POS.1 retornou 21 colunas, correto contra o DDL). UI = **E2** (não nesta fatia). |

---

## Branches em voo

**Nenhum branch em voo no momento.** Sessão de 29/05/2026 (PRs #7 migration 0018, #8 briefing Frente D, #9 prompt template) consolidada em main. Sessão de 30/05/2026 (PR #11 migration 0019 segurança) mergeada e **aplicada no banco** (via SQL Editor; verificada por probe em 03/jun). Sessão de 01/06/2026 (PR #13 migration 0020 Asaas webhooks Perna 1/SCHEMA) mergeada e **aplicada no banco** (via SQL Editor; verificada por probe em 03/jun). Sessões de 03/06/2026: módulo Financeiro Peça C mergeado (PR #16 read-only, PR #17 ação de vincular) + atualizações de documentação deste STATUS — sem mudança de schema. **Sessão de 07/06/2026 (módulo Produção fatia 1):** migrations 0021-0023 + frontend mergeados via **PR #20** (squash) — `main` em `b478509`. **PR #19** (só as migrations 0021-0023) é subconjunto do #20 → **fechar sem mergear**. Sessão de 07-08/06: fatia **Preparação** (mise en place + ficha, read-only) mergeada via **PR #22** — `main` em `1cb0339`. **Sessão de 08/06/2026 (Estado B, fatia B1 + ajustes pós-smoke):** tudo mergeado em `main` (`931a511`), sem schema. (1) **B1 "Acompanhamento"** — primeira fatia que ESCREVE — via **PR #23**. (2) **Ajustes pós-smoke** via **PR #24** (Semana reflete produção em curso sem gate de estado; coluna de lote `g x{qty}` na ficha; total do mise destacado; tamanho da divisão "pecas de ~X g" na etapa `pre_shape`; `concluirProducao` cascateia etapas abertas; linha de etapa clicável + relabel `expandir`). (3) **Auto-iniciar produção** via **PR #25** (`avancarEtapa` promove a produção `planejada → em_curso` ao iniciar/pular a 1a etapa, idempotente). Próxima fatia: **B2** (migration `contextos_dia → D2/D1/D0` + UI de contextos). **Sessão de 09/06/2026:** (a) **Semana lê produções reais** via **PR #27** (volume + TabelaProducao a partir de `producoes`, não da view de demanda; `etapaAgora` distingue `concluída`; exclui canceladas) + favicon/logo da Cora, com alinhamento desktop/mobile via **PR #28**; (b) **DayTabs removido** da aba Definir Volume via **PR #29** (órfãos `diasDaSemana`/`DayTabs` deletados); (c) **B2a — migration 0024** (`contextos_dia` índice relativo + drop temp morto) via **PR #30**, mergeada e **aplicada no banco** (SQL Editor; verificada por probe PRE/POS), `main` em `69c41c7`; (d) **B2b-1 — aba "Contexto"** (`contextos_dia` por dia: refresh do levain, temp ambiente, notas; 3 blocos D2/D1/D0) via **PR #32**, sem schema. (O **#31** registrou a B2a no STATUS e foi mergeado; o **#32** somou a B2b-1 e fez `git merge origin/main` pra reconciliar — registração da B2a única, sem duplicar.) **Pivot (09/jun, PR #33):** a aba "Contexto" da B2b-1 foi **revertida** — refresh do levain não é diário; a temp ambiente (único contexto útil) foi pro **topo do Acompanhamento** (nível de ciclo: `contextos_dia.temp_ambiente_max_c`, dia D1). Schema 0024 mantido.

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

### Módulo Produção (fermentação/operação) — em andamento

Fora do circuito de assinatura/Asaas. Schema de produção existe desde a **0012** (`producoes`, `etapas_producao`, `contextos_dia`, `contextos_producao`; funções `popular_etapas_producao`, `peso_farinha_por_pao`, `mise_en_place_semana`). O trabalho atual é a **UI de operação, fatia a fatia**, pro período de testes (sem assinante: Hugo produz e registra pra afinar receita e fermentação antes do forno deck chegar — alvo 16/jun). O teste de fermentação em si (incl. assar de manhã, hoje terminando tarde demais) é do Hugo no mundo real — **não é problema de software**; o software só precisa estar utilizável o quanto antes.

- **Fatia 1 — Definir Volume (Estado A, entrada): concluída.** Migrations 0021-0023 + frontend via **PR #20**. Tela `/producao/:id` pra autorar `producoes` da semana (qty por receita, `origem='teste'`, massa/levain previstos via trigger), calculadora de build do levain (líquido 1:2:2), e criação de **variação** (via `fork_versao_receita`) / **pão novo de teste** (slug único, sem ingredientes → levain nulo).
  - **Smoke PENDENTE:** os fluxos de escrita (upsert de `producoes` + `popular_etapas_producao`, fork, pão novo, remover) **não foram exercitados em runtime** — só tsc/lint/13 testes de função pura + build. Validar clicando na tela antes de confiar; limpar producoes de teste depois (`origem='teste'`). É o que a fatia Preparação e o Estado B leem.
  - **Caveat conhecido — RESOLVIDO na B1 (08/jun):** o "Criar produções" usava `upsert ON CONFLICT DO UPDATE` que **resetava `origem`/`status` no conflito**. Fix em `criarProducoesSemana`: `origem`/`status` saíram do payload (defaults preenchem no INSERT, preservam no UPDATE) + guard que **exclui do upsert as produções já `em_curso`/`concluida`** (a tela de volume nunca reescreve a qty de uma produção que saiu da prancheta).
- **Fatia Preparação (completa o Estado A): concluída.** View **read-only** no módulo Produção: mise en place da semana (`mise_en_place_semana`) + ficha de cada receita produzida (formulação baker%/gramas via `peso_farinha_por_pao` + processo via `etapas_receita`). Sem schema. Mergeada via **PR #22** (`main` em `1cb0339`).
- **Fatia Acompanhamento (Estado B, B1): concluída (08/jun) — PRIMEIRA fatia que ESCREVE.** Mergeada via **PR #23**. 3a aba `/producao/:id`. `useAcompanhamento` lê `producoes` da semana + `etapas_producao` (ordenadas) + nome/grupo. Walkthrough por produção (status, progresso `N/M etapas`, etapas expansíveis, destaque da "etapa agora" = `em_curso` de menor ordem, senão 1a `aguardando`). Escreve em `etapas_producao`: avançar etapa (iniciar→`em_curso`, concluir→`concluida`, pular→`pulada`) + captura opcional inline por tipo gravada na **própria etapa** (`temp_c` p/ autolise/batimento, `dobra_numero` p/ dobra, `detalhes` JSONB p/ coccao/shape, `notas` em qualquer). Status da produção manual: iniciar/concluir (`producoes.status` + timestamps). Decisão: **temperatura vive em `etapa.temp_c`**, não em `contextos_producao` (isso é B2, seria entrada dupla). Escrita direta do client (RLS admin_all); refetch após cada sucesso; erros surfaceiam no banner (padrão `erroAcao`). Sem schema.
  - **Ajustes pós-smoke (PR #24 + #25):** (#24) Semana sempre carrega `etapasAgora` (sem gate de Estado B) → reflete produção em curso na `TabelaProducao`; coluna de lote `g x{qty}` na ficha; total do mise destacado; tamanho da divisão "pecas de ~X g" anexado na etapa de divisão (`pre_shape` = passo 5 `'Descanso e divisão'`, **não** `shape`; confirmado contra seed 0006/0012); `concluirProducao` cascateia as etapas abertas (`aguardando`/`em_curso` → `concluida`, etapas primeiro); linha de etapa clicável (`role=button` + chevron) e botão `captura → expandir`. (#25) `avancarEtapa(etapaId, acao, producaoId)` promove a produção `planejada → em_curso + iniciada_at` ao iniciar/pular a 1a etapa (idempotente via `.eq('status','planejada')`; `concluir` não promove).
  - **Smoke runtime ainda PENDENTE** em todo o Estado B (B1 + ajustes): os fluxos de escrita passaram por tsc/lint/27 testes puros + build, mas não foram exercitados clicando. Validar na tela antes de confiar; limpar `producoes` de teste depois (`origem='teste'`).
  - **B2a (migration 0024): concluída (09/jun).** Mergeada via **PR #30** e **aplicada no banco** (SQL Editor; verificada por probe PRE/POS). `contextos_dia.dia`: `text` dia-da-semana → `INT` contagem regressiva (`D0`=entrega, `D1`, `D2`...), `CHECK (dia >= 0)`, `UNIQUE (semana_id, dia)` intacto — removeu o único lock de dia-da-semana do schema. Também dropou `temp_agua_autolise_c`/`temp_massa_pos_batimento_c` de `contextos_producao` (temp vive em `etapas_producao.temp_c` desde a B1).
  - **B2b-1 (aba "Contexto"): REVERTIDA (09/jun, PR #33).** A aba (#32) resolvia o problema errado — refresh do levain não é diário. Removida (aba + `Contexto.tsx`/`BlocoContextoDia.tsx`). A **temp ambiente** (único contexto útil; dita o tempo de fermentação) foi pro **topo do Acompanhamento** (nível de ciclo): `salvarTempAmbiente` faz upsert só de `temp_ambiente_max_c` em `contextos_dia` dia=1 (`onConflict (semana_id, dia)`, sem clobber). Reutilizáveis mantidos: helpers SP do `date.ts`, `diasContexto`, `useContextosDia`. Schema 0024 intacto.
  - **B2b-2 (próxima): `contextos_producao` no card do Acompanhamento** (`hidratacao_ajustada_pct` + `notas`, por produção). **Sem schema.** Decisão travada: temperatura **não** se duplica aqui (vive em `etapa.temp_c`; as colunas de temp foram dropadas na 0024).
- **Próximas:** B2b-2 (`contextos_producao` no Acompanhamento) → Registro/retrospectiva (Estado C: realizado, previsto×realizado pra refinar receita).
- **Engavetado (grandes questões do Acompanhamento, pass dedicado perto do volume/lançamento):** (1) **agrupar o processo por TAREFA/LOTE** (todas as autolises juntas, todas as dobras) em vez de por produção — espelha o fluxo físico do padeiro; rework de peso (pães compartilham etapas no início e divergem depois); baixa dor no teste. (2) dobras como passos individuais (`dobra_numero`) + temp alvo estruturada — parqueado até lá.

**Decisões de modelo do ciclo de produção — 07/jun:**
- **Manter a tabela/módulo `semanas`** (sem renomear pra `ciclo`/`batch`). Mecanicamente ela já é um contêiner de ciclo com **datas livres**: começar em qualquer dia, deslocar por feriado, encurtar/alongar = só setar as datas. `numero` é INT livre — pode ser usado como **batch sequencial** sem mudança de schema. Renomear seria churn no módulo vivo (rota/componentes/types/Semana) sem ganho funcional, e não consertaria o lock real (abaixo).
- **CONCLUÍDA (B2a, 09/jun) — `contextos_dia.dia` virou índice relativo:** migration 0024 (PR #30, aplicada no SQL Editor, probe PRE/POS). De `text` dia-da-semana (`'terca'/'quarta'/'quinta'`) para **`INT` contagem regressiva** (`D0`=entrega, `D1`, `D2`...), `CHECK (dia >= 0)`, `UNIQUE (semana_id, dia)` intacto. Removeu o único lock de dia-da-semana do schema → destrava ciclos começando em qualquer dia, de 2 a N dias, e feriados. O frontend deriva o rótulo das datas; como `diasDaSemana()` foi removida no #29, a **B2b** introduz um helper novo `data → rótulo D{n}` (a partir do `dia` INT).
- **CONCLUÍDA (P1a, 10/jun) — `UNIQUE (numero, ano)` dropado:** migration 0025 (PR #40, **aplicada no SQL Editor**) remove a última trava de schema que amarrava 1 ciclo por semana ISO. Vários **ciclos** passam a coexistir na mesma semana ISO (sobrepostos, entrega em qualquer dia); a **identidade do ciclo vira `data_entrega`** e `numero`/`ano` viram **informativos** (não mais identidade). Carona: `semanas.sobra_levain_g` (`NUMERIC NOT NULL DEFAULT 400`) persiste a sobra de levain por ciclo.
- **CONCLUÍDA (P1b, 10/jun) — ciclos na UI** (PR #41, sem schema): (1) **criar ciclo com data livre** — `ModalCriarSemana` usa `derivaCiclo` (`data_inicio = entrega-2`/D2, `data_fim = entrega`, `data_corte = D2 12h`, `numero/ano` ISO informativos); copy "Ciclo"; preview `D2 · D1 · D0/entrega`; removido o erro de duplicidade (a constraint caiu) → dá pra criar 2 ciclos na mesma semana ISO. (2) **switcher** de ciclos abertos no header da Produção (`CicloSwitcher`, ordenado por entrega, preserva `?aba=`) no lugar das setas prev/next. (3) **`/producao/atual`** resolve via `escolherCicloAtual` (aberto com entrega ≥ hoje; senão mais recente). (4) `useProducaoVolume`/`useAcompanhamento` resetam `jaCarregou` ao trocar de `id` (loading correto, sem dados do ciclo anterior). (5) **sobra de levain persistida** — Definir Volume lê `sobra_levain_g` do ciclo e grava no blur (`salvarSobraLevain`), substitui o `useState(400)`; input aceita vírgula, mín 0. Identidade exibida: "Ciclo · entrega {dia}"; "Semana ISO N" como detalhe secundário.
- **Hotfix (P1b, 10/jun — PR #42):** botão **"+ Novo ciclo"** no header da Produção (ao lado do `CicloSwitcher`) — o `ModalCriarSemana` ganhou prop opcional `onCriada` (default segue indo pra `/semanas/:id`; na Produção navega pra `/producao/:id?aba=volume`). Antes só dava pra criar ciclo pelo módulo Semana. Cluster de botões do `WkHeader` virou `flex-wrap` (não clipa no mobile).
- **Multi-entrega por ciclo: ADIADO.** Modelar N entregas como rows é o que adiciona complexidade de verdade (e `derivaEstado` assume uma entrega só). 1 entrega/ciclo com datas livres cobre teste e lançamento. **Fio amarrado:** a `janelas_entrega` (0016) já desacopla entrega/cutoff de `semanas`, e `semanas.data_entrega`/`data_corte` estão **deprecated** (ver Tech debt). Quando o módulo migrar pra `janelas_entrega`, o `D2/D1/D0` deve ancorar na data de entrega canônica de lá.

### Tech debt registrada

- `subscriptions.janela_padrao_id` não criado ainda — entra quando entrega regular for materializada em rows (provavelmente acompanhando UI Pedidos)
- Drop de `semanas.data_entrega` e `semanas.data_corte` (deprecated) — migration separada quando todos os consumidores migrarem (UI Semana, UI Produção, UI Pedidos, Portal). Módulo Semana UI já está em main; auditoria de uso dessas colunas no módulo é pré-requisito do drop.

---

## Sources of truth

- `Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md` — schema consolidado, autoritative
- `Docs/CORA_Briefing_Backoffice_Janelas_Entrega.md` — briefing de desacoplamento
- `Docs/CORA_Briefing_FrenteD_D1_Schema.md` — briefing da Frente D / D.1 (profiles + expand subscriptions)
- `Docs/CORA_Briefing_Backoffice_Producao_Fatia1_DefinirVolume.md` — briefing da fatia 1 de Produção (levain-como-ingrediente, trigger de previsto, origem)
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
