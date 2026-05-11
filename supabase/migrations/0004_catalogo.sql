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
