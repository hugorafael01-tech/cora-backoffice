# CORA — Briefing Técnico Backoffice Fase 1 (Schema + Sequência) — v3

> **ERRATA (19/mai/2026 — pós-implementação)**
>
> A migration 0012 desta seção 6 mostra as funções `peso_farinha_por_pao()` e `mise_en_place_semana()` usando o divisor `/100.0` sobre `percentual_baker`. Isso assume que o valor está armazenado em pontos percentuais (85 = 85%), mas a Fase 0 (migration 0006) gravou os dados em **decimal** (0.85 = 85%). Com `/100.0`, o resultado fica 100× errado.
>
> **Convenção fechada:** `ingredientes_receita.percentual_baker` é decimal. Soma dos baker decimais = total relativo à farinha (farinha = 1.0). Fórmula: `peso_farinha = peso_massa / soma_baker`.
>
> **Caminho aplicado (a) — corrigir as funções, manter dados decimais:**
> - `peso_farinha_por_pao()`: `RETURN v_peso_massa / v_soma_baker;` (sem dividir por 100)
> - `mise_en_place_semana()`: `peso_farinha_por_pao(...) * ir.percentual_baker * qty` (sem dividir por 100)
>
> Validação pós-migration: para o Original (peso_massa=820, soma_baker=1.72), `peso_farinha_por_pao` retorna 476.7g — bate com o esperado. Sanity passa para os 6 produtos seedados.

**Versão:** 3.0 (definitiva)
**Data:** 18/mai/2026
**Substitui:** v2 de 18/mai (refinamentos após validação dos nomes de `etapas_receita` e slugs de `produtos`)
**Implementador:** Claude Code rodando no repo `cora-backoffice`
**Doc operacional de referência:** `CORA_Operacao_Rotina_v1.md`

**Status de validação contra banco real (project `kjzuvmhedicxbuynfqev`):**
- Estrutura de tabelas existentes: confirmada via `information_schema.columns`
- Slugs de `produtos`: confirmados (`brioche`, `ciabatta`, `focaccia`, `integral`, `multigraos`, `original`)
- Nomes em `etapas_receita.nome`: confirmados (`Autólise`, `Batimento`, `Falsa dobra`, `Dobras`, `Descanso e divisão`, `Shape`, `2ª fermentação`)
- Funções `is_admin()`, `set_updated_at()`, `fork_versao_receita()`, `ativar_versao_receita()`: confirmadas existentes
- Enum `weekly_order_status`: valores `rascunho`, `confirmado`

---

## 0. Como usar este briefing

Briefing de **schema + sequência de implementação**. UI descrita em alto nível por módulo; cada etapa de UI ganha briefing detalhado próprio na hora de implementar.

Antes de começar a Etapa 0 (schema), Claude Code deve:

1. Ler este documento inteiro.
2. Ler `CORA_Operacao_Rotina_v1.md` no project knowledge.
3. Ler `PORTAL_STATUS.md` do repo `cora-backoffice` (estado atual da Fase 0).
4. Confirmar que `main` tem Fase 0 mergeada.
5. Criar branch `fase-1-schema` antes de qualquer migration.

---

## 1. Objetivo da Fase 1

Núcleo operacional do Backoffice — ciclo semanal do cardápio à produção concluída.

Ao fim da Fase 1:

- **Cardápio da semana**: Hugo marca rotativos por semana (Base e Fixos automáticos).
- **Visão semanal**: dashboard com previsão e realizado de pães, massa, levain, entregas.
- **Produção dia a dia**: terça (levain + prep + mise en place), quarta (autólise → shape), quinta (cocção).
- **Pedidos pontuais**: cadastro de pães de presente / institucionais que entram na produção.

Produção real começa em junho/julho (forno deck 16/jun). Fase 1 entrega o sistema **antes** dessa virada.

---

## 2. Escopo

### Dentro

- **Migrations 0007 a 0013** (7 arquivos).
- **Módulo Semana** (com sub-tela provisória de cardápio embutida).
- **Módulo Produção** (terça, quarta, quinta — cocção como `etapas_producao` tipo `coccao`).
- **Módulo Pedidos pontuais** (CRUD mínimo).

### Fora desta fase (Fase 2+)

- Módulo Planejamento completo (versão atual fica embutida em Semana).
- Módulo Expedição (etiquetagem térmica, roteirização).
- Módulo Receitas com UI de edição.
- Tabela `fornadas` dedicada.
- Coluna de saldo por lote.
- Tela dedicada de Recebimento (modal inline em Produção resolve).
- Notificação ativa de estoque mínimo / validade próxima.
- Webhook Asaas pros pontuais (registro manual no MVP).

### Tabelas existentes a consumir (não recriar)

Criadas pelo Portal antes da regra de ownership. Backoffice **só lê** via policies admin (migration 0007):

- `app_settings` — singleton com flags
- `capacity_waitlist` — fila de espera por capacidade
- `weekly_orders` — peça central, agrega pedidos da semana por assinante

---

## 3. Schema confirmado contra o banco real

Tudo abaixo foi validado contra o Supabase em produção (project ref `kjzuvmhedicxbuynfqev`) em 18/mai/2026:

### Tabelas pt-BR (Backoffice, da Fase 0)

