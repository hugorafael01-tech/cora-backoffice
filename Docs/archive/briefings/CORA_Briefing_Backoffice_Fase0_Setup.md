# CORA — Briefing técnico Fase 0 do Backoffice (Setup + Catálogo + Receitas)

**Data:** 10/mai/2026
**Origem:** sessão Claude Chat 10/mai/2026, decisões registradas em ClickUp task `86e1aec4w`.
**Destinatário:** Claude Code, executando no VS Code.
**Objetivo da Fase 0:** subir o esqueleto do `cora-backoffice` rodando em `admin.acora.com.br` com auth funcional, schema operacional do banco aplicado, e seed do catálogo + receitas iniciais. **Sem UI de módulos ainda.** UI dos módulos vem nas Fases 1+.

> **Princípio da colaboração:** não decidir nada que não esteja neste briefing. Em caso de ambiguidade, perguntar antes de implementar. Briefing primeiro, código depois.

---

## 1. Decisões já tomadas (não re-decidir)

| Item | Decisão |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind |
| Cliente do banco | `@supabase/supabase-js` (não Drizzle — TCP no browser não funciona) |
| Tipagem | Tipos TS gerados via `supabase gen types typescript` (não escritos à mão) |
| Auth | Supabase Auth com magic link |
| Banco | Mesmo projeto Supabase do Portal (não criar projeto novo) |
| Migrations | SQL puro em `supabase/migrations/`. Supabase CLI gerencia. |
| Idioma | Tabelas e colunas em português. Timestamps e enums técnicos pré-existentes ficam em inglês. |
| Hospedagem | Vercel em `admin.acora.com.br` |
| Repositório | Repo NOVO `cora-backoffice` (não monorepo) |

---

## 2. O que JÁ existe no Supabase (não duplicar)

Schema atual do banco (criado pela Fase 7 do Portal, migration `0001_initial.sql`):

- **Tabelas:** `subscriptions`, `coverage_waitlist`, `coverage_whitelist`
- **Enum:** `subscription_status` (`pending_payment`, `active`, `paused`, `cancelled`)
- **Função:** `set_updated_at()` (trigger genérico — REUSAR em todas as novas tabelas)
- **Extension:** `pgcrypto` (já habilitada — `gen_random_uuid()` disponível)
- **RLS:** as 3 tabelas existentes têm policy "deny all" para `public`. Acesso só via service role (server-side do Portal).

**Convenções herdadas do Portal:**

- Tabelas em snake_case, plural, em português
- Colunas em snake_case, em português
- Timestamps com `timestamptz`, default `NOW()`, padrão `created_at` + `updated_at`
- IDs em UUID com `gen_random_uuid()`
- Trigger `set_updated_at` em todas as tabelas com `updated_at`

---

## 3. Setup do repositório novo

### 3.1. Criar repo no GitHub

Nome: `cora-backoffice`
Visibilidade: privado
Owner: `hugorafael01-tech`

### 3.2. Inicializar projeto local

```bash
cd ~/Projects  # ou onde Hugo guarda os repos
npm create vite@latest cora-backoffice -- --template react-ts
cd cora-backoffice
npm install
```

### 3.3. Dependências

```bash
# Supabase + auth helpers
npm install @supabase/supabase-js

# Routing
npm install react-router-dom

# Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Tipos do banco (via Supabase CLI)
npm install -D supabase

# Utilitários
npm install clsx
```

### 3.4. Estrutura de pastas

```
cora-backoffice/
├── supabase/
│   └── migrations/
│       ├── 0001_initial.sql              # cópia do Portal (idempotência)
│       ├── 0002_admin_users.sql
│       ├── 0003_view_assinatura_itens.sql
│       ├── 0004_catalogo.sql
│       ├── 0005_receitas.sql
│       └── 0006_seed.sql
├── src/
│   ├── components/
│   │   ├── Layout.tsx
│   │   └── RequireAuth.tsx
│   ├── lib/
│   │   ├── supabase.ts                   # client init
│   │   └── database.types.ts             # GERADO via supabase CLI
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── AuthCallback.tsx
│   │   └── Home.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                          # Tailwind directives
├── Docs/
│   ├── CORA_Briefing_Backoffice_Fase0_Setup.md  # este arquivo
│   └── wireframes/                              # referência para Fases 1-4
│       ├── semana/
│       ├── planejamento/
│       ├── producao/
│       ├── expedicao/
│       └── receitas/
├── .env.example
├── .env.local                             # NÃO COMMITAR
├── .gitignore
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── tsconfig.json
```

