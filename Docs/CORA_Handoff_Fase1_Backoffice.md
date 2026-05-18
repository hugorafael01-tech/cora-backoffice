# CORA — Handoff para Fase 1 do Backoffice (Semana + Produção)

**Origem:** sessão Claude Chat 14-15/mai/2026 (Fase 0 fechada + decisões pré-Fase 1).
**Próxima sessão:** nova conversa pra abrir briefing técnico da Fase 1.
**Objetivo do handoff:** quem ler isso na sessão nova entende onde paramos sem precisar voltar atrás.

---

## Estado atual (15/mai/2026)

### Fase 0 do Backoffice — fechada
- Repo `cora-backoffice` em `github.com/hugorafael01-tech/cora-backoffice`
- `admin.acora.com.br` no ar, autenticação via magic link funcional
- 6 migrations aplicadas no Supabase compartilhado (mesma base do Portal)
- Seed completo: 25 ingredientes, 6 produtos, 6 receitas ativas com versão v1
- RLS + `admin_users` autorizando acesso
- Stack: Vite + React + TS + Tailwind, `@supabase/supabase-js` (sem ORM)
- ClickUp: task `86e1d1dxm` registra o fechamento detalhado

### Portal
- `app.acora.com.br` em produção desde 14/mai/2026 (Fase 7 do refactor de Onboarding)
- Cadastro real funcionando (já tem 1 subscription `active` validando o fluxo)
- Tabelas que o Portal criou e usa: `subscriptions`, `coverage_waitlist`, `coverage_whitelist`, `app_settings`, `capacity_waitlist`, `weekly_orders`
- Está em refactor da Fase 1 do Cardápio (`ProductCard.jsx` + `App.jsx`) — só frontend

---

## Decisões fechadas que importam pra Fase 1

### Regra de ownership de schema (task `86e1d223m`)

1. Schema é gerenciado **APENAS** pelo repo Backoffice via `supabase db push`
2. Portal não aplica mais mudanças de schema (nem CLI, nem dashboard SQL Editor)
3. Se Portal precisar de schema novo, abre task pro Backoffice
4. Numeração contínua: próxima migration é **0007**
5. Arquivos `.sql` órfãos do Portal (`0002_capacity_gate.sql`, `0003_weekly_orders.sql`) são documentação histórica — o que está **no banco real** é o canônico
6. Dashboard SQL Editor é só pra leitura e debug

### Tabelas do Portal que o Backoffice vai consumir

Existem no banco mas não no migration history do CLI (foram aplicadas via dashboard antes da regra). Não recriar — só adicionar policies admin pra ler:

- **`app_settings`** (singleton): flag `subscriptions_open boolean`
- **`capacity_waitlist`**: lista de espera por capacidade produtiva
- **`weekly_orders`**: **peça central da Fase 1** — carrinho persistido por assinante por quinta-feira. Tem `composition jsonb` (override da cesta da semana), `extras jsonb` (avulsos), status `rascunho|confirmado`, timestamps de fluxo de abandono. Backoffice agrega isso pra calcular produção.

### Modelagem de insumos e lotes (task `86e1e7933`)

Análise detalhada já feita. Recorte fechado:

**Entra na Fase 1:**
- Tabela `supply_lots` minimalista (sem `quantity_remaining_g`)
- `quantity_received_g` em `supply_lots` + trigger somando em `ingredients.quantity_current_g`
- `ingredients.quantity_current_g` + `quantity_minimum_g` (ALTER se não existir)
- FK `production_contexts.supply_lot_id` (nullable)
- Modal inline "+ Novo lote" durante produção (não tela dedicada de Recebimento)
- Baixa de estoque inline na produção
- Alerta de estoque mínimo modo passivo (cor diferente na lista)

**Fica fora do MVP:**
- `quantity_remaining_g` por lote (cálculo automático divergiria da realidade física)
- UI dedicada de Recebimento (volume baixo)
- Etiqueta de insumo impressa (sharpie em fita crepe funciona)
- Listagem de lotes ativos com saldo
- Alerta ativo de validade próxima
- Débito automático de estoque na produção
- Notificação ativa do alerta de estoque mínimo (email/WhatsApp)

### Pedidos extras (pães de presente, envios institucionais)

Modelagem na Fase 1 como **cliente "pontual"** — `subscription` com tipo especial. Duas opções a discutir no início da Fase 1:
- (a) Adicionar `subscription_kind: 'recorrente' | 'pontual'` em `subscriptions` + data de início/fim
- (b) Tabela `orders_avulsos` separada

### Etiquetagem de processo (quarta-feira, durante produção)

Sharpie em fita crepe. **Não usa impressora.** Impressora térmica (Elgin L42-DT, a comprar antes de junho) é pra etiqueta de embalagem de pedido — uso primário no módulo Expedição (Fase 2).

---

## Plano provisório de migrations da Fase 1