| Tabela | Notas relevantes |
|---|---|
| `produtos` | Tem `slug`, `nome`, `tipo` (enum `produto_tipo`: `fabricado`/`revenda`), `unidade`, `formato`, `peso_alvo_g`, `preco_avulso numeric`, `ativo bool`. **NÃO tem `tipo_cardapio`** — será adicionado em 0009. |
| `receitas` | FK pra `produtos`. Tem `versao_ativa_id` (ponteiro), `grupo_sugerido smallint DEFAULT 2`, `formato`. **`grupo_sugerido` JÁ EXISTE** — não precisa criar. Seed em 0009. |
| `versoes_receita` | FK pra `receitas`. Tem `numero_versao`, `status`, `hidratacao_alvo`, `peso_massa_g int`, `perda_coccao`. **`peso_massa_g` é peso da massa por unidade** (ex: 615g pro Original 615g). |
| `etapas_receita` | FK pra `versoes_receita`. Tem `ordem`, `nome text`, `duracao_min`, `notas`. **Não tem `tipo` enum** — será adicionado via ALTER em 0012. |
| `ingredientes` | Tem `slug`, `nome`, `unidade text DEFAULT 'g'`, `preco_por_kg`, `fornecedor_id`. **NÃO tem colunas de estoque** — `quantidade_atual_g`, `quantidade_minima_g` adicionadas via ALTER em 0008. |
| `ingredientes_receita` | Bridge `versao_receita_id` × `ingrediente_id` com `percentual_baker numeric`, `ordem`, `notas`. **Armazena percentual baker, não gramas.** |
| `fornecedores` | Existe. FK alvo de `ingredientes` e `lotes_insumo`. |
| `planos` | Existe. |
| `plan_produtos` | Bridge planos × produtos. |

### Tabelas inglês (Portal, anteriores à regra)

| Tabela | Notas relevantes |
|---|---|
| `weekly_orders` | `delivery_date date NOT NULL`, `composition jsonb` (formato `{slug: qty}`, **pode ter qty=0**), `extras jsonb NOT NULL DEFAULT '[]'` (formato array `[{id, qty, nome, preco_unit}]`), `status weekly_order_status` (`rascunho`/`confirmado`). Link com `semanas` é por `delivery_date = semanas.data_entrega`. |
| `subscriptions` | Existente, não tocada nesta fase. |

### Funções já existentes (Fase 0)

| Função | Disponível |
|---|---|
| `is_admin()` | ✓ |
| `set_updated_at()` | ✓ |
| `fork_versao_receita(p_versao_origem_id uuid, p_status versao_receita_status)` | ✓ |
| `ativar_versao_receita(p_versao_id uuid)` | ✓ |

---

## 4. Decisões fechadas (referência rápida)

| # | Decisão | Resolução |
|---|---|---|
| 1 | Cardápio na Fase 1 | Sub-tela embutida em Semana. Comentário explícito de provisoriedade no código. |
| 2 | Quinta de produção | Dentro da Fase 1, **sem** tabela `fornadas`. Usa `etapas_producao` com `tipo='coccao'` e `ordem` pra sequência. |
| 3 | Grupo por receita | Coluna `receitas.grupo_sugerido smallint` já existe (1/2/3). Frontend mapeia → G1/G2/G3. Seed em 0009. |
| 4 | Contextos diagnósticos | Duas tabelas: `contextos_dia` (1 por semana+dia) e `contextos_producao` (1:1 com `producoes`). |
| 5 | Pagamento pontual | Enum `metodo_pagamento_enum` (pix, transferencia, boleto, asaas) + `referencia_externa text`. |
| 6 | Formatos JSONB | `weekly_orders.composition` é objeto `{slug: qty}` (aceita qty=0). `weekly_orders.extras` é array `[{id, qty, nome, preco_unit}]`. `pedidos_pontuais.composicao` segue o mesmo formato de `composition`. View 0013 lida com os dois formatos. |
| 7 | Tudo pt-BR | Novas tabelas e colunas em pt-BR. Tabelas do Portal (`weekly_orders`, `subscriptions`, etc.) permanecem em inglês. |
| 8 | Money | `numeric` (não `_cents`). Consistente com `produtos.preco_avulso` e `ingredientes.preco_por_kg` que já existem assim. |

---

## 5. Convenções de schema

- Tabelas e colunas em **pt-BR snake_case** (com exceção das tabelas pré-existentes do Portal).
- Timestamps sempre `created_at`, `updated_at`, sufixo `_at` (inglês mesmo em colunas pt-BR — convenção pré-existente do banco).
- IDs: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- FKs: nome da tabela referenciada no singular + `_id`. Ex: `semana_id`, `produto_id`.
- Enums com sufixo `_enum`. Ex: `metodo_pagamento_enum`, `etapa_tipo_enum`.
- Money: **`numeric`**, não `int cents`.
- Quantidades de insumo: **gramas como `numeric`**, sufixo `_g`. Ex: `quantidade_recebida_g`.
- Trigger `set_updated_at()` em toda tabela com `updated_at` (função já existe).
- `is_admin()` em todas as policies de Backoffice (função já existe).

---

## 6. Migrations da Fase 1

### Visão geral