### 3.5. `.env.example`

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-publica>
```

`.env.local` tem os valores reais. Pegar do Supabase Dashboard → Project Settings → API.

### 3.6. `.gitignore` (adicionar)

```
.env.local
.env.*.local
node_modules
dist
.DS_Store
```

### 3.7. Tailwind config

`tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cora Design System v1
        brand: {
          50: '#EEF2FF',
          100: '#DEE6FE',
          200: '#BDCAFD',
          500: '#2E55CD',  // Azul Cora oficial
          600: '#2548A8',
          700: '#1D3A85',
        },
        warm: {
          50: '#FAF8F5',   // background base
          100: '#F2EEE7',
          200: '#E5DFD3',
          600: '#3D3934',  // texto principal
          700: '#2A2723',
        },
      },
      fontFamily: {
        heading: ['"League Gothic"', 'sans-serif'],
        body: ['"Montagu Slab"', 'serif'],
      },
    },
  },
  plugins: [],
}
```

`src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-warm-50 text-warm-600 font-body;
}
```

---

## 4. Setup do Supabase CLI (para migrations e tipos)

### 4.1. Login e link

```bash
# Dentro do repo cora-backoffice
npx supabase login          # autentica com a conta do Hugo
npx supabase link --project-ref <project-ref>
```

`<project-ref>` é o ID do projeto Supabase (mesmo do Portal). Pegar do dashboard.

### 4.2. Sincronizar migration 0001 (do Portal)

A migration `0001_initial.sql` foi criada pelo Portal e já está aplicada no banco. Pra evitar problemas de sincronização:

1. **Copiar** o arquivo `0001_initial.sql` do repo `cora-portal/supabase/migrations/` pra `cora-backoffice/supabase/migrations/0001_initial.sql`. Sem alterações.
2. Rodar `npx supabase migration repair --status applied 0001`. Isso marca a 0001 como já aplicada no histórico do CLI sem re-executar.

A partir daqui, Backoffice é o único repo que cria novas migrations.

> **Importante:** o Portal NÃO deve mais criar migrations. Schema é gerenciado só pelo Backoffice. Comunicar isso à Mariane se ela mexer no Portal.

### 4.3. Scripts de package.json

Adicionar:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "db:push": "supabase db push",
    "db:types": "supabase gen types typescript --linked > src/lib/database.types.ts",
    "db:reset": "echo 'NÃO RODAR — base é compartilhada com Portal' && exit 1"
  }
}
```

`db:reset` está intencionalmente bloqueado. Reset de banco compartilhado destrói dados do Portal.

---

## 5. Migrations — código completo

> **Ordem importa.** Aplicar via `npm run db:push` na ordem.

### 5.1. `0002_admin_users.sql`

Tabela de admins + função `is_admin()` para uso em RLS policies.

```sql
-- ============================================================
-- Cora Backoffice — Migration 0002: admin_users
-- ============================================================

CREATE TABLE admin_users (
  email       TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Função helper para checar se o usuário autenticado é admin.
-- Usada em todas as RLS policies do Backoffice.
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE email = auth.jwt()->>'email'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: admin_users só pode ser lida por admins (referência circular resolvida 
-- por SECURITY DEFINER acima).
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users select" ON admin_users
  FOR SELECT TO authenticated
  USING (is_admin());

-- Seed inicial: Hugo. Trocar para hugo@acora.com.br quando o Workspace ativar.
INSERT INTO admin_users (email, nome) VALUES 
  ('hugorafael01@gmail.com', 'Hugo Rafael');
-- Se o email pessoal do Hugo for outro, ajustar antes de aplicar.
```

> **Hugo, antes de aplicar:** confirmar qual email vai usar inicialmente. Se for `hugo@acora.com.br` e o Workspace ainda não estiver ativo, magic link não chega — usar email pessoal por enquanto.

### 5.2. `0003_view_assinatura_itens.sql`

View live que desagrega o JSONB `subscriptions.itens` em rows queryáveis. Não materializada — sempre atualizada, sem manutenção.

```sql
-- ============================================================
-- Cora Backoffice — Migration 0003: view_assinatura_itens
-- ============================================================

-- Desagrega subscriptions.itens (JSONB no formato {slug: qty}) em rows.
-- Permite queries do tipo "quantos Originais ativos" sem mexer em JSONB.
CREATE VIEW v_assinatura_itens AS
SELECT 
  s.id          AS subscription_id,
  s.bairro,
  s.cidade,
  s.cep,
  s.status,
  produto_slug,
  quantidade::INT AS quantidade
FROM subscriptions s,
LATERAL jsonb_each_text(s.itens) AS t(produto_slug, quantidade)
WHERE quantidade::INT > 0;

-- RLS na view: herda da subscriptions (RLS de tabela base aplica).
-- Mas como subscriptions tem deny-all pra public, vamos adicionar 
-- policy de admin pra Backoffice ler.
CREATE POLICY "subscriptions admin read" ON subscriptions
  FOR SELECT TO authenticated
  USING (is_admin());
```

> **Nota:** isso adiciona uma policy NOVA na `subscriptions` (que já tinha "deny all"). RLS aplica policies em OR — admins podem ler, public não pode. Portal continua usando service role server-side (bypassa RLS). Backoffice usa anon key + JWT autenticado (passa pela RLS).

### 5.3. `0004_catalogo.sql`

Estrutura de catálogo: produtos, planos, plan_produtos, fornecedores, ingredientes.