| Migration | Propósito |
|---|---|
| `0007_policies_admin_portal_tables.sql` | Policies `admin read` em `app_settings`, `capacity_waitlist`, `weekly_orders` |
| `0008_supply_lots.sql` | Tabela `supply_lots` + trigger pra `ingredients.quantity_current_g` + ALTER em `ingredients` |
| `0009_semanas.sql` | Tabela `semanas` (cardápio semanal, cortes de terça, status) |
| `0010_producoes.sql` | Tabela `producoes` (FK pra semana + receita) |
| `0011_production_steps_contexts.sql` | Execução das etapas (timer, fotos, notas) + `production_contexts` com FK pra `supply_lots` |
| `0012_view_planejamento_semana.sql` | View agregadora: `weekly_orders` + extras + assinaturas → quantidades por SKU por quinta |

---

## Pendências a resolver no início da Fase 1

1. **Wireframes definitivos.** Hugo tem múltiplas versões em `Docs/wireframes/`:
   - `semana/` tem 6 arquivos (Semana v4, Semana v4-print, Semana v4.html, Cora Semana v4 - standalone, Semana v4 - wireframes v5, Cora Semana v4 wireframes - standalone)
   - `producao/` tem 6 arquivos
   - `expedicao/`, `planejamento/`, `receitas/` têm 1-3 cada
   
   Hugo precisa indicar qual é a versão definitiva de Semana e Produção antes do briefing técnico.

2. **Modelagem de cliente "pontual"** (decisão a/b acima).

3. **`weekly_orders` policies de leitura admin** — confirmar que policy `admin read` funciona via `is_admin()` (função criada na Fase 0).

4. **Detalhes de UI mobile** — operação acontece na bancada com farinha nas mãos. Tela de Produção precisa ser tocável com cantos de dedo, fontes maiores, menos lixo visual.

---

## Princípios reforçados pela sessão

- **Briefing antes de código.** Decisões arquiteturais discutidas e fechadas antes de qualquer linha. Claude Code recebe briefing completo, não infere.
- **Schema só via Backoffice repo.** Sem exceção.
- **Não criar UI antes de virar dor.** YAGNI honesto. Hugo é solo, cada tela mantida custa tempo.
- **Direto, sem condescendência.** Hugo prefere questionamento a concordância. Se algo soa errado, falar.
- **Português no schema.** Convenção fechada na Fase 0. Tabelas e colunas em português; timestamps e enums técnicos pré-existentes em inglês.
- **Mobile-first no Backoffice.** Operação acontece na bancada.

---

## Contexto operacional importante

- **Forno deck chega 16/jun/2026** — marco operacional crítico. Receitas v1 entram como `ativa` mas vão ser ajustadas via `fork_versao_receita()` pós-forno.
- **Junho/julho 2026 = testes operacionais** com execução manual. Coleta de dados reais pra decisão de automação.
- **Agosto 2026 = lançamento oficial** com 50 pessoas (30 Alphas + 20 Influentes).
- **Sábado de manhã = bloco dedicado a desenvolvimento.** Brechas durante a semana são pra revisão/spec, não código.
- **Solo operation.** Hugo faz tudo: produção, logística, comunicação, desenvolvimento.
- **Doc operacional:** `CORA_Operacao_Rotina_v1.md` mapeia a rotina semanal completa. Vale ler antes da Fase 1.

---

## Referências (links e documentos)

### ClickUp — Workspace Cora Pré-Lançamento

- **`86e1d1dxm`** — Backoffice Fase 0 fechada ✅
- **`86e1d223m`** — Regra atualizada: ownership de schema concentrado no Backoffice
- **`86e1e7933`** — Insumos e lotes — recorte pra Fase 1
- **`86e1b23vq`** — Wireframe Receitas — pendências adiadas pra Fase 3 (não tocar agora)

### Repos

- `github.com/hugorafael01-tech/cora-backoffice` (Backoffice — schema, migrations, frontend admin)
- Portal — repo separado em `Cora_APP/cora-portal/` no Mac do Hugo

### Documentos no Project Knowledge

- `CORA_Operacao_Rotina_v1.md` — rotina operacional semanal
- `CORA_Decisoes_v2.md` — decisões estratégicas, financial model, JTBD
- `CORA_Briefing_Backoffice_Fase0_Setup.md` (em `Docs/` do repo) — briefing técnico da Fase 0 implementada

### Banco

- Supabase project ref: `kjzuvmhedicxbuynfqev`
- URL: `https://kjzuvmhedicxbuynfqev.supabase.co`
- Backoffice CLI linkado (rodar comandos `supabase db push`, `supabase migration list` do repo `cora-backoffice`)

---

## Como iniciar a próxima sessão

Sugestão de prompt inicial:

```
Vou abrir a Fase 1 do Backoffice (Semana + Produção). Tenho o handoff 
em mãos. Estado atual:

- Fase 0 fechada, admin.acora.com.br no ar
- Próxima migration é 0007
- Tabelas operacionais a criar: supply_lots, semanas, producoes, 
  production_contexts, production_steps + view agregadora
- weekly_orders já existe no banco (criada pelo Portal), Backoffice vai 
  consumir

Antes de escrever briefing técnico, preciso decidir:
1. Wireframe definitivo de Semana e Produção (tenho 6 versões de cada)
2. Modelagem de cliente "pontual" pra pedidos extras
3. Ordem ideal de implementação dentro da Fase 1 (semana → produção, ou 
   construir as duas em paralelo?)

Vamos discutir essas decisões antes de qualquer migration ou código.
```

Boa próxima sessão.