| # | Arquivo | Propósito |
|---|---|---|
| 0007 | `0007_policies_admin_tabelas_portal.sql` | Policies admin pra ler tabelas do Portal. |
| 0008 | `0008_lotes_insumo.sql` | Tabela `lotes_insumo` + trigger + ALTER em `ingredientes`. |
| 0009 | `0009_alter_produtos_e_seed_grupos.sql` | Adiciona `produtos.tipo_cardapio` + seed em `receitas.grupo_sugerido`. |
| 0010 | `0010_semanas_e_cardapios.sql` | Tabelas `semanas` e `cardapios` + função `popular_cardapio_padrao()`. |
| 0011 | `0011_pedidos_pontuais.sql` | Tabela `pedidos_pontuais` + enum `metodo_pagamento_enum`. |
| 0012 | `0012_producao.sql` | Tabelas `producoes`, `contextos_dia`, `contextos_producao`, `etapas_producao` + enums + ALTER em `etapas_receita` + funções. |
| 0013 | `0013_view_planejamento_semana.sql` | View agregadora. |

### 0007 — Policies admin em tabelas do Portal

```sql
-- Tabelas alvo: app_settings, capacity_waitlist, weekly_orders
-- Garante RLS habilitado (idempotente — se já estiver, não falha)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_orders ENABLE ROW LEVEL SECURITY;

-- Policies admin de leitura
CREATE POLICY "admin_read_app_settings"
  ON app_settings FOR SELECT USING (is_admin());

CREATE POLICY "admin_read_capacity_waitlist"
  ON capacity_waitlist FOR SELECT USING (is_admin());

CREATE POLICY "admin_read_weekly_orders"
  ON weekly_orders FOR SELECT USING (is_admin());
```

**Notas:**
- Só leitura. Backoffice não escreve nessas tabelas (regra de ownership).
- Se o Portal já tiver policies admin em alguma delas, este migration falha por duplicação. **Claude Code: rodar antes de aplicar:**
  ```sql
  SELECT polname, polrelid::regclass FROM pg_policy
  WHERE polrelid::regclass::text IN ('app_settings','capacity_waitlist','weekly_orders');
  ```
  Se já existir policy com nome similar, ajustar a migration (DROP IF EXISTS + CREATE).

### 0008 — Lotes de insumo

```sql
-- Estoque em ingredientes (idempotente)
ALTER TABLE ingredientes
  ADD COLUMN IF NOT EXISTS quantidade_atual_g numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_minima_g numeric NOT NULL DEFAULT 0;

-- Tabela de lotes (minimalista — sem quantidade_restante)
CREATE TABLE lotes_insumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingrediente_id uuid NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
  fornecedor_id uuid REFERENCES fornecedores(id) ON DELETE SET NULL,
  identificador text NOT NULL,                  -- ex: "#2604-A"
  quantidade_recebida_g numeric NOT NULL CHECK (quantidade_recebida_g > 0),
  data_recebimento date NOT NULL,
  validade date,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lotes_insumo_ingrediente ON lotes_insumo(ingrediente_id);
CREATE INDEX idx_lotes_insumo_validade ON lotes_insumo(validade) WHERE validade IS NOT NULL;

ALTER TABLE lotes_insumo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_lotes_insumo"
  ON lotes_insumo FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_lotes_insumo_updated_at
  BEFORE UPDATE ON lotes_insumo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: lote recebido soma em quantidade_atual_g
CREATE OR REPLACE FUNCTION fn_lote_recebido_soma_estoque()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ingredientes
  SET quantidade_atual_g = quantidade_atual_g + NEW.quantidade_recebida_g,
      updated_at = now()
  WHERE id = NEW.ingrediente_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lote_recebido_soma_estoque
  AFTER INSERT ON lotes_insumo
  FOR EACH ROW EXECUTE FUNCTION fn_lote_recebido_soma_estoque();
```

**Notas:**
- Sem `quantidade_restante_g` por lote (decisão da rodada de insumos). Baixa de estoque na produção é UPDATE direto em `ingredientes.quantidade_atual_g`.
- `data_recebimento` é input do operador (modal inline em Produção).
- `validade` opcional (sharpie em fita crepe documenta na prática).

### 0009 — Alter produtos + seed de grupos

```sql
-- Tipo de cardápio
CREATE TYPE tipo_cardapio_enum AS ENUM ('base','fixo','rotativo');

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS tipo_cardapio tipo_cardapio_enum;

-- Seed dos tipos de cardápio (slugs reais a confirmar)
-- Hipótese: slugs no banco são 'original', 'integral', 'focaccia', 'multigraos', 'brioche', 'ciabatta'
-- Se forem diferentes (ex: 'pao_original'), ajustar antes de rodar
UPDATE produtos SET tipo_cardapio = 'base'
  WHERE slug IN ('original','integral') AND ativo = true;
UPDATE produtos SET tipo_cardapio = 'rotativo'
  WHERE slug IN ('focaccia','multigraos','brioche','ciabatta') AND ativo = true;
-- 'fixo' fica sem default — Hugo marca via UI quando algum produto virar "sempre disponível como extra"

-- Seed dos grupos das receitas (corrige defaults — todos vêm como 2)
-- Pela coluna receitas.grupo_sugerido (smallint, default 2):
--   1 = G1 (frio - Focaccia)
--   2 = G2 (ferm. longa - Original)  [default já cobre]
--   3 = G3 (simples - Integral, Multigrãos)
UPDATE receitas SET grupo_sugerido = 1
  WHERE produto_id IN (SELECT id FROM produtos WHERE slug = 'focaccia');
UPDATE receitas SET grupo_sugerido = 3
  WHERE produto_id IN (SELECT id FROM produtos WHERE slug IN ('integral','multigraos'));
-- 'original' fica como default 2
-- 'brioche' e 'ciabatta' permanecem com default — decisão técnica com Alex em sessão futura
```