```sql
-- ============================================================
-- Cora Backoffice — Migration 0004: catalogo
-- ============================================================

-- ============ ENUMS ============

CREATE TYPE produto_tipo AS ENUM ('fabricado', 'revenda');
CREATE TYPE produto_unidade AS ENUM ('un', 'kg');
CREATE TYPE produto_formato AS ENUM ('banneton', 'couche', 'tabuleiro', 'forma');
CREATE TYPE plan_produto_papel AS ENUM ('base', 'rotativa', 'extra');

-- ============ FORNECEDORES ============

CREATE TABLE fornecedores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  prazo_entrega_dias  INT,
  notas               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedores admin all" ON fornecedores
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ INGREDIENTES ============

CREATE TABLE ingredientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  nome            TEXT NOT NULL,
  unidade         TEXT NOT NULL DEFAULT 'g',
  preco_por_kg    NUMERIC(10,4),
  fornecedor_id   UUID REFERENCES fornecedores(id),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ingredientes_fornecedor_idx ON ingredientes(fornecedor_id);

CREATE TRIGGER ingredientes_set_updated_at
  BEFORE UPDATE ON ingredientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredientes admin all" ON ingredientes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ PRODUTOS ============

CREATE TABLE produtos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  nome            TEXT NOT NULL,
  tipo            produto_tipo NOT NULL DEFAULT 'fabricado',
  unidade         produto_unidade NOT NULL DEFAULT 'un',
  formato         produto_formato,
  peso_alvo_g     INT,
  preco_avulso    NUMERIC(10,2),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX produtos_ativo_idx ON produtos(ativo) WHERE ativo = TRUE;

CREATE TRIGGER produtos_set_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos admin all" ON produtos
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Leitura pública de produtos ATIVOS (Portal vai usar isso quando migrar
-- de hardcode pra banco — task futura).
CREATE POLICY "produtos public read ativos" ON produtos
  FOR SELECT TO anon
  USING (ativo = TRUE);

-- ============ PLANOS ============

CREATE TABLE planos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  nome            TEXT NOT NULL,
  preco_por_pao   NUMERIC(10,2) NOT NULL,
  preco_frete     NUMERIC(10,2) NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos admin all" ON planos
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ PLAN_PRODUTOS ============

CREATE TABLE plan_produtos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id    UUID NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
  produto_id  UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  papel       plan_produto_papel NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (plano_id, produto_id)
);

CREATE INDEX plan_produtos_plano_idx ON plan_produtos(plano_id);
CREATE INDEX plan_produtos_produto_idx ON plan_produtos(produto_id);
CREATE INDEX plan_produtos_papel_idx ON plan_produtos(papel);

ALTER TABLE plan_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_produtos admin all" ON plan_produtos
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

### 5.4. `0005_receitas.sql`

Estrutura de receitas com versionamento imutável + funções helper.

```sql
-- ============================================================
-- Cora Backoffice — Migration 0005: receitas
-- ============================================================

CREATE TYPE versao_receita_status AS ENUM ('rascunho', 'teste', 'ativa', 'arquivada');

-- ============ RECEITAS ============

CREATE TABLE receitas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id          UUID NOT NULL UNIQUE REFERENCES produtos(id) ON DELETE CASCADE,
  versao_ativa_id     UUID,  -- FK adicionada após criar versoes_receita
  grupo_sugerido      SMALLINT NOT NULL DEFAULT 2 
                      CHECK (grupo_sugerido BETWEEN 1 AND 3),
  formato             produto_formato NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX receitas_produto_idx ON receitas(produto_id);

CREATE TRIGGER receitas_set_updated_at
  BEFORE UPDATE ON receitas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receitas admin all" ON receitas
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ VERSOES_RECEITA ============

CREATE TABLE versoes_receita (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receita_id          UUID NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  numero_versao       INT NOT NULL,
  status              versao_receita_status NOT NULL DEFAULT 'rascunho',
  hidratacao_alvo     NUMERIC(5,2),
  peso_massa_g        INT,
  perda_coccao        NUMERIC(4,3),
  notas               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at         TIMESTAMPTZ,
  
  UNIQUE (receita_id, numero_versao)
);

CREATE INDEX versoes_receita_receita_idx ON versoes_receita(receita_id);
CREATE INDEX versoes_receita_status_idx ON versoes_receita(status);

ALTER TABLE versoes_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versoes_receita admin all" ON versoes_receita
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- FK circular: receitas.versao_ativa_id → versoes_receita.id
ALTER TABLE receitas 
  ADD CONSTRAINT receitas_versao_ativa_fk 
  FOREIGN KEY (versao_ativa_id) REFERENCES versoes_receita(id);

-- ============ INGREDIENTES_RECEITA ============

CREATE TABLE ingredientes_receita (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_receita_id   UUID NOT NULL REFERENCES versoes_receita(id) ON DELETE CASCADE,
  ingrediente_id      UUID NOT NULL REFERENCES ingredientes(id),
  percentual_baker    NUMERIC(6,4) NOT NULL,
  ordem               INT NOT NULL DEFAULT 0,
  notas               TEXT,
  
  UNIQUE (versao_receita_id, ingrediente_id)
);

CREATE INDEX ingredientes_receita_versao_idx ON ingredientes_receita(versao_receita_id);
CREATE INDEX ingredientes_receita_ingrediente_idx ON ingredientes_receita(ingrediente_id);

ALTER TABLE ingredientes_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredientes_receita admin all" ON ingredientes_receita
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ ETAPAS_RECEITA ============

CREATE TABLE etapas_receita (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_receita_id   UUID NOT NULL REFERENCES versoes_receita(id) ON DELETE CASCADE,
  ordem               INT NOT NULL,
  nome                TEXT NOT NULL,
  duracao_min         INT,
  notas               TEXT,
  
  UNIQUE (versao_receita_id, ordem)
);

CREATE INDEX etapas_receita_versao_idx ON etapas_receita(versao_receita_id);

ALTER TABLE etapas_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etapas_receita admin all" ON etapas_receita
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============ FUNÇÕES HELPER ============

-- Clona uma versão de receita como nova versão (status default = teste).
-- Copia ingredientes e etapas. Retorna o ID da nova versão.
CREATE OR REPLACE FUNCTION fork_versao_receita(
  p_versao_origem_id UUID,
  p_status versao_receita_status DEFAULT 'teste'
) RETURNS UUID AS $$
DECLARE
  v_nova_versao_id UUID;
  v_receita_id UUID;
  v_proximo_numero INT;
BEGIN
  SELECT receita_id INTO v_receita_id 
  FROM versoes_receita WHERE id = p_versao_origem_id;
  
  IF v_receita_id IS NULL THEN
    RAISE EXCEPTION 'Versão de origem % não encontrada', p_versao_origem_id;
  END IF;
  
  SELECT COALESCE(MAX(numero_versao), 0) + 1 INTO v_proximo_numero
  FROM versoes_receita WHERE receita_id = v_receita_id;
  
  INSERT INTO versoes_receita (
    receita_id, numero_versao, status, 
    hidratacao_alvo, peso_massa_g, perda_coccao, notas
  )
  SELECT 
    receita_id, v_proximo_numero, p_status, 
    hidratacao_alvo, peso_massa_g, perda_coccao, notas
  FROM versoes_receita WHERE id = p_versao_origem_id
  RETURNING id INTO v_nova_versao_id;
  
  INSERT INTO ingredientes_receita 
    (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
  SELECT v_nova_versao_id, ingrediente_id, percentual_baker, ordem, notas
  FROM ingredientes_receita WHERE versao_receita_id = p_versao_origem_id;
  
  INSERT INTO etapas_receita 
    (versao_receita_id, ordem, nome, duracao_min, notas)
  SELECT v_nova_versao_id, ordem, nome, duracao_min, notas
  FROM etapas_receita WHERE versao_receita_id = p_versao_origem_id;
  
  RETURN v_nova_versao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativa uma versão de receita. Arquiva a versão anteriormente ativa.
-- Atualiza receitas.versao_ativa_id.
CREATE OR REPLACE FUNCTION ativar_versao_receita(p_versao_id UUID) 
RETURNS VOID AS $$
DECLARE
  v_receita_id UUID;
  v_versao_anterior_id UUID;
BEGIN
  SELECT v.receita_id, r.versao_ativa_id 
  INTO v_receita_id, v_versao_anterior_id
  FROM versoes_receita v 
  JOIN receitas r ON v.receita_id = r.id
  WHERE v.id = p_versao_id;
  
  IF v_receita_id IS NULL THEN
    RAISE EXCEPTION 'Versão % não encontrada', p_versao_id;
  END IF;
  
  UPDATE versoes_receita SET status = 'ativa' WHERE id = p_versao_id;
  
  IF v_versao_anterior_id IS NOT NULL AND v_versao_anterior_id != p_versao_id THEN
    UPDATE versoes_receita 
    SET status = 'arquivada', archived_at = NOW()
    WHERE id = v_versao_anterior_id;
  END IF;
  
  UPDATE receitas SET versao_ativa_id = p_versao_id WHERE id = v_receita_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.5. `0006_seed.sql`

Seed completo: fornecedores, ingredientes (25), produtos (6), plano + plan_produtos, receitas + versão v1 ativa de cada uma.

```sql
-- ============================================================
-- Cora Backoffice — Migration 0006: seed inicial
-- ============================================================
-- Fonte: CORA_Fichas_Producao_v5.xlsx (10/mai/2026)
-- Decisão: receitas entram com status = 'ativa' (não 'teste').
-- Pesos canônicos: Original e Integral 700g (não 705g da planilha).

BEGIN;

-- ============ FORNECEDORES ============

INSERT INTO fornecedores (nome, prazo_entrega_dias, notas) VALUES
  ('CCN (Le 5 Stagioni)', 3, 'Farinhas italianas importadas. Saco 10kg. Min. R$400.'),
  ('Fazenda Vargem', 15, 'Moinho a pedra. Saco 10kg, val. 3 meses.');

-- ============ INGREDIENTES (25) ============

WITH ccn AS (SELECT id FROM fornecedores WHERE nome = 'CCN (Le 5 Stagioni)'),
     fv  AS (SELECT id FROM fornecedores WHERE nome = 'Fazenda Vargem')
INSERT INTO ingredientes (slug, nome, preco_por_kg, fornecedor_id, notas) VALUES
  -- Farinhas (5)
  ('farinha-superiore',   'Farinha Superiore (Le 5 Stagioni)',  12.26, (SELECT id FROM ccn), 'W330. Saco 10kg = R$122,60.'),
  ('farinha-mora',        'Farinha Mora (Le 5 Stagioni)',       23.41, (SELECT id FROM ccn), 'Integral italiana. Saco 10kg = R$234,12. Val. 8 meses.'),
  ('farinha-fv-integral', 'Farinha FV Integral',                 7.90, (SELECT id FROM fv),  'Moída a pedra. Saco 10kg. Val. 3 meses.'),
  ('farinha-slow',        'Farinha Slow (FV)',                   9.95, (SELECT id FROM fv),  'Semi-integral. Saco 10kg. Val. 3 meses.'),
  ('semola-rimacinata',   'Sêmola Rimacinata (Le 5 Stagioni)',  22.19, (SELECT id FROM ccn), 'Saco 10kg = R$221,92.'),
  -- Gorduras (2)
  ('azeite-luglio',       'Azeite Luglio',                      98.00, (SELECT id FROM ccn), 'Bombona 5L = R$489,99.'),
  ('manteiga-sem-sal',    'Manteiga sem sal',                   73.45, NULL, NULL),
  -- Sal e açúcar (3)
  ('sal-marinho',         'Sal marinho',                        14.69, NULL, NULL),
  ('sal-grosso',          'Sal grosso',                          8.00, NULL, NULL),
  ('acucar',              'Açúcar',                              7.96, NULL, NULL),
  -- Outros líquidos (3)
  ('leite-integral',      'Leite integral',                      7.99, NULL, NULL),
  ('mel',                 'Mel',                                38.00, NULL, NULL),
  ('agua-mineral',        'Água mineral',                        0.75, NULL, 'Levain e massa.'),
  -- Fermentação (1)
  ('fermento-seco',       'Fermento seco',                      80.00, NULL, 'Instantâneo. Usado no brioche.'),
  -- Ovos (1)
  ('ovos',                'Ovos',                               39.93, NULL, 'Preço por kg. Brioche.'),
  -- Sementes (6)
  ('gergelim-branco',     'Gergelim branco',                     4.29, NULL, NULL),
  ('gergelim-preto',      'Gergelim preto',                      9.18, NULL, NULL),
  ('quinoa-mista',        'Quinoa mista',                       49.90, NULL, 'Mais cara das sementes.'),
  ('linhaca-dourada',     'Linhaça dourada',                     2.79, NULL, NULL),
  ('semente-girassol',    'Semente girassol',                    4.95, NULL, NULL),
  ('semente-abobora',     'Semente abóbora',                     9.25, NULL, NULL),
  -- Crostas (2)
  ('aveia-fina',          'Aveia fina',                          8.00, NULL, 'Crosta multigrãos.'),
  ('farelo-trigo',        'Farelo de trigo',                     5.00, NULL, 'Crosta integral.'),
  -- Cobertura focaccia (2)
  ('cebola-roxa',         'Cebola roxa',                        12.00, NULL, 'Cobertura focaccia.'),
  ('alecrim-fresco',      'Alecrim fresco',                     60.00, NULL, 'Cobertura focaccia.');

-- ============ PRODUTOS (6) ============

INSERT INTO produtos (slug, nome, tipo, unidade, formato, peso_alvo_g, preco_avulso) VALUES
  ('original',    'Pão Original',         'fabricado', 'un', 'banneton',  700, 27.00),
  ('integral',    'Pão Integral',         'fabricado', 'un', 'banneton',  700, 29.00),
  ('multigraos',  'Pão Multigrãos',       'fabricado', 'un', 'banneton',  615, 32.00),
  ('focaccia',    'Focaccia Genovesa',    'fabricado', 'un', 'tabuleiro', 258, 22.00),
  ('brioche',     'Brioche',              'fabricado', 'un', 'forma',     256, 32.00),
  ('ciabatta',    'Ciabatta Rústica',     'fabricado', 'un', 'couche',    533, 25.00);

-- ============ PLANO + PLAN_PRODUTOS ============

INSERT INTO planos (slug, nome, preco_por_pao, preco_frete) VALUES
  ('base', 'Plano Base', 99.00, 15.00);

INSERT INTO plan_produtos (plano_id, produto_id, papel)
SELECT 
  (SELECT id FROM planos WHERE slug = 'base'),
  p.id,
  CASE 
    WHEN p.slug IN ('original', 'integral') THEN 'base'::plan_produto_papel
    ELSE 'rotativa'::plan_produto_papel
  END
FROM produtos p;

-- ============ RECEITAS (estrutura, sem versão ainda) ============

INSERT INTO receitas (produto_id, grupo_sugerido, formato)
SELECT id, 
       CASE slug 
         WHEN 'original' THEN 1 
         WHEN 'integral' THEN 2 
         WHEN 'multigraos' THEN 2 
         WHEN 'focaccia' THEN 3 
         WHEN 'brioche' THEN 3 
         WHEN 'ciabatta' THEN 2 
       END,
       formato
FROM produtos;

-- ============ VERSOES_RECEITA v1 (rascunho — vira ativa via função) ============

-- Original
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'original'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 70.00, 820, 0.140, 
       'Receita base. Poucos ingredientes, depende da técnica. 4 dobras pra alvéolos regulares. Água: H2O1 (autólise) = 85% / H2O2 (batimento) = 15%. Cocção: lastro 230° / teto 250° · 38min · vapor inicial.'
FROM r;

-- Integral
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'integral'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 75.00, 820, 0.140, 
       '90% FV Integral + 10% Slow. Azeite por último no batimento (pode ser gelado). 3 dobras (não 4). Crosta: farelo de trigo. Água: H2O1 (autólise) = 85% / H2O2 = 15%. Cocção: lastro 230° / teto 250° · 38min · vapor inicial.'
FROM r;

-- Multigrãos
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'multigraos'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 112.00, 750, 0.180, 
       'Processo 2 dias: terça escaldar+levain, quarta produzir. Hidratação 112% (autólise 58% + escaldar 54%). 6 sementes na massa + aveia na crosta (7ª). 4 dobras padrão (pode reduzir pra 2-3 se massa já tiver estrutura). Cocção: lastro 230° / teto 250° · 38min · vapor inicial.'
FROM r;

-- Focaccia
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'focaccia'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 75.00, 315, 0.180, 
       '1 tabuleiro 60×40 = 9 porções = 1 unidade de venda. Farinha 100% Superiore. Dimples com os dedos antes de assar. Azeite generoso. Água: H2O1 = 75% / H2O2 = 25%. Cocção: lastro 250° / teto 260° · 15-20min · sem vapor.'
FROM r;

-- Brioche
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'brioche'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', NULL, 312, 0.180, 
       'Fermentação MISTA: levain (sabor) + fermento seco (leveza). 1 forma 6 bolinhas = 1 unidade. Egg wash antes de assar. Cocção: 180°C · 30-35min · sem vapor (temp baixa, açúcar carameliza). 3 dobras (massa enriquecida = menos manipulação).'
FROM r;

-- Ciabatta
WITH r AS (SELECT id FROM receitas WHERE produto_id = (SELECT id FROM produtos WHERE slug = 'ciabatta'))
INSERT INTO versoes_receita (receita_id, numero_versao, status, hidratacao_alvo, peso_massa_g, perda_coccao, notas)
SELECT r.id, 1, 'rascunho', 76.00, 650, 0.180, 
       '2ª fermentação em COUCHE (não banneton). Sem corte/pestana. NÃO modelar demais. NÃO desgasificar. Divisão retangular ~650g. Água: H2O1 = 84% / H2O2 = 16%. Cocção: lastro 230° / teto 250° · 25-30min · vapor.'
FROM r;

-- ============ INGREDIENTES_RECEITA ============

-- Helper: insere ingrediente em uma versão de receita por slugs
-- Padrão: percentual_baker é decimal (0.85 = 85% baker)

-- Original v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr 
  JOIN receitas r ON vr.receita_id = r.id 
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'original' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES 
  ('farinha-superiore',   0.85,   1, NULL),
  ('farinha-fv-integral', 0.15,   2, NULL),
  ('agua-mineral',        0.70,   3, 'Total. H2O1 (autólise) = 85% / H2O2 (batimento) = 15%'),
  ('sal-marinho',         0.02,   4, NULL)
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Integral v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr 
  JOIN receitas r ON vr.receita_id = r.id 
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'integral' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES 
  ('farinha-fv-integral', 0.90,   1, NULL),
  ('farinha-slow',        0.10,   2, NULL),
  ('agua-mineral',        0.75,   3, 'Total. H2O1 = 85% / H2O2 = 15%'),
  ('azeite-luglio',       0.06,   4, 'Por último no batimento'),
  ('sal-marinho',         0.024,  5, NULL),
  ('gergelim-branco',     0.0135, 6, 'Gergelim mix (50/50 com preto), crosta'),
  ('gergelim-preto',      0.0135, 7, 'Gergelim mix (50/50 com branco), crosta'),
  ('farelo-trigo',        0.030,  8, 'Crosta — polvilhar antes do banneton')
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Multigrãos v1
-- Nota: água e sal são deduplicados (mesmo ingrediente em momentos diferentes).
-- Momentos de uso ficam em `notas`. Etapas detalham o quando.
WITH v AS (
  SELECT vr.id FROM versoes_receita vr 
  JOIN receitas r ON vr.receita_id = r.id 
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'multigraos' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES 
  ('farinha-superiore',   0.70,    1, NULL),
  ('farinha-fv-integral', 0.20,    2, NULL),
  ('farinha-slow',        0.10,    3, NULL),
  ('agua-mineral',        1.12,    4, 'Autólise 58% + escaldar 54% = 112% total'),
  ('sal-marinho',         0.032,   5, 'Massa 2% + escaldar 1.2% = 3.2% total'),
  ('gergelim-branco',     0.0768,  6, NULL),
  ('gergelim-preto',      0.0768,  7, NULL),
  ('quinoa-mista',        0.0768,  8, NULL),
  ('linhaca-dourada',     0.0768,  9, NULL),
  ('semente-girassol',    0.0768, 10, NULL),
  ('semente-abobora',     0.0768, 11, NULL),
  ('aveia-fina',          0.06,   12, 'Crosta — polvilhar antes do banneton')
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Focaccia v1
-- Nota: azeite é deduplicado (massa 3% + cobertura 5% = 8% total).
WITH v AS (
  SELECT vr.id FROM versoes_receita vr 
  JOIN receitas r ON vr.receita_id = r.id 
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'focaccia' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES 
  ('farinha-superiore',   1.00,   1, NULL),
  ('agua-mineral',        0.75,   2, 'H2O1 75% / H2O2 25%'),
  ('azeite-luglio',       0.08,   3, 'Massa 3% + cobertura 5%'),
  ('sal-marinho',         0.024,  4, 'Massa'),
  ('cebola-roxa',         0.15,   5, 'Cobertura'),
  ('alecrim-fresco',      0.02,   6, 'Cobertura'),
  ('sal-grosso',          0.01,   7, 'Cobertura')
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Brioche v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr 
  JOIN receitas r ON vr.receita_id = r.id 
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'brioche' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES 
  ('farinha-superiore',   0.75,    1, NULL),
  ('semola-rimacinata',   0.25,    2, NULL),
  ('fermento-seco',       0.015,   3, 'Fermentação mista'),
  ('manteiga-sem-sal',    0.30,    4, NULL),
  ('ovos',                0.40,    5, NULL),
  ('acucar',              0.10,    6, NULL),
  ('mel',                 0.05,    7, NULL),
  ('leite-integral',      0.23,    8, NULL),
  ('sal-marinho',         0.02,    9, NULL)
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- Ciabatta v1
WITH v AS (
  SELECT vr.id FROM versoes_receita vr 
  JOIN receitas r ON vr.receita_id = r.id 
  JOIN produtos p ON r.produto_id = p.id
  WHERE p.slug = 'ciabatta' AND vr.numero_versao = 1
)
INSERT INTO ingredientes_receita (versao_receita_id, ingrediente_id, percentual_baker, ordem, notas)
SELECT v.id, i.id, perc, ord, nota
FROM v, (VALUES 
  ('farinha-superiore',   0.90,   1, NULL),
  ('farinha-fv-integral', 0.10,   2, NULL),
  ('agua-mineral',        0.76,   3, 'H2O1 = 84% / H2O2 = 16%'),
  ('azeite-luglio',       0.016,  4, NULL),
  ('sal-marinho',         0.022,  5, NULL)
) AS dados(slug, perc, ord, nota)
JOIN ingredientes i ON i.slug = dados.slug;

-- ============ ETAPAS_RECEITA ============

-- Etapas padrão para todas as receitas (7 etapas conforme decisão Backoffice).
-- Variações específicas (Brioche sem autólise formal, Ciabatta sem corte) 
-- ficam no campo `notas`.

-- Função helper local para inserir etapas em todas as versões v1
DO $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN 
    SELECT vr.id, p.slug
    FROM versoes_receita vr
    JOIN receitas r ON vr.receita_id = r.id
    JOIN produtos p ON r.produto_id = p.id
    WHERE vr.numero_versao = 1
  LOOP
    INSERT INTO etapas_receita (versao_receita_id, ordem, nome, duracao_min, notas) VALUES
      (v.id, 1, 'Autólise',         40,  CASE v.slug WHEN 'ciabatta' THEN 'Sem autólise formal — mistura direta' WHEN 'brioche' THEN 'Sem autólise — massa enriquecida' ELSE NULL END),
      (v.id, 2, 'Batimento',         8,  'Massa desejada 26°C. T° água 12-13°C.'),
      (v.id, 3, 'Falsa dobra',       0,  '8 min após batimento'),
      (v.id, 4, 'Dobras',          120,  CASE v.slug WHEN 'integral' THEN '3 dobras de 30 em 30 min' WHEN 'brioche' THEN '3 dobras (massa enriquecida)' ELSE '4 dobras de 30 em 30 min' END),
      (v.id, 5, 'Descanso e divisão', 120, 'Bulk 2h + divisão'),
      (v.id, 6, 'Shape',             10,  CASE v.slug WHEN 'ciabatta' THEN 'Divisão retangular, NÃO modelar' WHEN 'focaccia' THEN 'Esticar na assadeira 60×40' ELSE NULL END),
      (v.id, 7, '2ª fermentação',  720,  CASE v.slug WHEN 'ciabatta' THEN 'Couche, overnight geladeira' WHEN 'focaccia' THEN 'Assadeira untada com azeite' ELSE 'Banneton com farinha de arroz, overnight geladeira' END);
  END LOOP;
END $$;

-- ============ ATIVAR VERSÕES (rascunho → ativa) ============

-- Aplica a função ativar_versao_receita() em cada v1.
-- Como a versão atual é 'rascunho' e não há versão anterior, isso só atualiza 
-- status pra 'ativa' e aponta receitas.versao_ativa_id.

DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN 
    SELECT vr.id FROM versoes_receita vr WHERE vr.numero_versao = 1
  LOOP
    PERFORM ativar_versao_receita(v_id);
  END LOOP;
END $$;

COMMIT;
```

> **Validação pós-seed:** rodar no SQL Editor:
> ```sql
> SELECT p.slug, p.peso_alvo_g, vr.status, vr.hidratacao_alvo
> FROM produtos p
> JOIN receitas r ON r.produto_id = p.id
> JOIN versoes_receita vr ON vr.id = r.versao_ativa_id
> ORDER BY p.slug;
> ```
> Deve retornar 6 rows, todas com `status = 'ativa'`.

---

## 6. Frontend mínimo da Fase 0

Não tem UI de módulos ainda. Só auth + healthcheck.

### 6.1. `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### 6.2. Gerar tipos

Após aplicar todas as migrations:

```bash
npm run db:types
```

Isso gera `src/lib/database.types.ts` com todos os tipos das tabelas, enums e views.

### 6.3. `src/components/RequireAuth.tsx`

```typescript
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setAuthed(true);

      // Checa se é admin via tabela admin_users (RLS bloqueia se não for)
      const { data, error } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', session.user.email!)
        .maybeSingle();
      
      setIsAdmin(!!data && !error);
      setLoading(false);
    }
    check();
  }, []);

  if (loading) return <div className="p-8">Carregando…</div>;
  if (!authed) return <Navigate to="/login" replace />;
  if (!isAdmin) return <div className="p-8">Acesso negado. Esta conta não é admin.</div>;

  return <>{children}</>;
}
```

### 6.4. `src/pages/Login.tsx`

```typescript
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50">
      <div className="max-w-sm w-full bg-white p-8 rounded-lg border border-warm-200">
        <h1 className="font-heading text-3xl text-brand-500 mb-2">Cora Backoffice</h1>
        <p className="text-warm-600 mb-6">Entrar via magic link.</p>
        
        {sent ? (
          <p className="text-warm-600">Link enviado pra {email}. Confere o email.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-3 py-2 border border-warm-200 rounded"
            />
            <button 
              type="submit"
              className="w-full bg-brand-500 text-white py-2 rounded hover:bg-brand-600"
            >
              Receber link
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
```

### 6.5. `src/pages/AuthCallback.tsx`

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase processa o token automaticamente da URL.
    supabase.auth.getSession().then(() => {
      navigate('/', { replace: true });
    });
  }, [navigate]);

  return <div className="p-8">Autenticando…</div>;
}
```

### 6.6. `src/pages/Home.tsx`

Healthcheck visual: confirma que está logado, conectado ao banco, e mostra contagem de subscriptions ativas (proof of life).

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function Home() {
  const [user, setUser] = useState<string>('');
  const [subsAtivas, setSubsAtivas] = useState<number | null>(null);
  const [produtos, setProdutos] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user.email || '');

      const { count: subs } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      setSubsAtivas(subs);

      const { count: prods } = await supabase
        .from('produtos')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      setProdutos(prods);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-warm-50 p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="font-heading text-4xl text-brand-500">Cora Backoffice</h1>
          <button 
            onClick={handleLogout}
            className="text-sm text-warm-600 hover:underline"
          >
            Sair
          </button>
        </header>

        <p className="mb-8 text-warm-600">Logado como <strong>{user}</strong>.</p>

        <div className="bg-white border border-warm-200 rounded p-6 mb-6">
          <h2 className="font-heading text-xl mb-4">Healthcheck</h2>
          <ul className="space-y-2 text-warm-600">
            <li>Assinaturas ativas: <strong>{subsAtivas ?? '…'}</strong></li>
            <li>Produtos ativos no catálogo: <strong>{produtos ?? '…'}</strong></li>
          </ul>
        </div>

        <div className="bg-warm-100 border border-warm-200 rounded p-6">
          <h2 className="font-heading text-xl mb-4">Módulos (em construção)</h2>
          <ul className="space-y-2 text-warm-600 opacity-50">
            <li>Semana — Fase 1</li>
            <li>Produção — Fase 1</li>
            <li>Expedição — Fase 2</li>
            <li>Receitas — Fase 3</li>
            <li>Planejamento — Fase 4</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### 6.7. `src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Home } from './pages/Home';