**Notas:**
- `produtos.tipo_cardapio` é o gatilho da função `popular_cardapio_padrao()` em 0010.
- Decisão de marcar "Pão Integral" como `base` reflete a memória atual ("Original e Integral são base imutável"). Se for só Original na base, ajustar.
- Brioche e Ciabatta não estão no MVP de lançamento (memória cita 6 produtos no portfólio, mas portfólio de lançamento foco em 4-5).

### 0010 — Semanas e cardápios

```sql
CREATE TABLE semanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL,
  ano int NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  data_entrega date NOT NULL,
  data_corte timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aberta','congelada','concluida')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero, ano)
);

CREATE INDEX idx_semanas_data_entrega ON semanas(data_entrega);
CREATE INDEX idx_semanas_status ON semanas(status);

ALTER TABLE semanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_semanas"
  ON semanas FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_semanas_updated_at
  BEFORE UPDATE ON semanas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cardápios — snapshot da semana
CREATE TABLE cardapios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id uuid NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo tipo_cardapio_enum NOT NULL,             -- snapshot do tipo no momento da publicação
  preco_avulso numeric NOT NULL,                -- snapshot do preço
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semana_id, produto_id)
);

CREATE INDEX idx_cardapios_semana ON cardapios(semana_id);

ALTER TABLE cardapios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_cardapios"
  ON cardapios FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Função: popula cardápio padrão (base + fixo) ao abrir semana
CREATE OR REPLACE FUNCTION popular_cardapio_padrao(p_semana_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO cardapios (semana_id, produto_id, tipo, preco_avulso)
  SELECT p_semana_id, p.id, p.tipo_cardapio, p.preco_avulso
  FROM produtos p
  WHERE p.tipo_cardapio IN ('base','fixo')
    AND p.ativo = true
    AND p.preco_avulso IS NOT NULL
  ON CONFLICT (semana_id, produto_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
```

**Notas:**
- Snapshot de preço (`cardapios.preco_avulso`) protege contra reajustes retroativos.
- Função é chamada explicitamente — sem trigger silencioso.
- Status `rascunho` → semana criada mas não aberta. `aberta` → operando (assinantes podem editar weekly_orders). `congelada` → pós-corte de terça. `concluida` → pós-entrega de quinta.

### 0011 — Pedidos pontuais

```sql
CREATE TYPE metodo_pagamento_enum AS ENUM (
  'pix',
  'transferencia',
  'boleto',
  'asaas'
);

CREATE TABLE pedidos_pontuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id uuid NOT NULL REFERENCES semanas(id) ON DELETE RESTRICT,

  -- Classificação
  motivo text NOT NULL
    CHECK (motivo IN ('presente','institucional','outros')),
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','confirmado','entregue','cancelado')),

  -- Pagador
  pagador_nome text NOT NULL,
  pagador_email text,
  pagador_whatsapp text,
  pagador_cpf_cnpj text,

  -- Destinatário (nullable se igual ao pagador)
  destinatario_nome text,
  destinatario_whatsapp text,

  -- Endereço de entrega
  endereco_cep text NOT NULL,
  endereco_rua text NOT NULL,
  endereco_numero text NOT NULL,
  endereco_complemento text,
  endereco_bairro text NOT NULL,
  endereco_cidade text NOT NULL,
  endereco_estado text NOT NULL,

  -- Composição (mesmo formato de weekly_orders.composition: { slug: qty })
  composicao jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Pagamento
  metodo_pagamento metodo_pagamento_enum,
  referencia_externa text,
  valor_total numeric,

  observacoes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmado_at timestamptz,
  entregue_at timestamptz
);

CREATE INDEX idx_pedidos_pontuais_semana ON pedidos_pontuais(semana_id);
CREATE INDEX idx_pedidos_pontuais_status ON pedidos_pontuais(status);

ALTER TABLE pedidos_pontuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_pedidos_pontuais"
  ON pedidos_pontuais FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_pedidos_pontuais_updated_at
  BEFORE UPDATE ON pedidos_pontuais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Notas:**
- `valor_total numeric` (não `_cents`) — consistente com `produtos.preco_avulso`.
- `metodo_pagamento` nullable — só preenchido quando `status = 'confirmado'`.
- `composicao` jsonb usa mesmo formato de `weekly_orders.composition` pra view 0013 fazer UNION sem normalizar.

### 0012 — Produção

```sql
-- Enums
CREATE TYPE etapa_status_enum AS ENUM (
  'aguardando',
  'em_curso',
  'concluida',
  'pulada'
);

CREATE TYPE etapa_tipo_enum AS ENUM (
  'autolise_mistura',
  'batimento',
  'falsa_dobra',
  'dobra',
  'pre_shape',
  'shape',
  'descanso',
  'fermentacao_final',
  'coccao'
);

CREATE TYPE producao_status_enum AS ENUM (
  'planejada',
  'em_curso',
  'concluida',
  'cancelada'
);

-- ALTER em etapas_receita: adiciona tipo enum
-- Permite popular_etapas_producao() copiar tipo direto sem parsing de nome
ALTER TABLE etapas_receita
  ADD COLUMN IF NOT EXISTS tipo etapa_tipo_enum;