import { RequireAuth } from './components/RequireAuth';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}
```

### 6.8. Configurar Supabase Auth (dashboard)

No dashboard Supabase → Authentication → URL Configuration:

- **Site URL:** `https://admin.acora.com.br`
- **Redirect URLs:** adicionar `https://admin.acora.com.br/auth/callback` e `http://localhost:5173/auth/callback`

---

## 7. Deploy

### 7.1. Conectar repo ao Vercel

1. Importar `cora-backoffice` no Vercel
2. Framework preset: **Vite**
3. Adicionar env vars: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

### 7.2. Configurar domínio

No Vercel → Settings → Domains: adicionar `admin.acora.com.br`. DNS já tem `CNAME app → Vercel` no Registro.br — aplicar o mesmo padrão para `admin`.

### 7.3. Deploy protection

Manter desabilitado (ou habilitar com bypass token) durante a Fase 0 pra Hugo testar sem fricção.

---

## 8. Critério de "Fase 0 fechada"

Tudo abaixo precisa estar funcionando:

1. Repo `cora-backoffice` no GitHub, com push limpo da branch main
2. Migrations 0002 a 0006 aplicadas no Supabase (verificar via `supabase migration list`)
3. Seed validado com a query do final da seção 5.5 retornando 6 rows
4. `admin.acora.com.br` no ar via Vercel
5. Hugo consegue logar via magic link
6. Tela Home mostra healthcheck com contagens corretas (subs ativas, produtos ativos)
7. `database.types.ts` gerado e commitado
8. README do repo com instruções de setup local e variáveis de ambiente

---

## 9. O que NÃO fazer na Fase 0

- **Não** criar UI de Semana, Produção, Expedição, Receitas ou Planejamento. Esses são placeholders na Home.
- **Não** mexer em `subscriptions`, `coverage_waitlist` ou `coverage_whitelist`. São do Portal.
- **Não** migrar Portal de hardcode pra `produtos`. Task separada, fica pra depois.
- **Não** criar tabelas operacionais (`semanas`, `producoes`, `entregas`). Vêm na Fase 1.
- **Não** implementar gestão de estoque (movimentações, alertas, baixa automática). Fora do MVP.
- **Não** adicionar Drizzle, Prisma ou qualquer ORM Node. Cliente é Supabase JS direto.
- **Não** criar API routes ou Edge Functions. Backoffice é client-side puro.
- **Não** rodar `supabase db reset` em hipótese alguma. Base é compartilhada com Portal.

---

## 10. Pontos de atenção pendentes para Hugo

Itens que Hugo precisa decidir/confirmar antes de aplicar:

1. **Email do admin no `0002_admin_users.sql`** — usar `hugorafael01@gmail.com` por enquanto, atualizar para `hugo@acora.com.br` quando o Workspace ativar. Trocar via UPDATE ou nova migration.
2. **Etapas das receitas** — durações padrão são chute fundamentado, não medidas. Hugo deve ajustar pós-uso real, criando v2 via `fork_versao_receita()`.