-- Seed do tipo (nomes confirmados via SELECT DISTINCT nome FROM etapas_receita em 18/mai)
UPDATE etapas_receita SET tipo = 'autolise_mistura'  WHERE nome = 'Autólise';
UPDATE etapas_receita SET tipo = 'batimento'         WHERE nome = 'Batimento';
UPDATE etapas_receita SET tipo = 'falsa_dobra'       WHERE nome = 'Falsa dobra';
UPDATE etapas_receita SET tipo = 'dobra'             WHERE nome = 'Dobras';
UPDATE etapas_receita SET tipo = 'pre_shape'         WHERE nome = 'Descanso e divisão';
UPDATE etapas_receita SET tipo = 'shape'             WHERE nome = 'Shape';
UPDATE etapas_receita SET tipo = 'fermentacao_final' WHERE nome = '2ª fermentação';
-- Cocção não vive em etapas_receita — adicionada por popular_etapas_producao() (decisão de produção, não receita técnica)

-- Produções (1 por semana × versao_receita)
CREATE TABLE producoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id uuid NOT NULL REFERENCES semanas(id) ON DELETE RESTRICT,
  versao_receita_id uuid NOT NULL REFERENCES versoes_receita(id) ON DELETE RESTRICT,

  -- Multiplicador da receita (1× = receita-base na masseira)
  multiplicador numeric NOT NULL DEFAULT 1.0,

  -- Previsto
  qty_paes_prevista int,
  massa_prevista_kg numeric,
  levain_previsto_kg numeric,

  -- Realizado (input pós-produção)
  qty_paes_realizada int,
  massa_realizada_kg numeric,
  levain_consumido_kg numeric,

  status producao_status_enum NOT NULL DEFAULT 'planejada',

  iniciada_at timestamptz,
  concluida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (semana_id, versao_receita_id)
);

CREATE INDEX idx_producoes_semana ON producoes(semana_id);
CREATE INDEX idx_producoes_status ON producoes(status);

ALTER TABLE producoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_producoes"
  ON producoes FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_producoes_updated_at
  BEFORE UPDATE ON producoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Contexto do dia (1 por semana × dia)
CREATE TABLE contextos_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id uuid NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  dia text NOT NULL CHECK (dia IN ('terca','quarta','quinta')),

  lote_farinha_principal_id uuid REFERENCES lotes_insumo(id),
  ultimo_refresh_levain_at timestamptz,
  temp_ambiente_max_c numeric,

  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (semana_id, dia)
);

ALTER TABLE contextos_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_contextos_dia"
  ON contextos_dia FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_contextos_dia_updated_at
  BEFORE UPDATE ON contextos_dia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Contexto local de cada produção
CREATE TABLE contextos_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id uuid NOT NULL UNIQUE REFERENCES producoes(id) ON DELETE CASCADE,

  hidratacao_ajustada_pct numeric,
  temp_agua_autolise_c numeric,
  temp_massa_pos_batimento_c numeric,

  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contextos_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_contextos_producao"
  ON contextos_producao FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_contextos_producao_updated_at
  BEFORE UPDATE ON contextos_producao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Etapas de execução (espelha etapas_receita mas com timestamps)
-- Cocção entra como etapa tipo='coccao' (sem tabela fornadas separada)
CREATE TABLE etapas_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_id uuid NOT NULL REFERENCES producoes(id) ON DELETE CASCADE,
  etapa_receita_id uuid REFERENCES etapas_receita(id) ON DELETE SET NULL,
                                                -- link de origem (pode ser NULL pra etapas ad-hoc)
  ordem int NOT NULL,
  tipo etapa_tipo_enum NOT NULL,
  status etapa_status_enum NOT NULL DEFAULT 'aguardando',

  -- Tempo
  prevista_at timestamptz,
  iniciada_at timestamptz,
  concluida_at timestamptz,

  -- Campos opcionais por tipo
  dobra_numero int,                             -- pra tipo='dobra'
  temp_c numeric,                               -- T° água autólise / T° massa batimento

  -- Detalhes específicos em JSONB (catch-all)
  detalhes jsonb DEFAULT '{}'::jsonb,
  -- coccao: { qty_paes, base_c, teto_c, duracao_min, fornada_num, fornada_total }
  -- shape:  { peso_medio_g, recipiente: 'banneton'|'couche'|'tabuleiro' }

  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (producao_id, ordem)
);

CREATE INDEX idx_etapas_producao_producao ON etapas_producao(producao_id, ordem);
CREATE INDEX idx_etapas_status_ativas ON etapas_producao(status) WHERE status IN ('aguardando','em_curso');

ALTER TABLE etapas_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_etapas_producao"
  ON etapas_producao FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_etapas_producao_updated_at
  BEFORE UPDATE ON etapas_producao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Função: popular etapas de uma produção a partir do template em etapas_receita
-- Cocção é adicionada ao final (não vive em etapas_receita — decisão de produção)
CREATE OR REPLACE FUNCTION popular_etapas_producao(p_producao_id uuid)
RETURNS void AS $$
DECLARE
  v_max_ordem int;
BEGIN
  -- 1. Copia etapas do template (etapas_receita)
  INSERT INTO etapas_producao (producao_id, etapa_receita_id, ordem, tipo, notas)
  SELECT
    p_producao_id,
    er.id,
    er.ordem,
    COALESCE(er.tipo, 'autolise_mistura'),       -- fallback defensivo
    er.notas
  FROM etapas_receita er
  JOIN producoes p ON p.versao_receita_id = er.versao_receita_id
  WHERE p.id = p_producao_id
  ORDER BY er.ordem
  ON CONFLICT (producao_id, ordem) DO NOTHING;

  -- 2. Adiciona cocção ao final (não vive em etapas_receita)
  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
  FROM etapas_producao WHERE producao_id = p_producao_id;

  INSERT INTO etapas_producao (producao_id, ordem, tipo)
  VALUES (p_producao_id, v_max_ordem, 'coccao')
  ON CONFLICT (producao_id, ordem) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Função: peso de farinha por pão (a partir da soma dos baker percentages)