### Decisões de modelagem já aplicadas (referência)

- **Ingredientes que aparecem em múltiplos momentos** (água escaldar + autólise, sal massa + escaldar, azeite massa + cobertura): consolidados em **1 linha por ingrediente por receita**, com `percentual_baker` somando os usos. O momento de uso fica em `notas` e no detalhe das etapas. Ingrediente é entidade; etapa é processo.

---

## 11. Como interagir com o Claude Code

Salvar este briefing em `cora-backoffice/Docs/CORA_Briefing_Backoffice_Fase0_Setup.md` e abrir o Claude Code com prompt:

```
Implementar Fase 0 do Backoffice conforme Docs/CORA_Briefing_Backoffice_Fase0_Setup.md.

Executar em ordem:
1. Setup do projeto Vite + React + TS + Tailwind (seção 3)
2. Configurar Supabase CLI e copiar 0001_initial.sql do Portal (seção 4)
3. Aplicar migrations 0002 a 0006 (seção 5)
4. Validar seed com a query da seção 5.5
5. Implementar frontend mínimo (seção 6)
6. Configurar deploy no Vercel (seção 7)
7. Validar critérios da seção 8

Se houver ambiguidade, perguntar antes de inferir. Não fazer nada que esteja na seção 9.

Ao final, atualizar PORTAL_STATUS.md (no repo cora-portal) com a nota: "Backoffice Fase 0 fechada em DD/MM/AAAA. admin.acora.com.br no ar."
```

---

*Briefing gerado por Claude Chat em 10/mai/2026 ao final da sessão de decisões pré-Fase 0. Revisar antes de aplicar e ajustar pontos da seção 10.*