-- Lógica: farinha = 100% baker. Soma dos baker % = total relativo à farinha.
-- peso_farinha = peso_massa / (soma_baker_pct / 100)
CREATE OR REPLACE FUNCTION peso_farinha_por_pao(p_versao_id uuid)
RETURNS numeric AS $$
DECLARE
  v_peso_massa numeric;
  v_soma_baker numeric;
BEGIN
  SELECT peso_massa_g INTO v_peso_massa
  FROM versoes_receita WHERE id = p_versao_id;

  SELECT COALESCE(SUM(percentual_baker), 0) INTO v_soma_baker
  FROM ingredientes_receita WHERE versao_receita_id = p_versao_id;

  IF v_soma_baker = 0 OR v_peso_massa IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_peso_massa / (v_soma_baker / 100.0);
END;
$$ LANGUAGE plpgsql;

-- Função: mise en place agregado por ingrediente (qty total em g) pra uma semana
-- Retorna por ingrediente_id e por receita (pra breakdown do wireframe)
CREATE OR REPLACE FUNCTION mise_en_place_semana(p_semana_id uuid)
RETURNS TABLE (
  ingrediente_id uuid,
  ingrediente_nome text,
  produto_id uuid,
  produto_nome text,
  qty_g numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.nome,
    pr.id,
    pr.nome,
    SUM(
      peso_farinha_por_pao(p.versao_receita_id) * (ir.percentual_baker / 100.0)
      * p.qty_paes_prevista
    ) AS qty_g
  FROM producoes p
  JOIN versoes_receita vr ON vr.id = p.versao_receita_id
  JOIN ingredientes_receita ir ON ir.versao_receita_id = vr.id
  JOIN ingredientes i ON i.id = ir.ingrediente_id
  JOIN receitas r ON r.id = vr.receita_id
  JOIN produtos pr ON pr.id = r.produto_id
  WHERE p.semana_id = p_semana_id
    AND p.qty_paes_prevista IS NOT NULL
  GROUP BY i.id, i.nome, pr.id, pr.nome;
END;
$$ LANGUAGE plpgsql;
```

**Notas:**
- `etapas_producao.etapa_receita_id` é ponteiro nullable de origem (não FK rígida). Permite etapas ad-hoc adicionadas durante a produção (ex: cocção, que é inserida pela função `popular_etapas_producao()` sem referência ao template).
- `peso_farinha_por_pao()` e `mise_en_place_semana()` são as funções que alimentam a tela Mise en Place do wireframe.
- Pré-população: ao criar uma `producao`, o front chama `popular_etapas_producao(prod_id)`. A função copia o template + adiciona cocção ao final.
- **Cocção não vive em `etapas_receita`** — é decisão de produção (qty de fornadas depende do volume da semana), não de receita técnica. Múltiplas fornadas por receita (Original 45 → 2 fornadas de 23+22) ficam como responsabilidade do frontend: após chamar `popular_etapas_producao()`, o frontend faz INSERT de fornadas adicionais como `etapas_producao` com `tipo='coccao'` e `ordem` incremental.
- **`falsa_dobra` como etapa própria** — vocabulário técnico da escola italiana (escola onde Hugo se formou). Banco preserva como etapa distinta. O wireframe original tratava como nota textual dentro do Batimento — frontend pode renderizar colapsada visualmente, mas o schema mantém a separação semântica.
- **`fermentacao_final` distinto de `descanso`** — `descanso` cobre descansos curtos entre dobras (bench rest); `fermentacao_final` cobre o proof pós-shape (1-3h no banneton/couche). Distinção semântica útil pra analytics futuros (ex: "tempo médio de fermentação final por receita por semana").

### 0013 — View planejamento_semana

```sql
CREATE OR REPLACE VIEW planejamento_semana AS
WITH
  -- 1. Composição das weekly_orders confirmadas (formato { slug: qty })
  recorrentes_base AS (
    SELECT
      s.id AS semana_id,
      elem.key AS slug,
      (elem.value)::int AS qty
    FROM weekly_orders w
    JOIN semanas s ON w.delivery_date = s.data_entrega
    CROSS JOIN LATERAL jsonb_each_text(w.composition) AS elem
    WHERE w.status = 'confirmado'
      AND (elem.value)::int > 0                  -- ignora qty=0 (item removido)
  ),
  -- 2. Extras das weekly_orders (formato [{ id, qty, ... }])
  recorrentes_extra AS (
    SELECT
      s.id AS semana_id,
      (elem->>'id') AS slug,
      (elem->>'qty')::int AS qty
    FROM weekly_orders w
    JOIN semanas s ON w.delivery_date = s.data_entrega
    CROSS JOIN LATERAL jsonb_array_elements(w.extras) AS elem
    WHERE w.status = 'confirmado'
      AND (elem->>'qty')::int > 0
  ),
  -- 3. Pedidos pontuais (formato { slug: qty })
  pontuais AS (
    SELECT
      p.semana_id,
      elem.key AS slug,
      (elem.value)::int AS qty
    FROM pedidos_pontuais p
    CROSS JOIN LATERAL jsonb_each_text(p.composicao) AS elem
    WHERE p.status = 'confirmado'
      AND (elem.value)::int > 0
  ),
  -- Unificado
  unified AS (
    SELECT semana_id, slug, qty, 'recorrente_base' AS origem FROM recorrentes_base
    UNION ALL
    SELECT semana_id, slug, qty, 'recorrente_extra' FROM recorrentes_extra
    UNION ALL
    SELECT semana_id, slug, qty, 'pontual' FROM pontuais
  )
SELECT
  semana_id,
  slug,
  SUM(qty) AS qty_total,
  COALESCE(SUM(qty) FILTER (WHERE origem = 'recorrente_base'),  0) AS qty_recorrente_base,
  COALESCE(SUM(qty) FILTER (WHERE origem = 'recorrente_extra'), 0) AS qty_recorrente_extra,
  COALESCE(SUM(qty) FILTER (WHERE origem = 'pontual'),          0) AS qty_pontual
FROM unified
GROUP BY semana_id, slug;
```

**Notas:**
- View read-only. Se ficar lenta com volume, vira `MATERIALIZED VIEW` com refresh manual (não fazer agora).
- Considerar índice `weekly_orders(delivery_date, status)` se perf degradar.
- Quebra qty por origem (base/extra/pontual) — útil pra debug e pro Estado A do wireframe de Semana mostrar "45 base + 2 pontuais = 47 Original".

---

## 7. Sequência de implementação

### Etapa 0 — Schema completo

**Branch:** `fase-1-schema`

Aplicar as 7 migrations em sequência via `supabase db push`.

**Validação:**
- `supabase migration list` mostra 0007 a 0013 como `applied`.
- `\d` mostra todas as novas tabelas com policies habilitadas.
- Funções callable via SQL Editor: `popular_cardapio_padrao()`, `popular_etapas_producao()`, `peso_farinha_por_pao()`, `mise_en_place_semana()`.
- View `planejamento_semana` retorna `0 rows` sem erro.
- Trigger de `lotes_insumo`: INSERT manual de teste atualiza `ingredientes.quantidade_atual_g`.

**Antes de mergear:**
- Smoke test em Vercel Preview do Backoffice (build não pode quebrar).
- Confirmar que Portal continua funcionando (login + dashboard).

**Merge:** branch → main após validação.

### Etapa 1 — Módulo Semana

**Branch:** `fase-1-semana`

UI conforme `Cora_Backoffice_-_Semana_wireframes_v5.html` (Estados A/B/C × Desktop/Mobile).

Componentes:

- **Lista de semanas** (`/semanas`): tabela simples filtrável por status.
- **Criar semana** (modal ou `/semanas/nova`): inputs de numero/ano/datas. Ao criar com `status='aberta'`, chamar `popular_cardapio_padrao()`.
- **Detalhe** (`/semanas/:id`): renderiza Estado A/B/C conforme tempo:
  - Hoje < `data_corte` → A (qty com `~`)
  - `data_corte` ≤ hoje ≤ `data_entrega` → B (qty definitiva)
  - hoje > `data_entrega` → C (delta realizado vs previsto)
- **Sub-tela de cardápio**: aba dentro do detalhe. Lista produtos por tipo, toggle rotativo, CTA "Publicar" muda status pra `congelada`.

**Estado A:**
- Cards de previsão: `SELECT slug, qty_total FROM planejamento_semana WHERE semana_id = :id`
- Massa prevista: `SUM(peso_massa_g × qty_paes_prevista)` por receita
- Levain previsto: ~10-12% da massa total

**Estado B — coluna "Etapa agora":**
- LEFT JOIN com `etapas_producao` da `producoes` daquela receita.
- Regra: `concluida_at IS NULL AND iniciada_at > now() - interval '2 hours'` → mostra etapa atual; > 2h → "em produção"; sem etapa → "aguardando".

**Comentário obrigatório no código** da sub-tela de cardápio:

```typescript
/**
 * PROVISÓRIO — Fase 1
 *
 * Esta sub-tela de cardápio vive aqui porque o módulo Planejamento completo
 * só entra na Fase 3/4. Quando Planejamento existir como módulo separado
 * (rota /planejamento), esta seção é removida e substituída por link
 * "Editar cardápio →" pra /planejamento/:semana_id.
 *
 * Briefing original: CORA_Briefing_Backoffice_Fase1_Schema_v3.md (Decisão #1)
 * Wireframe definitivo do Planejamento: Planejamento_wireframes_v2.html
 */
```

**Critério de pronto:**
- Criar semana 22 (25-31 mai 2026) com 1 rotativo marcado.
- Estado A renderiza previsão (zerada até existir weekly_order confirmado — testar com 1-2 inserts manuais).
- Cardápio publicável.
- Mobile renderiza sem quebras.

### Etapa 2 — Módulo Produção

**Branch:** `fase-1-producao`

UI conforme `Cora_Backoffice_-_Produc_a_o_wireframes_v5_3.html`.

**TER (pré-produção):**
- Calculadora de Levain: componente frontend puro. Inputs: meta_autolise_kg, sobra_desejada_g. Outputs: isca/água/farinha (1:2:2). Salvar valores como nota em `contextos_dia.notas` (provisório).
- Mise en place agrupado: `SELECT * FROM mise_en_place_semana(:id) ORDER BY ingrediente_nome` → renderizar com breakdown por receita e total.
- Checklist de prep: lista hardcoded de 5 itens. Estado local, não persiste no banco (Fase 1).

**QUA (em produção):**
- Seção Contexto do Dia: form de `contextos_dia` (lote farinha → dropdown de `lotes_insumo` ativos, `ultimo_refresh_levain_at`, `temp_ambiente_max_c`, `notas`).
- Lista de Receitas: linhas com produto, grupo (mapear smallint → "G1/G2/G3"), qty, massa, etapa atual.
- Side panel (desktop) / rota full-screen (mobile): ficha técnica com etapas de `etapas_producao`. Botão `iniciar`/`concluir` por etapa. Dobras com contador.
- "Falsa dobra" no Batimento: texto livre em `etapas_producao.notas`.

**QUI (cocção):**
- Lista de fornadas: `SELECT * FROM etapas_producao WHERE tipo='coccao' AND producao_id IN (...) ORDER BY prevista_at`.
- Pré-populadas pela função `popular_etapas_producao()` no momento da criação da `producao`. Se Original tem qty > 23, popular 2 fornadas (lógica no frontend: dividir em chunks de 23 max).
- Cada fornada: botão "iniciar" registra `iniciada_at`, "concluir" registra `concluida_at`. `detalhes jsonb` armazena base_c/teto_c/duracao_min.

**Critério de pronto:**
- Rodar uma semana mock inteira na UI: contextos de terça, etapas de QUA, cocção QUI.
- Cada etapa muda status no banco (verificar via SELECT).
- Mobile usável (hit targets ≥40px).
- "Concluir produção" fecha `producoes.status='concluida'` e `semanas.status='concluida'`.

### Etapa 3 — Pedidos pontuais

**Branch:** `fase-1-pontuais`

UI minimalista, sem wireframe formal:

- `/pontuais` — lista paginada filtrável por semana e status.
- `/pontuais/novo` — form de criação.
- `/pontuais/:id` — detalhe + edição + ações "marcar como confirmado / entregue".

Sem refinamento visual. Hugo cria poucos por mês.

**Critério de pronto:**
- Criar 1 pedido pontual de teste pra semana 22.
- `status='rascunho'` → não aparece em `planejamento_semana`.
- `status='confirmado'` → entra na view, aparece no Estado A da Semana com qty correta.

---

## 8. Pendências e TBDs (residuais)

**Resolvidos em 18/mai (não há mais ação pendente):**
- ~~Slugs reais de `produtos`~~ → confirmados: `brioche`, `ciabatta`, `focaccia`, `integral`, `multigraos`, `original`.
- ~~Nomes em `etapas_receita.nome`~~ → confirmados: `Autólise`, `Batimento`, `Falsa dobra`, `Dobras`, `Descanso e divisão`, `Shape`, `2ª fermentação`. Seed em 0012 usa match exato.

**Em aberto (não bloqueia a Fase 1):**

1. **Grupos definitivos G1/G2/G3** — sessão futura com Alex (`/master-baker` skill) pra validar critérios. Por ora, seed em 0009 reflete wireframe (Focaccia=1, Original=2, Integral/Multigrãos=3).
2. **Brioche e Ciabatta** — `tipo_cardapio` está `rotativo` por default. `grupo_sugerido` fica em `2` (default da coluna). Ajustar quando virarem parte do portfólio ativo de lançamento.
3. **Fornadas múltiplas por receita** — lógica de dividir Original 45 → 2 fornadas de 23+22 fica no frontend ao chamar `popular_etapas_producao()`. Refatorar pra função SQL se virar dor.
4. **`capacity_waitlist`** — Backoffice lê só pra exibir count (sem operação). Decisão de operação da fila fica pra fase futura.
5. **Asaas webhook** — pontuais com `metodo_pagamento='asaas'` são registro manual. Webhook fica pra Fase Financeira.

---

## 9. Pós-Fase 1

Atualizar ao fechar:

- `PORTAL_STATUS.md` do repo Backoffice.
- ClickUp:
  - Task "Backoffice Fase 1" marcada ✓
  - Criar task "Backoffice Fase 2 — Expedição"
  - Criar task "Master Baker — validar grupos G1/G2/G3"
- Commit final ASCII-only: `feat(backoffice): close phase 1 - semana producao pontuais`

---

## 10. Anexos referenciados

- `Cora_Backoffice_-_Semana_wireframes_v5.html` — wireframe definitivo módulo Semana.
- `Cora_Backoffice_-_Produc_a_o_wireframes_v5_3.html` — wireframe definitivo módulo Produção.
- `CORA_Backoffice_Spec_Consolidada_v2.md` — spec geral (referência).
- `CORA_Operacao_Rotina_v1.md` — rotina operacional semanal.

---

## 11. Princípios reforçados

- **Briefing antes de código.** Não inferir decisões — voltar pro briefing.
- **Schema só via Backoffice.** Sem exceção.
- **Mobile-first em telas operacionais.** Hit targets ≥40px na bancada.
- **YAGNI honesto.** Sub-tela de cardápio em Semana é exemplo: vive ali até virar dor o suficiente pra justificar módulo Planejamento completo.
- **Validar em Vercel Preview** antes de mergear cada branch.
- **ASCII-only em commits.**
- **Squash merge** via GitHub UI ao fechar cada branch.
